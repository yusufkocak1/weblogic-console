<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { actionDescriptions, bulkActions, actionsFor, useServerActions } from '@/composables/useServerActions'
import { bytes, duration, items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import { t } from '@/i18n'

const confirm = ref(null)
/** Row keys, so one operation can be run over a whole set of servers. */
const selected = ref([])

const { data, error, refreshing, loading, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [snapshot, configs] = await Promise.all([wls.runtimeSnapshot({ signal }), wls.configuredServers({ signal })])
  return { snapshot, configs }
})

// The same lifecycle actions are offered on a server's own page.
const { busy: busyServer, run, runMany } = useServerActions({ confirm, onChanged: reload })

async function runBulk(action) {
  const servers = [...selected.value]
  await runMany(servers, action)
  selected.value = []
}

const rows = computed(() => {
  const runtimes = new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r]))
  const lifecycles = new Map(items(data.value?.snapshot?.serverLifeCycleRuntimes).map((r) => [r.name, r.state]))
  return items(data.value?.configs).map((config) => {
    const runtime = runtimes.get(config.name)
    const jvm = runtime?.JVMRuntime
    return {
      name: config.name,
      state: runtime?.state || lifecycles.get(config.name) || 'SHUTDOWN',
      health: runtime?.healthState,
      cluster: targetNames(config.cluster)[0] || '—',
      machine: targetNames(config.machine)[0] || '—',
      listen: `${config.listenAddress || 'localhost'}:${config.listenPort ?? '—'}`,
      heapUsed: jvm ? Number(jvm.heapSizeCurrent || 0) - Number(jvm.heapFreeCurrent || 0) : null,
      heapMax: jvm ? Number(jvm.heapSizeMax || 0) : null,
      uptime: jvm?.uptime ?? null,
      threads: runtime?.threadPoolRuntime?.executeThreadTotalCount ?? null,
      stuck: runtime?.threadPoolRuntime?.stuckThreadCount ?? null,
      version: runtime?.weblogicVersion || '',
    }
  })
})

const COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Server'),
    hint: t('The configured server name, with the WebLogic version it reports underneath while it is running.'),
  },
  {
    key: 'state',
    label: t('State'),
    hint: t(
      'RUNNING serves traffic; ADMIN accepts only administration requests; STANDBY is started but idle; SHUTDOWN is stopped; FAILED needs attention. The second badge is the health the server reports about itself.',
    ),
  },
  {
    key: 'cluster',
    label: t('Cluster'),
    hint: t('The cluster this server belongs to, or — for a standalone server.'),
  },
  {
    key: 'listen',
    label: t('Listen address'),
    hint: t('Where the server accepts requests. This is also the port used for T3 and for the management REST API.'),
  },
  {
    key: 'heapUsed',
    label: t('Heap'),
    align: 'right',
    hint: t(
      'Java heap in use against the JVM maximum (-Xmx). Rising steadily and never dropping after a garbage collection suggests a leak.',
    ),
  },
  {
    key: 'uptime',
    label: t('Uptime'),
    align: 'right',
    hint: t(
      'How long the JVM has been up. A short uptime on a server you did not restart means it crashed and was restarted.',
    ),
  },
  {
    key: 'threads',
    label: t('Threads'),
    align: 'right',
    hint: t(
      'Execute threads in the self-tuning pool, with the stuck count in red when there is one. Stuck threads have been busy longer than the configured timeout.',
    ),
  },
  { key: 'actions', label: '', sortable: false, align: 'right' },
])
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Servers')"
      :subtitle="$t('Lifecycle and runtime state of every configured server')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'One row per configured server. The buttons on the right offer only the lifecycle operations that are valid for the server\'s current state, and each one asks for confirmation before it runs.',
        )
      "
      @refresh="reload"
    />

    <HelpPanel id="servers" :title="$t('How to start, stop or restart a server')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>{{ $t('Find the row, and read its State badge — the available buttons follow from it.') }}</li>
        <li>
          {{
            $t(
              'Start boots a stopped server, Suspend moves a running one to ADMIN so it finishes current work but takes no new traffic, Resume brings it back, and Shutdown stops it gracefully.',
            )
          }}
        </li>
        <li>
          {{ $t('Confirm in the dialog. The state column then moves through STARTING or SHUTTING DOWN on its own.') }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'To restart: Shutdown, wait for SHUTDOWN, then Start. Force shutdown kills the process and loses in-flight work — keep it for a server that will not stop otherwise.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'Starting needs a running Node Manager on that server\'s machine. If Start fails immediately, that is almost always the reason.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'To act on several servers at once — a whole cluster, say — tick them on the left and use the buttons that appear above the table. They are requested one after another, and any that fail are named individually.',
          )
        }}
      </p>
    </HelpPanel>

    <DataTable
      v-model:selected="selected"
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      state-key="main"
      export-name="servers"
      selectable
      :empty-text="$t('No servers are configured in this domain.')"
      :search-placeholder="$t('Filter servers…')"
      :search-hint="
        $t(
          'Keeps the rows whose name, state, cluster or listen address contain this text. Useful on a domain with dozens of managed servers.',
        )
      "
      @retry="reload"
    >
      <!-- Selection turns the toolbar into "do this to all of them", which is
           the difference between restarting a cluster in one step and in ten. -->
      <template #toolbar>
        <div v-if="selected.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {{ $t('{count} selected', { count: selected.length }) }}
          </span>
          <button
            v-for="action in bulkActions()"
            :key="action.action"
            :class="['btn px-2 py-1 text-xs', action.danger ? 'btn-danger' : 'btn-ghost']"
            :title="actionDescriptions()[action.action]"
            @click="runBulk(action)"
          >
            {{ action.label }}
          </button>
          <button
            class="btn btn-ghost px-2 py-1 text-xs"
            :title="$t('Clear the selection')"
            @click="selected = []"
          >
            {{ $t('Clear') }}
          </button>
        </div>
      </template>
      <template #cell:name="{ row }">
        <RouterLink
          :to="{ name: 'server-detail', params: { name: row.name } }"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          :title="$t('Open this server: runtime detail and every setting it has')"
        >
          {{ row.name }}
        </RouterLink>
        <div v-if="row.version" class="text-xs text-zinc-400 dark:text-zinc-500">{{ row.version }}</div>
      </template>

      <template #cell:state="{ row }">
        <div class="flex items-center gap-2">
          <StateBadge :state="row.state" />
          <StateBadge v-if="row.health" kind="health" :health="row.health" />
        </div>
      </template>

      <template #cell:listen="{ row }">
        <span class="font-mono text-xs">{{ row.listen }}</span>
      </template>

      <template #cell:heapUsed="{ row }">
        <span v-if="row.heapUsed === null" class="text-zinc-400">—</span>
        <span v-else class="tabular-nums">{{ bytes(row.heapUsed) }} / {{ bytes(row.heapMax) }}</span>
      </template>

      <template #cell:uptime="{ row }">
        <span class="tabular-nums">{{ row.uptime === null ? '—' : duration(row.uptime) }}</span>
      </template>

      <template #cell:threads="{ row }">
        <span class="tabular-nums">{{ num(row.threads) }}</span>
        <span v-if="row.stuck > 0" class="ml-1 text-xs font-medium text-red-500">
          {{ $t('({count} stuck)', { count: row.stuck }) }}
        </span>
      </template>

      <template #cell:actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <button
            v-for="action in actionsFor(row.state)"
            :key="action.action"
            :class="['btn', action.danger ? 'btn-danger' : 'btn-ghost', 'px-2 py-1 text-xs']"
            :title="actionDescriptions()[action.action]"
            :disabled="busyServer === row.name"
            @click="run(row.name, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
    </DataTable>

    <p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
      {{
        $t(
          'Starting a stopped server requires a running Node Manager on its machine; the AdminServer itself can only be stopped, not started, from here.',
        )
      }}
    </p>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
