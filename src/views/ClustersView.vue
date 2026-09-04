<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import ErrorState from '@/components/ErrorState.vue'

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes, snapshot] = await Promise.all([
    wls.clusters({ signal }),
    wls.clusterRuntimes({ signal }),
    wls.runtimeSnapshot({ signal }),
  ])
  return { configs, runtimes, snapshot }
})

/**
 * There is no domain-wide ClusterRuntime: each member server reports its own
 * view of the cluster, so the per-server runtimes are grouped by cluster name.
 */
const clusters = computed(() => {
  const states = new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r.state]))
  const byCluster = new Map()
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    const runtime = server.clusterRuntime
    if (!runtime?.name) continue
    if (!byCluster.has(runtime.name)) byCluster.set(runtime.name, [])
    byCluster.get(runtime.name).push({ server: server.name, ...runtime })
  }

  return items(data.value?.configs).map((config) => {
    const members = targetNames(config.servers)
    const memberRuntimes = byCluster.get(config.name) || []
    return {
      name: config.name,
      messagingMode: config.clusterMessagingMode || '—',
      address: config.clusterAddress || (config.multicastAddress ? `${config.multicastAddress}:${config.multicastPort}` : '—'),
      members: members.length ? members : memberRuntimes.map((m) => m.server),
      alive: memberRuntimes[0]?.aliveServerCount ?? memberRuntimes.length,
      primaries: memberRuntimes.reduce((sum, m) => sum + Number(m.primaryCount || 0), 0),
      secondaries: memberRuntimes.reduce((sum, m) => sum + Number(m.secondaryCount || 0), 0),
      resends: memberRuntimes.reduce((sum, m) => sum + Number(m.resendRequestsCount || 0), 0),
      states,
    }
  })
})
</script>

<template>
  <div>
    <PageHeader
      title="Clusters"
      subtitle="Membership and replication state"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />
    <div v-else-if="loading && !clusters.length" class="card p-8 text-center text-sm text-zinc-400">Loading…</div>
    <div v-else-if="!clusters.length" class="card p-8 text-center text-sm text-zinc-400">
      No clusters are configured in this domain.
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <section v-for="cluster in clusters" :key="cluster.name" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-zinc-900 dark:text-zinc-50">{{ cluster.name }}</h2>
            <p class="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ cluster.address }}</p>
          </div>
          <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {{ cluster.messagingMode }}
          </span>
        </div>

        <dl class="mt-4 grid grid-cols-4 gap-3 text-sm">
          <div>
            <dt class="text-xs text-zinc-400 dark:text-zinc-500">Alive</dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.alive) }} / {{ cluster.members.length }}</dd>
          </div>
          <div>
            <dt class="text-xs text-zinc-400 dark:text-zinc-500">Primaries</dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.primaries) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-zinc-400 dark:text-zinc-500">Secondaries</dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.secondaries) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-zinc-400 dark:text-zinc-500">Resends</dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.resends) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="member in cluster.members"
            :key="member"
            class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-800"
          >
            {{ member }}
            <StateBadge :state="cluster.states.get(member) || 'SHUTDOWN'" />
          </span>
        </div>
      </section>
    </div>
  </div>
</template>
