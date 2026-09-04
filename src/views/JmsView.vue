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

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [jms, infrastructure] = await Promise.all([
    wls.jmsRuntimes({ signal }),
    // What JMS runs on is a separate read: an older release missing one of
    // these trees must not take the message counters down with it.
    wls.messagingRuntimes({ signal }).catch((err) => {
      if (err?.name === 'AbortError' || err?.isAuthError) throw err
      return null
    }),
  ])
  return { ...jms, infrastructure }
})

/** Attribute names differ between releases; take the first one that exists. */
const pick = (source, ...names) => {
  for (const name of names) {
    const value = source?.[name]
    if (value !== undefined && value !== null) return Number(value)
  }
  return 0
}

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

// --- what the messaging actually runs on ------------------------------------

const infrastructure = computed(() => items(data.value?.infrastructure?.serverRuntimes))

/**
 * Persistent stores. A queue is only as reliable as the store under it, and a
 * store filling up or writing slowly shows here long before the queue does.
 */
const stores = computed(() => {
  const rows = []
  for (const server of infrastructure.value) {
    for (const store of items(server.persistentStoreRuntimes)) {
      rows.push({
        key: `${server.name}/${store.name}`,
        name: store.name,
        server: server.name,
        objects: pick(store, 'objectCount'),
        creates: pick(store, 'createCount'),
        reads: pick(store, 'readCount'),
        writes: pick(store, 'writeCount', 'physicalWriteCount'),
        deletes: pick(store, 'deleteCount'),
      })
    }
  }
  return rows
})

/** SAF agents forward messages to another domain when it is unreachable. */
const safAgents = computed(() => {
  const rows = []
  for (const server of infrastructure.value) {
    for (const agent of items(server.SAFRuntime?.agents)) {
      rows.push({
        key: `${server.name}/${agent.name}`,
        name: agent.name,
        server: server.name,
        type: agent.agentType || '—',
        current: pick(agent, 'messagesCurrentCount'),
        pending: pick(agent, 'messagesPendingCount'),
        received: pick(agent, 'messagesReceivedCount'),
        failed: pick(agent, 'failedMessagesTotal', 'failedMessagesCount'),
      })
    }
  }
  return rows
})

/** Bridges link a WebLogic destination to another JMS provider. */
const bridges = computed(() => {
  const rows = []
  for (const server of infrastructure.value) {
    for (const bridge of items(server.messagingBridgeRuntimes)) {
      rows.push({
        key: `${server.name}/${bridge.name}`,
        name: bridge.name,
        server: server.name,
        state: bridge.state || bridge.status || '—',
        description: bridge.description || '',
      })
    }
  }
  return rows
})

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

const STORE_COLUMNS = [
  {
    key: 'name',
    label: 'Store',
    hint: 'Where persistent messages and transaction records are kept — a file store on disk or a JDBC store in a database. A JMS server is only as reliable as its store.',
  },
  { key: 'server', label: 'Server', hint: 'The server this store is open on.' },
  {
    key: 'objects',
    label: 'Objects',
    align: 'right',
    hint: 'Records the store currently holds. A number that only grows means something is being written and never acknowledged.',
  },
  { key: 'writes', label: 'Writes', align: 'right', hint: 'Records written since the store opened.' },
  { key: 'reads', label: 'Reads', align: 'right', hint: 'Records read back, usually during recovery or redelivery.' },
  { key: 'deletes', label: 'Deletes', align: 'right', hint: 'Records removed once their message was consumed.' },
]

const SAF_COLUMNS = [
  {
    key: 'name',
    label: 'SAF agent',
    hint: 'Store-and-forward keeps messages locally when the remote domain cannot be reached, and sends them when it can. A rising pending count means the far end is unreachable.',
  },
  { key: 'server', label: 'Server', hint: 'The server this agent runs on.' },
  { key: 'type', label: 'Type', hint: 'Sending, receiving or both.' },
  { key: 'current', label: 'Current', align: 'right', hint: 'Messages the agent is holding right now.' },
  {
    key: 'pending',
    label: 'Pending',
    align: 'right',
    hint: 'Messages waiting to be forwarded. Sustained above zero means the remote destination is not accepting them.',
  },
  { key: 'received', label: 'Received', align: 'right', hint: 'Messages taken in since the server started.' },
  {
    key: 'failed',
    label: 'Failed',
    align: 'right',
    hint: 'Messages the agent gave up on, according to its retry and expiry policy. These are gone unless an error destination was configured.',
  },
]

