<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import TargetPicker from '@/components/TargetPicker.vue'
import { t } from '@/i18n'

/**
 * One JDBC data source: the live pool figures next to the settings that
 * produced them, so "raise the maximum" and "see what it did" are one page.
 */
const route = useRoute()
const ui = useUiStore()
const name = computed(() => String(route.params.name || ''))
const testing = ref(false)

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes] = await Promise.all([wls.dataSourceConfigs({ signal }), wls.dataSourceRuntimes({ signal })])
  return { configs, runtimes }
})

const configured = computed(() =>
  items(data.value?.configs?.JDBCSystemResources).find((resource) => resource.name === name.value),
)

const missing = computed(() => Boolean(data.value) && !configured.value)

/** Pool statistics are per server, so they are summed across the domain. */
const instances = computed(() => {
  const found = []
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const ds of items(server.JDBCServiceRuntime?.JDBCDataSourceRuntimeMBeans)) {
      if (ds.name === name.value) found.push({ server: server.name, ...ds })
    }
  }
  return found
})

const sum = (field) => instances.value.reduce((total, instance) => total + Number(instance[field] || 0), 0)

const state = computed(() => {
  if (!instances.value.length) return null
  return instances.value.find((instance) => instance.state !== 'Running')?.state ?? 'Running'
})

const facts = computed(() => {
  const jdbc = configured.value?.JDBCResource || {}
  return [
    {
      label: t('Active connections'),
      value: num(sum('activeConnectionsCurrentCount')),
      hint: t(
        'Connections checked out by application code right now, added up over every server. Sitting at the maximum means requests are queueing.',
      ),
    },
    {
      label: t('Pool size'),
      value: num(sum('currCapacity')),
      hint: t('Connections the pool holds at the moment. It grows towards the configured maximum under load.'),
    },
    {
      label: t('Waiting'),
      value: num(sum('waitingForConnectionCurrentCount')),
      hint: t(
        'Threads blocked waiting for a free connection. Anything above zero means the pool is too small or the queries are too slow.',
      ),
    },
    {
      label: t('Reconnect failures'),
      value: num(sum('failuresToReconnectCount')),
      hint: t(
        'Times the pool could not replace a connection. A climbing number points at the database or the network, not at these settings.',
      ),
    },
    {
      label: t('Running on'),
      value: instances.value.map((instance) => instance.server).join(', ') || t('nowhere'),
    },
    { label: t('Targets'), value: targetNames(configured.value?.targets).join(', ') || '—' },
    { label: t('JNDI names'), value: (jdbc.JDBCDataSourceParams?.JNDINames || []).join(', ') || '—', mono: true },
    { label: t('URL'), value: jdbc.JDBCDriverParams?.url || '—', mono: true },
  ]
})

async function testPool() {
  const instance = instances.value[0]
  if (!instance) {
    ui.info(
      t('Nothing to test'),
      t('{name} has no running instance — start a target server first.', { name: name.value }),
    )
    return
  }
  testing.value = true
  try {
    // testPool() returns null on success and raises a JDBC error otherwise.
    await wls.testDataSource(instance.server, name.value)
    ui.success(t('Connection test passed'), t('{name} on {server}', { name: name.value, server: instance.server }))
  } catch (err) {
    ui.error(t('Connection test failed for {name}', { name: name.value }), err.fullText || err.message)
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      :subtitle="$t('Connection pool statistics and settings')"
      :back="{ name: 'data-sources' }"
      :back-label="$t('Data Sources')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'One data source: what its pool is doing right now, and the settings that decide its size, its connection test and where it connects.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <button
          class="btn btn-ghost"
          :disabled="testing"
          :title="
            $t(
              'Borrow a connection from this pool and run its test query against the database. Read-only and safe to press at any time.',
            )
          "
          @click="testPool"
        >
          {{ testing ? $t('Testing…') : $t('Test connection') }}
        </button>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('This domain has no data source called {name}.', { name }) }}
      {{ $t('Go back to') }}
      <RouterLink :to="{ name: 'data-sources' }" class="text-indigo-600 dark:text-indigo-400">
        {{ $t('Data Sources') }}
      </RouterLink>
      {{ $t('for the current list.') }}
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge v-if="state" :state="state.toUpperCase()" />
          <span v-else class="text-xs text-zinc-400 dark:text-zinc-500">
            {{ $t('Not deployed on any running server, so there are no live figures — the settings still apply.') }}
          </span>
        </div>
        <FactList :facts="facts" />
      </div>

      <TargetPicker
        class="mb-4"
        :path="config.dataSourceResourcePath(name)"
        :name="name"
        :current="targetNames(configured?.targets)"
        wlst-type="JDBCSystemResource"
        :description="
          $t(
            'Where this data source is deployed. Adding a target creates its pool there when the change is activated; removing one takes the pool away, so anything using that JNDI name on that server stops working.',
          )
        "
        @changed="reload"
      />

      <SettingsPanel
        :sections="['data-sources']"
        :name="name"
        :intro="
          $t(
            'Pool sizes count per server: a maximum of 20 on a data source targeted to three servers means up to 60 sessions on the database.',
          )
        "
      />
    </template>
  </div>
</template>
