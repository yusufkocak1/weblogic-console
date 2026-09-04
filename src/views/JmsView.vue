<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { bytes, healthOf, items, num } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import StatCard from '@/components/StatCard.vue'
import HelpPanel from '@/components/HelpPanel.vue'

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
  {
    key: 'name',
    label: 'JMS server',
    hint: 'A JMS server hosts destinations and their message store. The WebLogic server it runs on is shown underneath.',
  },
  { key: 'health', label: 'Health', hint: 'Health of this JMS server. Anything but OK means messaging on it is degraded.' },
  { key: 'current', label: 'Current', align: 'right', hint: 'Messages sitting in the destination right now, waiting to be consumed. A number that keeps growing means consumers are slower than producers, or have stopped.' },
  { key: 'pending', label: 'Pending', align: 'right', hint: 'Messages sent or received inside a transaction that has not committed yet, plus messages awaiting acknowledgement. A persistently high value points at consumers that never acknowledge or transactions that never commit.' },
  { key: 'high', label: 'High', align: 'right', hint: 'The highest current count reached since the server started. Useful for spotting a backlog that has already drained.' },
  {
    key: 'received',
    label: 'Received',
    align: 'right',
    hint: 'Total messages this JMS server has taken in since it started. It only ever grows; the rate it grows at is the interesting part.',
  },
  {
    key: 'bytesCurrent',
    label: 'Bytes',
    align: 'right',
    hint: 'Size of the messages currently held. Watch it against the quota configured for the store.',
  },
  { key: 'destinations', label: 'Destinations', align: 'right', hint: 'Queues and topics hosted by this JMS server.' },
]

const DEST_COLUMNS = [
  {
    key: 'name',
    label: 'Destination',
    hint: 'A queue or topic. This is the name applications look up in JNDI to send and receive messages.',
  },
  { key: 'jmsServer', label: 'JMS server', hint: 'The JMS server hosting this destination.' },
  { key: 'current', label: 'Current', align: 'right', hint: 'Messages sitting in the destination right now, waiting to be consumed. A number that keeps growing means consumers are slower than producers, or have stopped.' },
  { key: 'pending', label: 'Pending', align: 'right', hint: 'Messages sent or received inside a transaction that has not committed yet, plus messages awaiting acknowledgement. A persistently high value points at consumers that never acknowledge or transactions that never commit.' },
  { key: 'high', label: 'High', align: 'right', hint: 'The highest current count reached since the server started. Useful for spotting a backlog that has already drained.' },
  {
    key: 'consumers',
    label: 'Consumers',
    align: 'right',
    hint: 'Clients or MDBs currently listening on this destination. Zero consumers with a rising Current count is the classic stuck-queue signature.',
  },
  { key: 'bytesCurrent', label: 'Bytes', align: 'right', hint: 'Size of the messages currently held on this destination.' },
]
</script>

<template>
  <div>
    <PageHeader
      title="JMS"
      subtitle="Messaging runtime across every running server"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="Live JMS numbers gathered from every running server. This page is runtime only - a JMS server on a stopped WebLogic server does not appear at all."
      @refresh="reload"
    />

    <HelpPanel id="jms" title="How to tell whether messages are stuck">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          Look at <strong>Messages pending</strong> above. Zero is the healthy state on most domains; a number that
          stays high means something is not completing.
        </li>
        <li>
          Scroll to <strong>Destinations</strong> and sort by <strong>Current</strong> to find the queue holding the
          backlog.
        </li>
        <li>
          Check that queue's <strong>Consumers</strong>. Zero consumers means the listener or MDB is down - look at
          Deployments, then Logs on the server named under the destination.
        </li>
      </ol>
      <p>Every column header here has its own info icon explaining what that counter actually measures.</p>
    </HelpPanel>

    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="JMS servers"
        :value="num(jmsServers.length)"
        info="JMS servers running right now across the domain. Each one hosts destinations and owns their message store."
      />
      <StatCard
        label="Destinations"
        :value="num(destinations.length)"
        info="Queues and topics currently available across all JMS servers."
      />
      <StatCard
        label="Messages current"
        :value="num(totals.current)"
        info="Messages held across every destination right now. A steady number is normal traffic; a number that only climbs is a backlog."
      />
      <StatCard
        label="Messages pending"
        :value="num(totals.pending)"
        :tone="totals.pending > 0 ? 'warn' : 'good'"
        info="Messages inside uncommitted transactions or awaiting acknowledgement. This is usually the first place a messaging problem shows up."
      />
    </div>

    <DataTable
      :columns="SERVER_COLUMNS"
      :rows="jmsServers"
      row-key="key"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="No JMS servers are running. Only running servers report JMS runtime."
      search-placeholder="Filter JMS servers…"
      search-hint="Matches the JMS server name and the WebLogic server hosting it."
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
      <DataTable
        :columns="DEST_COLUMNS"
        :rows="destinations"
        row-key="key"
        dense
        search-placeholder="Filter destinations…"
        search-hint="Matches the destination name, its JMS server and the WebLogic server hosting it."
      >
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
