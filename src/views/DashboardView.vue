<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useConnectionStore } from '@/stores/connection'
import { bytes, duration, healthOf, items, num, since } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StateBadge from '@/components/StateBadge.vue'
import MeterBar from '@/components/MeterBar.vue'
import ErrorState from '@/components/ErrorState.vue'

const connection = useConnectionStore()

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [snapshot, servers, clusters, deployments] = await Promise.all([
    wls.runtimeSnapshot({ signal }),
    wls.configuredServers({ signal }),
    wls.clusters({ signal }),
    wls.appDeployments({ signal }),
  ])
  return { snapshot, servers, clusters, deployments }
})

/** Merge the configured server list with whatever runtime exists for each one. */
const servers = computed(() => {
  const runtimes = new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r]))
  const lifecycles = new Map(items(data.value?.snapshot?.serverLifeCycleRuntimes).map((r) => [r.name, r.state]))
  return items(data.value?.servers).map((config) => {
    const runtime = runtimes.get(config.name)
    return {
      name: config.name,
      state: runtime?.state || lifecycles.get(config.name) || 'SHUTDOWN',
      health: runtime?.healthState,
      listen: `${config.listenAddress || 'localhost'}:${config.listenPort ?? '—'}`,
      uptime: runtime?.activationTime ? since(runtime.activationTime) : null,
      jvm: runtime?.JVMRuntime || null,
      threads: runtime?.threadPoolRuntime || null,
      sockets: runtime?.openSocketsCurrentCount,
    }
  })
})

const runningCount = computed(() => servers.value.filter((s) => s.state === 'RUNNING').length)
const unhealthy = computed(() => servers.value.filter((s) => s.state === 'RUNNING' && healthOf(s.health) !== 'OK'))
const stuckThreads = computed(() =>
  servers.value.reduce((total, s) => total + Number(s.threads?.stuckThreadCount || 0), 0),
)

const serversTone = computed(() => {
  if (!servers.value.length) return 'default'
  if (runningCount.value === servers.value.length) return 'good'
  return runningCount.value === 0 ? 'bad' : 'warn'
})
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      :subtitle="`${connection.domainName} · ${connection.baseUrl}`"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Servers running"
          :value="`${runningCount} / ${servers.length}`"
          :tone="serversTone"
          :hint="loading && !data ? 'Loading…' : 'Configured servers in this domain'"
        />
        <StatCard label="Clusters" :value="num(items(data?.clusters).length)" hint="Configured clusters" />
        <StatCard label="Deployments" :value="num(items(data?.deployments).length)" hint="Applications and modules" />
        <StatCard
          label="Stuck threads"
          :value="num(stuckThreads)"
          :tone="stuckThreads > 0 ? 'bad' : 'good'"
          hint="Across all running servers"
        />
      </div>

      <div
        v-if="unhealthy.length"
        class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong>{{ unhealthy.length }}</strong> running
        {{ unhealthy.length === 1 ? 'server is' : 'servers are' }} not reporting healthy:
        {{ unhealthy.map((s) => s.name).join(', ') }}
      </div>

      <h2 class="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Servers</h2>

      <div v-if="!servers.length && loading" class="card p-8 text-center text-sm text-zinc-400">Loading servers…</div>
      <div v-else-if="!servers.length" class="card p-8 text-center text-sm text-zinc-400">
        No servers are configured in this domain.
      </div>

      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="server in servers"
          :key="server.name"
          :to="{ name: 'servers', query: { server: server.name } }"
          class="card p-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-semibold text-zinc-900 dark:text-zinc-50">{{ server.name }}</p>
              <p class="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ server.listen }}</p>
            </div>
            <StateBadge :state="server.state" />
          </div>

          <div v-if="server.jvm" class="mt-4 space-y-3">
            <MeterBar
              :value="Number(server.jvm.heapSizeCurrent || 0) - Number(server.jvm.heapFreeCurrent || 0)"
              :max="Number(server.jvm.heapSizeMax || server.jvm.heapSizeCurrent || 1)"
              :label="`Heap ${bytes(Number(server.jvm.heapSizeCurrent || 0) - Number(server.jvm.heapFreeCurrent || 0))} of ${bytes(server.jvm.heapSizeMax)}`"
            />
            <dl class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt class="text-zinc-400 dark:text-zinc-500">Uptime</dt>
                <dd class="tabular-nums text-zinc-700 dark:text-zinc-200">{{ duration(server.jvm.uptime) }}</dd>
              </div>
              <div>
                <dt class="text-zinc-400 dark:text-zinc-500">Threads</dt>
                <dd class="tabular-nums text-zinc-700 dark:text-zinc-200">
                  {{ num(server.threads?.executeThreadTotalCount) }}
                </dd>
              </div>
              <div>
                <dt class="text-zinc-400 dark:text-zinc-500">Health</dt>
                <dd class="text-zinc-700 dark:text-zinc-200">{{ healthOf(server.health) }}</dd>
              </div>
            </dl>
          </div>
          <p v-else class="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
            No runtime data — the server is not running.
          </p>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
