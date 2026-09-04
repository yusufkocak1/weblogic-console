<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { baseAppName, healthOf, items, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

/**
 * One application: whether it is serving, where it is serving from, and the
 * deployment settings that decide how it gets there.
 */
const route = useRoute()
const ui = useUiStore()
const confirm = ref(null)
const busy = ref(false)
const name = computed(() => String(route.params.name || ''))

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes] = await Promise.all([wls.appDeployments({ signal }), wls.applicationRuntimes({ signal })])
  // The state the classic console shows only exists as an action on the
  // deployment runtime, so it is asked for separately.
  const states = await wls.deploymentStates([name.value], { signal })
  return { configs, runtimes, states }
})

const configured = computed(() => items(data.value?.configs).find((config) => config.name === name.value))
const missing = computed(() => Boolean(data.value) && !configured.value)

/** Every server this application is actually running on, with its health. */
const instances = computed(() => {
  const wanted = new Set([name.value, baseAppName(name.value)])
  const found = []
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) {
      const names = [app.name, app.applicationName, baseAppName(app.name)].filter(Boolean)
      if (names.some((candidate) => wanted.has(candidate)) && !found.some((f) => f.server === server.name)) {
        found.push({ server: server.name, health: healthOf(app.healthState) })
      }
    }
  }
  return found
})

const targets = computed(() => targetNames(configured.value?.targets))
const state = computed(() => data.value?.states?.get(name.value) || (instances.value.length ? 'ACTIVE' : null))
const health = computed(() =>
  instances.value.length ? (instances.value.find((i) => i.health !== 'OK')?.health ?? 'OK') : null,
)

const facts = computed(() => [
  { label: 'Type', value: configured.value?.moduleType || '—', hint: 'war for a web application, ear for an enterprise application, jar for an EJB module.' },
  { label: 'Targets', value: targets.value.join(', ') || '—', hint: 'The servers and clusters this application is deployed to. Start and Stop act on all of them.' },
  { label: 'Running on', value: instances.value.map((i) => i.server).join(', ') || 'nowhere' },
  { label: 'Deployment order', value: configured.value?.deploymentOrder ?? '—', hint: 'Lower numbers deploy first. The setting below changes it.' },
  { label: 'Archive', value: configured.value?.absoluteSourcePath || configured.value?.sourcePath || '—', mono: true },
])

async function runAction(action) {
  const label = action === 'start' ? 'Start' : 'Stop'
  const ok = await confirm.value.ask({
    title: `${label} ${name.value}?`,
    body:
      action === 'start'
        ? `The application will be served on: ${targets.value.join(', ') || 'its targets'}.`
        : 'Clients will stop being served by this application on all its targets.',
    confirmLabel: label,
    danger: action === 'stop',
  })
  if (!ok) return

  busy.value = true
  try {
    await wls.deploymentAction(name.value, action, targets.value)
    ui.success(`${label} requested`, `${name.value} — state refreshes shortly.`)
    setTimeout(reload, 1500)
  } catch (err) {
    ui.error(`${label} failed for ${name.value}`, err.fullText || err.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      subtitle="Deployment state and settings"
      :back="{ name: 'deployments' }"
      back-label="Deployments"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="One application: whether it is serving and where, plus the settings that decide how it is deployed. Installing a new archive still needs WLST or the classic console."
      @refresh="reload"
    >
      <template #actions>
        <div class="flex gap-1.5">
          <button
            class="btn btn-ghost"
            title="Put this application back into service on all of its targets"
            :disabled="busy"
            @click="runAction('start')"
          >
            Start
          </button>
          <button
            class="btn btn-danger"
            title="Take this application out of service on all of its targets — clients stop being served immediately"
            :disabled="busy"
            @click="runAction('stop')"
          >
            Stop
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      This domain has nothing deployed under the name <span class="font-mono">{{ name }}</span
      >. Go back to
      <RouterLink :to="{ name: 'deployments' }" class="text-indigo-600 dark:text-indigo-400">Deployments</RouterLink>
      for the current list.
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge v-if="state" :state="state" />
          <span v-else class="text-xs text-zinc-400 dark:text-zinc-500">
            Not active anywhere — check that its target servers are running.
          </span>
          <StateBadge v-if="health && health !== 'OK'" kind="health" :health="health" />
        </div>
        <FactList :facts="facts" />
      </div>

      <SettingsPanel
        :sections="['deployments']"
        :name="name"
        intro="These settings describe how the application is deployed. Most of them are read when it is next deployed, so activate the change and then stop and start the application to apply it."
      />
    </template>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
