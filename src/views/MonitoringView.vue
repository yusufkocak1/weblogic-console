<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { bytes, duration, healthOf, items, num, percent } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import MeterBar from '@/components/MeterBar.vue'
import StateBadge from '@/components/StateBadge.vue'
import ErrorState from '@/components/ErrorState.vue'

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(({ signal }) =>
  wls.runtimeSnapshot({ signal }),
)

const servers = computed(() =>
  items(data.value?.serverRuntimes).map((runtime) => {
    const jvm = runtime.JVMRuntime || {}
    const pool = runtime.threadPoolRuntime || {}
    const heapMax = Number(jvm.heapSizeMax || jvm.heapSizeCurrent || 0)
    const heapUsed = Number(jvm.heapSizeCurrent || 0) - Number(jvm.heapFreeCurrent || 0)
    const total = Number(pool.executeThreadTotalCount || 0)
    return {
      name: runtime.name,
      state: runtime.state,
      health: runtime.healthState,
      version: runtime.weblogicVersion,
      sockets: runtime.openSocketsCurrentCount,
      java: [jvm.javaVersion, jvm.javaVendor].filter(Boolean).join(' · '),
      os: jvm.OSName,
      uptime: jvm.uptime,
      heapUsed,
      heapMax,
      heapCommitted: Number(jvm.heapSizeCurrent || 0),
      heapFreePercent: jvm.heapFreePercent,
      threadsTotal: total,
      threadsIdle: Number(pool.executeThreadIdleCount || 0),
      threadsBusy: Math.max(0, total - Number(pool.executeThreadIdleCount || 0) - Number(pool.standbyThreadCount || 0)),
      hogging: Number(pool.hoggingThreadCount || 0),
      stuck: Number(pool.stuckThreadCount || 0),
      queueLength: Number(pool.queueLength || 0),
      pending: Number(pool.pendingUserRequestCount || 0),
      throughput: pool.throughput,
      poolHealth: pool.healthState,
    }
  }),
)
</script>

<template>
  <div>
    <PageHeader
      title="Monitoring"
      subtitle="JVM memory and thread pool health per running server"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />
    <div v-else-if="loading && !servers.length" class="card p-8 text-center text-sm text-zinc-400">Loading…</div>
    <div v-else-if="!servers.length" class="card p-8 text-center text-sm text-zinc-400">
      No server is running, so there is no runtime to monitor.
    </div>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <section v-for="server in servers" :key="server.name" class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="font-semibold text-zinc-900 dark:text-zinc-50">{{ server.name }}</h2>
            <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {{ server.java || '—' }}<template v-if="server.os"> · {{ server.os }}</template>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <StateBadge :state="server.state" />
            <StateBadge kind="health" :health="server.health" />
          </div>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Heap</p>
            <MeterBar
              :value="server.heapUsed"
              :max="server.heapMax || 1"
              :label="`${bytes(server.heapUsed)} of ${bytes(server.heapMax)}`"
            />
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Committed</dt>
                <dd class="tabular-nums">{{ bytes(server.heapCommitted) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Free of committed</dt>
                <dd class="tabular-nums">{{ percent(server.heapFreePercent) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Uptime</dt>
                <dd class="tabular-nums">{{ duration(server.uptime) }}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Thread pool
            </p>
            <MeterBar
              :value="server.threadsBusy"
              :max="server.threadsTotal || 1"
              :label="`${server.threadsBusy} busy of ${server.threadsTotal}`"
            />
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Idle</dt>
                <dd class="tabular-nums">{{ num(server.threadsIdle) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Hogging / stuck</dt>
                <dd :class="['tabular-nums', server.stuck > 0 && 'font-semibold text-red-500']">
                  {{ num(server.hogging) }} / {{ num(server.stuck) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Queue / pending</dt>
                <dd class="tabular-nums">{{ num(server.queueLength) }} / {{ num(server.pending) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-400 dark:text-zinc-500">Throughput</dt>
                <dd class="tabular-nums">
                  {{ server.throughput === undefined ? '—' : Number(server.throughput).toFixed(1) + ' req/s' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <p class="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          Open sockets {{ num(server.sockets) }} · Pool health {{ healthOf(server.poolHealth) }} ·
          {{ server.version || 'version unknown' }}
        </p>
      </section>
    </div>
  </div>
</template>
