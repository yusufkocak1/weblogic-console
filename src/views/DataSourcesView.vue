<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import HelpPanel from '@/components/HelpPanel.vue'

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
  {
    key: 'name',
    label: 'Data source',
    hint: 'The data source name, with its JDBC URL underneath. Applications look it up by JNDI name, not by this one.',
  },
  {
    key: 'state',
    label: 'State',
    hint: 'Running means the pool is up on at least one server. Suspended or Overloaded means the pool exists but is not usable. "Not deployed" means no target server is running it.',
  },
  {
    key: 'active',
    label: 'Active',
    align: 'right',
    hint: 'Connections currently checked out by application code, summed over every server. Sitting at the pool maximum means requests are queueing for a connection.',
  },
  {
    key: 'current',
    label: 'Pool size',
    align: 'right',
    hint: 'Connections the pool holds right now, with the configured initial – maximum capacity in brackets. WebLogic grows the pool towards the maximum under load.',
  },
  {
    key: 'waiting',
    label: 'Waiting',
    align: 'right',
    hint: 'Threads blocked waiting for a free connection. Anything above zero means the pool is too small or queries are too slow.',
  },
  {
    key: 'targets',
    label: 'Targets',
    hint: 'The servers and clusters this data source is deployed to. A data source only has runtime numbers where it is targeted.',
  },
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
      help="Every JDBC data source in the domain with its live connection pool numbers. Counts are summed across all servers the data source is targeted to."
      @refresh="reload"
    />

    <HelpPanel id="data-sources" title="How to check whether a database connection is healthy">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          Press <strong>Test</strong> on the row. It borrows a real connection from the pool on one running server and
          runs the configured test query, so a pass proves the database is genuinely reachable with these credentials.
        </li>
        <li>
          A failure toast carries the JDBC error itself — <em>ORA-01017</em> is a wrong password,
          <em>ORA-12541</em> or a connection refused is a listener or firewall problem.
        </li>
        <li>
          If <strong>Waiting</strong> is above zero, or <strong>Active</strong> is stuck at the maximum in brackets,
          the pool is the bottleneck rather than the database.
        </li>
      </ol>
      <p>Test needs at least one target server running — a data source with no runtime instance cannot be tested.</p>
    </HelpPanel>

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="No JDBC data sources are configured."
      search-placeholder="Filter data sources…"
      search-hint="Matches the data source name, state and targets of the rows already loaded."
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <RouterLink
          :to="{ name: 'data-source-detail', params: { name: row.name } }"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          title="Open this data source: live pool figures and every setting it has"
        >
          {{ row.name }}
        </RouterLink>
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
        <span
          class="ml-1 text-xs text-zinc-400 dark:text-zinc-500"
          title="Configured initial – maximum capacity of this pool"
        >
          ({{ row.capacity }})
        </span>
      </template>

      <template #cell:waiting="{ row }">
        <span :class="['tabular-nums', row.waiting > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
          {{ num(row.waiting) }}
        </span>
      </template>

      <template #cell:actions="{ row }">
        <button
          class="btn btn-ghost px-2 py-1 text-xs"
          title="Borrow a connection from this pool and run its test query against the database. Read-only and safe to press at any time."
          :disabled="testing === row.name"
          @click="testPool(row)"
        >
          {{ testing === row.name ? 'Testing…' : 'Test' }}
        </button>
      </template>
    </DataTable>
  </div>
</template>