const BRIDGE_COLUMNS = [
  {
    key: 'name',
    label: 'Bridge',
    hint: 'A messaging bridge copies messages between a WebLogic destination and another provider — a second domain, or a third-party broker.',
  },
  { key: 'server', label: 'Server', hint: 'The server running this bridge.' },
  {
    key: 'state',
    label: 'State',
    hint: 'Active means it is forwarding. A bridge that will not leave its starting state usually cannot reach one of its two ends.',
  },
  { key: 'description', label: 'Description' },
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
      <p>
        Below the destinations are the things messaging depends on: the <strong>persistent stores</strong> that hold
        messages on disk or in a database, the <strong>SAF agents</strong> holding messages for a domain that cannot
        be reached, and the <strong>bridges</strong> to other providers. A backlog with no obvious cause is often a
        store that has stopped keeping up.
      </p>
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
      state-key="main"
      export-name="jms-servers"
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
        state-key="dest"
        export-name="jms-destinations"
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

    <template v-if="stores.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Persistent stores
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          — where persistent messages and transaction records actually live
        </span>
      </h2>
      <DataTable
        :columns="STORE_COLUMNS"
        :rows="stores"
        row-key="key"
        state-key="stores"
        export-name="persistent-stores"
        dense
        search-placeholder="Filter stores…"
        search-hint="Matches the store name and the server it is open on."
      >
        <template #cell:objects="{ row }"><span class="tabular-nums">{{ num(row.objects) }}</span></template>
        <template #cell:writes="{ row }"><span class="tabular-nums">{{ num(row.writes) }}</span></template>
        <template #cell:reads="{ row }"><span class="tabular-nums">{{ num(row.reads) }}</span></template>
        <template #cell:deletes="{ row }"><span class="tabular-nums">{{ num(row.deletes) }}</span></template>
      </DataTable>
    </template>

    <template v-if="safAgents.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Store-and-forward agents
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          — messages held for a domain that cannot be reached right now
        </span>
      </h2>
      <DataTable
        :columns="SAF_COLUMNS"
        :rows="safAgents"
        row-key="key"
        state-key="saf"
        export-name="saf-agents"
        dense
        search-placeholder="Filter agents…"
        search-hint="Matches the agent name, its type and the server it runs on."
      >
        <template #cell:current="{ row }"><span class="tabular-nums">{{ num(row.current) }}</span></template>
        <template #cell:pending="{ row }">
          <span :class="['tabular-nums', row.pending > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
            {{ num(row.pending) }}
          </span>
        </template>
        <template #cell:received="{ row }"><span class="tabular-nums">{{ num(row.received) }}</span></template>
        <template #cell:failed="{ row }">
          <span :class="['tabular-nums', row.failed > 0 && 'font-semibold text-red-600 dark:text-red-400']">
            {{ num(row.failed) }}
          </span>
        </template>
      </DataTable>
    </template>

    <template v-if="bridges.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Messaging bridges
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          — links between this domain's destinations and another provider
        </span>
      </h2>
      <DataTable
        :columns="BRIDGE_COLUMNS"
        :rows="bridges"
        row-key="key"
        state-key="bridges"
        export-name="messaging-bridges"
        dense
        search-placeholder="Filter bridges…"
        search-hint="Matches the bridge name, state and the server it runs on."
      >
        <template #cell:state="{ row }"><StateBadge :state="String(row.state).toUpperCase()" /></template>
        <template #cell:description="{ row }">
          <span class="text-xs text-zinc-500 dark:text-zinc-400">{{ row.description || '—' }}</span>
        </template>
      </DataTable>
    </template>

    <p
      v-if="data && !data.infrastructure"
      class="mt-3 text-xs text-zinc-400 dark:text-zinc-500"
    >
      Persistent stores, SAF agents and bridges could not be read from this domain — that part of the runtime tree is
      not exposed by this WebLogic release.
    </p>
  </div>
</template>
