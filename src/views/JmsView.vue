<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { bytes, healthOf, items, num } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import StatCard from '@/components/StatCard.vue'

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(({ signal }) => wls.jmsRuntimes({ signal }))

const jmsServers = computed(() => {
  const rows = []
  for (const server of items(data.value?.serverRuntimes)) {
    for (const jms of items(server.JMSRuntime?.JMSServers)) {
      rows.push({
        key: `${server.name}/${jms.name}`,
        name: jms.name,
        server: server.name,
        health: healthOf(jms.healthState),
        current: Number(jms.messagesCurrentCount || 0),
        pending: Number(jms.messagesPendingCount || 0),
        high: Number(jms.messagesHighCount || 0),
        received: Number(jms.messagesReceivedCount || 0),
        bytesCurrent: Number(jms.bytesCurrentCount || 0),
        destinations: Number(jms.destinationsCurrentCount || 0),
      })
    }
  }
  return rows
})

const destinations = computed(() => {
  const rows = []
  for (const server of items(data.value?.serverRuntimes)) {
    for (const jms of items(server.JMSRuntime?.JMSServers)) {
      for (const dest of items(jms.destinations)) {
        rows.push({
          key: `${server.name}/${jms.name}/${dest.name}`,
          name: dest.name,
          jmsServer: jms.name,
          server: server.name,
          current: Number(dest.messagesCurrentCount || 0),
          pending: Number(dest.messagesPendingCount || 0),
          high: Number(dest.messagesHighCount || 0),
          consumers: Number(dest.consumersCurrentCount || 0),
          bytesCurrent: Number(dest.bytesCurrentCount || 0),
        })
      }
    }
  }
  return rows
})

const totals = computed(() => ({
  current: jmsServers.value.reduce((sum, s) => sum + s.current, 0),
  pending: jmsServers.value.reduce((sum, s) => sum + s.pending, 0),
  bytes: jmsServers.value.reduce((sum, s) => sum + s.bytesCurrent, 0),
}))

const SERVER_COLUMNS = [
  { key: 'name', label: 'JMS server' },
  { key: 'health', label: 'Health' },
  { key: 'current', label: 'Current', align: 'right' },
  { key: 'pending', label: 'Pending', align: 'right' },
  { key: 'high', label: 'High', align: 'right' },
  { key: 'received', label: 'Received', align: 'right' },
  { key: 'bytesCurrent', label: 'Bytes', align: 'right' },
  { key: 'destinations', label: 'Destinations', align: 'right' },
]

const DEST_COLUMNS = [
  { key: 'name', label: 'Destination' },
  { key: 'jmsServer', label: 'JMS server' },
  { key: 'current', label: 'Current', align: 'right' },
  { key: 'pending', label: 'Pending', align: 'right' },
  { key: 'high', label: 'High', align: 'right' },
  { key: 'consumers', label: 'Consumers', align: 'right' },
  { key: 'bytesCurrent', label: 'Bytes', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader
      title="JMS"
      subtitle="Messaging runtime across every running server"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="JMS servers" :value="num(jmsServers.length)" />
      <StatCard label="Destinations" :value="num(destinations.length)" />
      <StatCard label="Messages current" :value="num(totals.current)" />
      <StatCard label="Messages pending" :value="num(totals.pending)" :tone="totals.pending > 0 ? 'warn' : 'good'" />
    </div>

    <DataTable
      :columns="SERVER_COLUMNS"
      :rows="jmsServers"
      row-key="key"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="No JMS servers are running. Only running servers report JMS runtime."
      search-placeholder="Filter JMS servers…"
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
        <div class="text-xs text-zinc-400 dark:text-zinc-500">{{ row.server }}</div>
      </template>
      <template #cell:health="{ row }"><StateBadge kind="health" :health="row.health" /></template>
      <template #cell:current="{ row }"><span class="tabular-nums">{{ num(row.current) }}</span></template>
      <template #cell:pending="{ row }">
        <span :class="['tabular-nums', row.pending > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
          {{ num(row.pending) }}
        </span>
      </template>
      <template #cell:high="{ row }"><span class="tabular-nums">{{ num(row.high) }}</span></template>
      <template #cell:received="{ row }"><span class="tabular-nums">{{ num(row.received) }}</span></template>
      <template #cell:bytesCurrent="{ row }"><span class="tabular-nums">{{ bytes(row.bytesCurrent) }}</span></template>
      <template #cell:destinations="{ row }"><span class="tabular-nums">{{ num(row.destinations) }}</span></template>
    </DataTable>

    <template v-if="destinations.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Destinations
      </h2>
      <DataTable :columns="DEST_COLUMNS" :rows="destinations" row-key="key" dense search-placeholder="Filter destinations…">
        <template #cell:name="{ row }">
          <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
          <div class="text-xs text-zinc-400 dark:text-zinc-500">{{ row.server }}</div>
        </template>
        <template #cell:current="{ row }"><span class="tabular-nums">{{ num(row.current) }}</span></template>
        <template #cell:pending="{ row }">
          <span :class="['tabular-nums', row.pending > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
            {{ num(row.pending) }}
          </span>
        </template>
        <template #cell:high="{ row }"><span class="tabular-nums">{{ num(row.high) }}</span></template>
        <template #cell:consumers="{ row }"><span class="tabular-nums">{{ num(row.consumers) }}</span></template>
        <template #cell:bytesCurrent="{ row }"><span class="tabular-nums">{{ bytes(row.bytesCurrent) }}</span></template>
      </DataTable>
    </template>
  </div>
</template>
