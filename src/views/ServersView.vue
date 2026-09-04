<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { bytes, duration, items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = useUiStore()
const confirm = ref(null)
const busyServer = ref(null)

const { data, error, refreshing, loading, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [snapshot, configs] = await Promise.all([wls.runtimeSnapshot({ signal }), wls.configuredServers({ signal })])
  return { snapshot, configs }
})

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

const COLUMNS = [
  { key: 'name', label: 'Server' },
  { key: 'state', label: 'State' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'listen', label: 'Listen address' },
  { key: 'heapUsed', label: 'Heap', align: 'right' },
  { key: 'uptime', label: 'Uptime', align: 'right' },
  { key: 'threads', label: 'Threads', align: 'right' },
  { key: 'actions', label: '', sortable: false, align: 'right' },
]

/** Which lifecycle operations make sense for a given state. */
function actionsFor(state) {
  switch (state) {
    case 'RUNNING':
      return [
        { action: 'suspend', label: 'Suspend' },
        { action: 'shutdown', label: 'Shutdown', danger: true },
      ]
    case 'ADMIN':
    case 'STANDBY':
      return [
        { action: 'resume', label: 'Resume' },
        { action: 'shutdown', label: 'Shutdown', danger: true },
      ]
    case 'SHUTDOWN':
    case 'FAILED_NOT_RESTARTABLE':
      return [{ action: 'start', label: 'Start' }]
    case 'FAILED':
      return [
        { action: 'start', label: 'Start' },
        { action: 'forceShutdown', label: 'Force shutdown', danger: true },
      ]
    default:
      return [{ action: 'forceShutdown', label: 'Force shutdown', danger: true }]
  }
}

const DESCRIPTIONS = {
  start: 'Node Manager must be running on the target machine for a server to start.',
  shutdown: 'The server stops accepting new work and shuts down gracefully.',
  forceShutdown: 'The server is killed immediately. In-flight work is lost.',
  suspend: 'The server moves to ADMIN state and stops serving application traffic.',
  resume: 'The server returns to RUNNING and resumes serving traffic.',
}

async function runAction(row, { action, label, danger }) {
  const ok = await confirm.value.ask({
    title: `${label} ${row.name}?`,
    body: DESCRIPTIONS[action] || '',
    confirmLabel: label,
    danger: Boolean(danger),
  })
  if (!ok) return

  busyServer.value = row.name
  try {
    await wls.serverAction(row.name, action)
    ui.success(`${label} requested`, `${row.name} is transitioning — the state column updates as it changes.`)
    // Lifecycle changes take a moment to show up in the runtime tree.
    setTimeout(reload, 1500)
  } catch (err) {
    ui.error(`${label} failed on ${row.name}`, err.fullText || err.message)
  } finally {
    busyServer.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Servers"
      subtitle="Lifecycle and runtime state of every configured server"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="No servers are configured in this domain."
      search-placeholder="Filter servers…"
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
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
        <span v-if="row.stuck > 0" class="ml-1 text-xs font-medium text-red-500">({{ row.stuck }} stuck)</span>
      </template>

      <template #cell:actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <button
            v-for="action in actionsFor(row.state)"
            :key="action.action"
            :class="['btn', action.danger ? 'btn-danger' : 'btn-ghost', 'px-2 py-1 text-xs']"
            :disabled="busyServer === row.name"
            @click="runAction(row, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
    </DataTable>

    <p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
      Starting a stopped server requires a running Node Manager on its machine; the AdminServer itself can only be
      stopped, not started, from here.
    </p>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
