<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { bytes, duration, healthOf, items, num, percent } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import MeterBar from '@/components/MeterBar.vue'
import StateBadge from '@/components/StateBadge.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'

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
      help="One card per running server, with the two things that explain most WebLogic slowdowns: how much heap the JVM is using, and how busy its request thread pool is. Only running servers appear here."
      @refresh="reload"
    />

    <HelpPanel id="monitoring" title="How to work out why a server feels slow">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          <strong>Heap red or amber and staying there?</strong> The JVM is short of memory. It will spend its time in
          garbage collection long before it throws OutOfMemoryError, so this shows up as slowness first.
        </li>
        <li>
          <strong>Stuck above zero?</strong> Requests are blocked on something outside the server - a database, a
          remote call, a lock. Check Data Sources for waiting connections, then read Logs on that server.
        </li>
        <li>
          <strong>Thread pool bar near full with a growing queue?</strong> More work is arriving than the server can
          finish. Look for a slow downstream system before adding capacity.
        </li>
      </ol>
      <p>
        Turn auto-refresh on in the top bar and watch for a minute: the direction these numbers move in tells you
        more than any single reading.
      </p>
    </HelpPanel>

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
            <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Heap
              <InfoTip
                heading="Java heap"
                text="Memory available to application objects. WebLogic reports what is committed now and the maximum the JVM may grow to (-Xmx). Used memory sawtooths as garbage collection runs; what matters is whether the low points keep rising."
              />
            </p>
            <MeterBar
              tip="Heap in use against the JVM maximum. Amber past 75%, red past 90%. A bar that never drops after garbage collection is the classic memory-leak shape."
              :value="server.heapUsed"
              :max="server.heapMax || 1"
              :label="`${bytes(server.heapUsed)} of ${bytes(server.heapMax)}`"
            />
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Committed
                  <InfoTip heading="Committed" text="Heap the JVM has actually reserved from the operating system right now. It grows towards the maximum as needed." />
                </dt>
                <dd class="tabular-nums">{{ bytes(server.heapCommitted) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Free of committed
                  <InfoTip heading="Free of committed" text="Free share of the committed heap - not of the maximum. It can read comfortably high while the heap is still close to its ceiling, so read it together with the bar above." />
                </dt>
                <dd class="tabular-nums">{{ percent(server.heapFreePercent) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Uptime
                  <InfoTip heading="Uptime" text="How long this JVM has been running. An uptime that resets on its own means the process is crashing and being restarted." />
                </dt>
                <dd class="tabular-nums">{{ duration(server.uptime) }}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Thread pool
              <InfoTip
                heading="Self-tuning thread pool"
                text="The threads that execute incoming requests. WebLogic sizes this pool itself based on throughput, so the count moving up and down is normal - busy threads against total is the number to watch."
              />
            </p>
            <MeterBar
              tip="Threads currently executing requests against the total in the pool. Near full for long stretches means the server is saturated."
              :value="server.threadsBusy"
              :max="server.threadsTotal || 1"
              :label="`${server.threadsBusy} busy of ${server.threadsTotal}`"
            />
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Idle
                  <InfoTip heading="Idle" text="Threads in the pool with nothing to do. Plenty of idle threads while requests are slow means the bottleneck is elsewhere." />
                </dt>
                <dd class="tabular-nums">{{ num(server.threadsIdle) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Hogging / stuck
                  <InfoTip heading="Hogging / stuck" text="Hogging threads are holding on much longer than normal; stuck threads have exceeded the configured timeout (600s by default). Either number above zero deserves a look at the logs." />
                </dt>
                <dd :class="['tabular-nums', server.stuck > 0 && 'font-semibold text-red-500']">
                  {{ num(server.hogging) }} / {{ num(server.stuck) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Queue / pending
                  <InfoTip heading="Queue / pending" text="Requests waiting for a thread, and user requests not yet handed to one. Both should sit near zero on a healthy server." />
                </dt>
                <dd class="tabular-nums">{{ num(server.queueLength) }} / {{ num(server.pending) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  Throughput
                  <InfoTip heading="Throughput" text="Requests completed per second, as measured by the self-tuning pool. Compare it between servers in the same cluster to spot an outlier." />
                </dt>
                <dd class="tabular-nums">
                  {{ server.throughput === undefined ? '—' : Number(server.throughput).toFixed(1) + ' req/s' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <p class="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          <span title="Network sockets the server currently holds open, including client connections and connections to other servers">
            Open sockets {{ num(server.sockets) }}
          </span>
          ·
          <span title="Health the thread pool reports about itself - it turns critical when threads stay stuck">
            Pool health {{ healthOf(server.poolHealth) }}
          </span>
          ·
          <span title="WebLogic version this server runs">{{ server.version || 'version unknown' }}</span>
        </p>
      </section>
    </div>
  </div>
</template>
