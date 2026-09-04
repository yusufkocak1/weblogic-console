<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'

const ui = useUiStore()
const testing = ref(null)

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes] = await Promise.all([wls.dataSourceConfigs({ signal }), wls.dataSourceRuntimes({ signal })])
  return { configs, runtimes }
})

/** Pool statistics are per server, so they are summed across the domain. */
const runtimeIndex = computed(() => {
  const index = new Map()
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const ds of items(server.JDBCServiceRuntime?.JDBCDataSourceRuntimeMBeans)) {
      if (!index.has(ds.name)) index.set(ds.name, [])
      index.get(ds.name).push({ server: server.name, ...ds })
    }
  }
  return index
})

const rows = computed(() =>
  items(data.value?.configs?.JDBCSystemResources).map((resource) => {
    const jdbc = resource.JDBCResource || {}
    const pool = jdbc.JDBCConnectionPoolParams || {}
    const instances = runtimeIndex.value.get(resource.name) || []
    const sum = (field) => instances.reduce((total, i) => total + Number(i[field] || 0), 0)
    return {
      name: resource.name,
      url: jdbc.JDBCDriverParams?.url || '—',
      driver: jdbc.JDBCDriverParams?.driverName || '—',
      jndi: (jdbc.JDBCDataSourceParams?.JNDINames || []).join(', ') || '—',
      targets: targetNames(resource.targets).join(', ') || '—',
      capacity: `${pool.initialCapacity ?? '?'} – ${pool.maxCapacity ?? '?'}`,
      state: instances.length ? (instances.find((i) => i.state !== 'Running')?.state ?? 'Running') : null,
      active: sum('activeConnectionsCurrentCount'),
      current: sum('currCapacity'),
      waiting: sum('waitingForConnectionCurrentCount'),
      failures: sum('failuresToReconnectCount'),
      instances,
    }
  }),
)

const COLUMNS = [
  { key: 'name', label: 'Data source' },
  { key: 'state', label: 'State' },
  { key: 'active', label: 'Active', align: 'right' },
  { key: 'current', label: 'Pool size', align: 'right' },
  { key: 'waiting', label: 'Waiting', align: 'right' },
  { key: 'targets', label: 'Targets' },
  { key: 'actions', label: '', sortable: false, align: 'right' },
]

async function testPool(row) {
  const instance = row.instances[0]
  if (!instance) {
    ui.info('Nothing to test', `${row.name} has no running instance — start a target server first.`)
    return
  }
  testing.value = row.name
  try {
    // testPool() returns null on success and raises a JDBC error otherwise.
    await wls.testDataSource(instance.server, row.name)
    ui.success('Connection test passed', `${row.name} on ${instance.server}`)
  } catch (err) {
    ui.error(`Connection test failed for ${row.name}`, err.fullText || err.message)
  } finally {
    testing.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Data Sources"
      subtitle="JDBC configuration and live pool statistics"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="No JDBC data sources are configured."
      search-placeholder="Filter data sources…"
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
        <div class="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500" :title="row.url">{{ row.url }}</div>
      </template>

      <template #cell:state="{ row }">
        <StateBadge v-if="row.state" :state="row.state.toUpperCase()" />
        <span v-else class="text-xs text-zinc-400">Not deployed</span>
      </template>

      <template #cell:active="{ row }">
        <span class="tabular-nums">{{ num(row.active) }}</span>
      </template>

      <template #cell:current="{ row }">
        <span class="tabular-nums">{{ num(row.current) }}</span>
        <span class="ml-1 text-xs text-zinc-400 dark:text-zinc-500">({{ row.capacity }})</span>
      </template>

      <template #cell:waiting="{ row }">
        <span :class="['tabular-nums', row.waiting > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
          {{ num(row.waiting) }}
        </span>
      </template>

      <template #cell:actions="{ row }">
        <button class="btn btn-ghost px-2 py-1 text-xs" :disabled="testing === row.name" @click="testPool(row)">
          {{ testing === row.name ? 'Testing…' : 'Test' }}
        </button>
      </template>
    </DataTable>
  </div>
</template>
