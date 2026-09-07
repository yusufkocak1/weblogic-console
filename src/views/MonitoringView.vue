<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useActivityStore } from '@/stores/activity'
import { useAlertsStore } from '@/stores/alerts'
import { EXPORT_COLUMNS, useHistoryStore, WINDOW_OPTIONS } from '@/stores/history'
import { downloadCsv } from '@/utils/export'
import { bytes, duration, healthOf, items, num, percent } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import MeterBar from '@/components/MeterBar.vue'
import SparkLine from '@/components/SparkLine.vue'
import StateBadge from '@/components/StateBadge.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'
import { t } from '@/i18n'

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(({ signal }) =>
  wls.runtimeSnapshot({ signal }),
)

/**
 * The same numbers over time. A single reading answers "is it high"; the line
 * answers "is it getting worse", which is the question that decides what to do.
 */
const history = useHistoryStore()
const alerts = useAlertsStore()
/**
 * What this console changed, drawn on the same time axis as the numbers. Half
 * of all "why did it start doing that at 14:32" questions are answered by a
 * deployment that also happened at 14:32, and until the two were on one chart
 * nobody was going to notice.
 */
const activity = useActivityStore()

/** Whether the servers are drawn as one comparison chart or as cards. */
const compare = ref(false)

const historyWindow = computed(() => history.windowLabel)

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

/** Console changes and JVM restarts, as ticks the charts can draw. */
function markersFor(server) {
  const from = Date.now() - (history.windowMs || history.span || 0)
  const changes = activity.visible
    .filter((entry) => entry.at >= from && (!entry.server || entry.server === server))
    .map((entry) => ({ t: entry.at, tone: 'change', label: entry.title }))
  const restarts = history
    .restarts(server)
    .map((restart) => ({ t: restart.t, tone: 'restart', label: t('{server} restarted', { server }) }))
  return [...changes, ...restarts]
}

/**
 * Everything one card draws, worked out once.
 *
 * The analysis getters walk the whole buffer, so calling them straight from the
 * template — which re-runs them on every render, several times per card — is
 * how a page with eight servers starts to feel slow.
 */
const cards = computed(() =>
  servers.value.map((server) => {
    const heap = history.heapAnalysis(server.name)
    const pool = history.poolAnalysis(server.name)
    return {
      ...server,
      heap,
      pool,
      markers: markersFor(server.name),
      jdbcWaiting: history.points(server.name, 'dsw'),
      jdbcActive: history.points(server.name, 'dsa'),
      jdbcCapacity: history.latest?.servers?.[server.name]?.dsc || 0,
      jdbcWaitingNow: history.latest?.servers?.[server.name]?.dsw || 0,
      threshold: Number(alerts.ruleFor(server.name, 'heapPercent')) || null,
    }
  }),
)

/** The same metric for every server, for the comparison charts. */
const overlay = computed(() => {
  const names = servers.value.map((server) => server.name)
  return {
    heap: names.map((name) => ({ name, points: history.heapPercentPoints(name) })),
    busy: names.map((name) => ({ name, points: history.points(name, 'tb') })),
    throughput: names.map((name) => ({ name, points: history.points(name, 'tp') })),
    waiting: names.map((name) => ({ name, points: history.points(name, 'dsw') })),
  }
})

const anyWaiting = computed(() => cards.value.some((card) => card.jdbcWaitingNow > 0))

/** A rising floor is the reading worth a colour; everything else is noise. */
function trendTone(perHour, confident) {
  if (!confident || Math.abs(perHour) < 0.5) return 'text-zinc-500 dark:text-zinc-400'
  return perHour > 2 ? 'text-red-500' : perHour > 0 ? 'text-amber-500' : 'text-emerald-500'
}

function trendText(perHour, confident) {
  if (!confident) return t('too little history')
  if (Math.abs(perHour) < 0.5) return t('flat')
  const value = perHour > 0 ? `+${perHour.toFixed(1)}` : perHour.toFixed(1)
  return t('{points} points/h', { points: value })
}

const heapFormat = (value) => `${Math.round(value)}%`

function exportHistory() {
  const columns = EXPORT_COLUMNS.map((column) => ({ key: column.key, label: column.label() }))
  downloadCsv('monitoring', columns, history.exportRows(servers.value.map((server) => server.name)))
}
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Monitoring')"
      :subtitle="$t('JVM memory and thread pool health per running server')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'One card per running server, with the two things that explain most WebLogic slowdowns: how much heap the JVM is using, and how busy its request thread pool is. Only running servers appear here.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <div
          class="flex overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700"
          role="group"
          :aria-label="$t('How much history the charts show')"
        >
          <button
            v-for="option in WINDOW_OPTIONS"
            :key="option.value"
            :class="[
              'px-2 py-1 transition',
              history.windowMs === option.value
                ? 'bg-indigo-500 text-white'
                : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
            ]"
            :title="$t('Draw the charts over this much history')"
            @click="history.setWindow(option.value)"
          >
            {{ option.label() }}
          </button>
        </div>
        <button
          class="btn btn-ghost"
          :class="compare && 'text-indigo-600 dark:text-indigo-400'"
          :title="
            $t(
              'Draw every server on one pair of axes instead of one card each. This is how an outlier in a cluster becomes visible.',
            )
          "
          @click="compare = !compare"
        >
          {{ compare ? $t('Per server') : $t('Compare servers') }}
        </button>
        <button
          class="btn btn-ghost"
          :disabled="!history.windowed.length"
          :title="$t('Save the readings behind these charts as CSV — one row per server per sample')"
          @click="exportHistory"
        >
          {{ $t('Export') }}
        </button>
      </template>
    </PageHeader>

    <HelpPanel id="monitoring" :title="$t('How to work out why a server feels slow')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          {{
            $t(
              'Heap red or amber and staying there? The JVM is short of memory. It will spend its time in garbage collection long before it throws OutOfMemoryError, so this shows up as slowness first.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Stuck above zero? Requests are blocked on something outside the server — a database, a remote call, a lock. The JDBC line on the same card says whether it is the database.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Thread pool bar near full with a growing queue? More work is arriving than the server can finish. Look for a slow downstream system before adding capacity.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'The charts cover the range chosen above, sampled in the background — so the direction is there the moment you open the page, without having to sit and watch it. Hover any line for the reading and the moment it was taken. A break in a line is time nobody was sampling; a dotted vertical line is a restart or a change made from this console.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'Under each heap line is a dashed floor: the lowest point garbage collection got back to. A sawtooth over a flat floor is a healthy server whatever its peaks look like. A floor that climbs is memory that is never coming back, and it is worth acting on long before the bar turns red.',
          )
        }}
      </p>
    </HelpPanel>

    <p
      v-if="!history.sampling"
      class="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {{ $t('Runtime sampling is switched off in the backend (WLC_SAMPLE_MS=0), so these charts stay empty.') }}
    </p>
    <p
      v-else-if="history.error"
      class="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {{ history.error }}
    </p>

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />
    <div v-else-if="loading && !servers.length" class="card p-8 text-center text-sm text-zinc-400">
      {{ $t('Loading…') }}
    </div>
    <div v-else-if="!servers.length" class="card p-8 text-center text-sm text-zinc-400">
      {{ $t('No server is running, so there is no runtime to monitor.') }}
    </div>

    <!-- Every server on one pair of axes. The point is not the individual
         line, it is the one that does not follow the others. -->
    <div v-else-if="compare" class="grid gap-4 xl:grid-cols-2">
      <section class="card p-4">
        <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {{ $t('Heap used') }}
          <InfoTip
            :heading="$t('Heap across the domain')"
            :text="
              $t(
                'Every running server as a percentage of its own maximum, so servers with different -Xmx values can still be compared. In a cluster the lines should broadly agree; one that sits above the others is taking more work, holding more session state, or leaking.',
              )
            "
          />
        </p>
        <SparkLine
          :series="overlay.heap"
          :max="100"
          :min="0"
          :height="140"
          axis
          interactive
          :threshold="alerts.rules.heapPercent"
          :gap-ms="history.gapMs"
          :format="heapFormat"
          :title="$t('Heap used as a percentage of the maximum — {window}', { window: historyWindow })"
          :empty-text="$t('history builds up while the console runs')"
        />
      </section>

      <section class="card p-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {{ $t('Threads busy') }}
        </p>
        <SparkLine
          :series="overlay.busy"
          :height="140"
          axis
          interactive
          :gap-ms="history.gapMs"
          :title="$t('Threads executing requests — {window}', { window: historyWindow })"
          :empty-text="$t('history builds up while the console runs')"
        />
      </section>

      <section class="card p-4">
        <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {{ $t('Throughput') }}
          <InfoTip
            :heading="$t('Throughput across the domain')"
            :text="
              $t(
                'Requests completed per second. Read together with the busy threads above: more threads and the same throughput means each request got slower, which points outward — at a database or a remote call — rather than at the server.',
              )
            "
          />
        </p>
        <SparkLine
          :series="overlay.throughput"
          :height="140"
          axis
          interactive
          :gap-ms="history.gapMs"
          unit="req/s"
          :title="$t('Requests completed per second — {window}', { window: historyWindow })"
          :empty-text="$t('history builds up while the console runs')"
        />
      </section>

      <section class="card p-4">
        <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {{ $t('Waiting for a JDBC connection') }}
          <InfoTip
            :heading="$t('Waiting for a JDBC connection')"
            :text="
              $t(
                'Requests queued for a connection from a data source pool. Anything but zero here explains busy threads that are not doing any work: they are queuing for the database, not running.',
              )
            "
          />
        </p>
        <SparkLine
          :series="overlay.waiting"
          :height="140"
          axis
          interactive
          :gap-ms="history.gapMs"
          :title="$t('Requests waiting for a JDBC connection — {window}', { window: historyWindow })"
          :empty-text="$t('history builds up while the console runs')"
        />
      </section>
    </div>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <section v-for="server in cards" :key="server.name" class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="font-semibold text-zinc-900 dark:text-zinc-50">{{ server.name }}</h2>
            <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {{ server.java || '—' }}<template v-if="server.os"> · {{ server.os }}</template>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="alerts.snoozedUntil(server.name)"
              class="text-[11px] text-zinc-400 dark:text-zinc-500"
              :title="$t('Alerts about this server are snoozed. Un-snooze it from the bell in the top bar.')"
            >
              {{ $t('snoozed') }}
            </span>
            <StateBadge :state="server.state" />
            <StateBadge kind="health" :health="server.health" />
          </div>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {{ $t('Heap') }}
              <InfoTip
                :heading="$t('Java heap')"
                :text="
                  $t(
                    'Memory available to application objects. WebLogic reports what is committed now and the maximum the JVM may grow to (-Xmx). Used memory sawtooths as garbage collection runs; what matters is whether the low points keep rising.',
                  )
                "
              />
            </p>
            <MeterBar
              :tip="
                $t(
                  'Heap in use against the JVM maximum. Amber past 75%, red past 90%. A bar that never drops after garbage collection is the classic memory-leak shape.',
                )
              "
              :value="server.heapUsed"
              :max="server.heapMax || 1"
              :label="$t('{used} of {max}', { used: bytes(server.heapUsed), max: bytes(server.heapMax) })"
            />
            <SparkLine
              class="mt-2"
              :points="server.heap.points"
              :baseline="server.heap.baseline"
              :max="100"
              :height="56"
              interactive
              :threshold="server.threshold"
              :markers="server.markers"
              :gap-ms="history.gapMs"
              :format="heapFormat"
              :tone="server.heap.summary.last >= 90 ? 'bad' : 'default'"
              :title="$t('Heap used as a percentage of the maximum — {window}', { window: historyWindow })"
              :empty-text="$t('history builds up while the console runs')"
            />

            <!-- What the line means, rather than what it shows. -->
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Floor') }}
                  <InfoTip
                    :heading="$t('Heap floor')"
                    :text="
                      $t(
                        'The lowest level garbage collection has been getting back to, and how fast that level is moving. A floor rising steadily is a leak; the current reading cannot tell you that, because a busy healthy server sits high too.',
                      )
                    "
                  />
                </dt>
                <dd class="flex items-center gap-2 tabular-nums">
                  <span>{{ server.heap.floor.last === null ? '—' : `${Math.round(server.heap.floor.last)}%` }}</span>
                  <span :class="trendTone(server.heap.perHour, server.heap.confident)">
                    {{ trendText(server.heap.perHour, server.heap.confident) }}
                  </span>
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Collections') }}
                  <InfoTip
                    :heading="$t('Collections')"
                    :text="
                      $t(
                        'How often the heap has visibly dropped, per hour — garbage collection, counted from the samples. WebLogic does not report the JVM’s own count over REST, but the rate answers the same question: a server collecting constantly is under memory pressure however low its current reading is.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">
                  {{ $t('{count}/h', { count: Math.round(server.heap.collectionsPerHour) }) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Committed') }}
                  <InfoTip
                    :heading="$t('Committed')"
                    :text="
                      $t(
                        'Heap the JVM has actually reserved from the operating system right now. It grows towards the maximum as needed.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">{{ bytes(server.heapCommitted) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Free of committed') }}
                  <InfoTip
                    :heading="$t('Free of committed')"
                    :text="
                      $t(
                        'Free share of the committed heap - not of the maximum. It can read comfortably high while the heap is still close to its ceiling, so read it together with the bar above.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">{{ percent(server.heapFreePercent) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Uptime') }}
                  <InfoTip
                    :heading="$t('Uptime')"
                    :text="
                      $t(
                        'How long this JVM has been running. An uptime that resets on its own means the process is crashing and being restarted.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">{{ duration(server.uptime) }}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {{ $t('Thread pool') }}
              <InfoTip
                :heading="$t('Self-tuning thread pool')"
                :text="
                  $t(
                    'The threads that execute incoming requests. WebLogic sizes this pool itself based on throughput, so the count moving up and down is normal — busy threads against total is the number to watch.',
                  )
                "
              />
            </p>
            <MeterBar
              :tip="
                $t(
                  'Threads currently executing requests against the total in the pool. Near full for long stretches means the server is saturated.',
                )
              "
              :value="server.threadsBusy"
              :max="server.threadsTotal || 1"
              :label="$t('{busy} busy of {total}', { busy: server.threadsBusy, total: server.threadsTotal })"
            />
            <SparkLine
              class="mt-2"
              :points="server.pool.busy"
              :height="56"
              interactive
              :markers="server.markers"
              :gap-ms="history.gapMs"
              :tone="server.stuck > 0 ? 'bad' : 'default'"
              :title="$t('Threads executing requests — {window}', { window: historyWindow })"
              :empty-text="$t('history builds up while the console runs')"
            />
            <dl class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Saturated') }}
                  <InfoTip
                    :heading="$t('Saturated')"
                    :text="
                      $t(
                        'How much of the shown range the pool spent at 90% busy or more. This is the difference between a peak you happened to catch and a server that has been full all morning — and it is the number to quote when asking for more capacity.',
                      )
                    "
                  />
                </dt>
                <dd
                  :class="['tabular-nums', server.pool.saturated >= 0.25 && 'font-semibold text-amber-500']"
                >
                  {{ Math.round(server.pool.saturated * 100) }}%
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Per busy thread') }}
                  <InfoTip
                    :heading="$t('Per busy thread')"
                    :text="
                      $t(
                        'Throughput divided by the threads producing it. It separates the two reasons a pool fills up: more requests arriving, which leaves this steady, and each request taking longer, which makes it fall.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">
                  {{
                    server.pool.perThread === null
                      ? '—'
                      : $t('{count} req/s', { count: server.pool.perThread.toFixed(2) })
                  }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Idle') }}
                  <InfoTip
                    :heading="$t('Idle')"
                    :text="
                      $t(
                        'Threads in the pool with nothing to do. Plenty of idle threads while requests are slow means the bottleneck is elsewhere.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">{{ num(server.threadsIdle) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Hogging / stuck') }}
                  <InfoTip
                    :heading="$t('Hogging / stuck')"
                    :text="
                      $t(
                        'Hogging threads are holding on much longer than normal; stuck threads have exceeded the configured timeout (600s by default). Either number above zero deserves a look at the logs.',
                      )
                    "
                  />
                </dt>
                <dd :class="['tabular-nums', server.stuck > 0 && 'font-semibold text-red-500']">
                  {{ num(server.hogging) }} / {{ num(server.stuck) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Queue / pending') }}
                  <InfoTip
                    :heading="$t('Queue / pending')"
                    :text="
                      $t(
                        'Requests waiting for a thread, and user requests not yet handed to one. Both should sit near zero on a healthy server.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">{{ num(server.queueLength) }} / {{ num(server.pending) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Throughput') }}
                  <InfoTip
                    :heading="$t('Throughput')"
                    :text="
                      $t(
                        'Requests completed per second, as measured by the self-tuning pool. Compare it between servers in the same cluster to spot an outlier.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums">
                  {{
                    server.throughput === undefined
                      ? '—'
                      : $t('{count} req/s', { count: Number(server.throughput).toFixed(1) })
                  }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Where "check the database" stops being a guess. -->
        <div v-if="history.depth === 'full'" class="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {{ $t('JDBC pools') }}
              <InfoTip
                :heading="$t('JDBC pools')"
                :text="
                  $t(
                    'Connections in use across this server\'s data sources, and requests queued for one. Threads waiting here are the commonest reason a thread pool fills up while the server itself is doing nothing, and it is why a stuck thread so often turns out to be a database problem.',
                  )
                "
              />
            </p>
            <RouterLink
              :to="{ name: 'data-sources' }"
              class="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              :title="$t('Open the Data Sources page, where each pool can be tested')"
            >
              {{
                $t('{active} in use of {capacity}', {
                  active: num(server.jdbcActive.at(-1)?.v ?? 0),
                  capacity: num(server.jdbcCapacity),
                })
              }}
            </RouterLink>
          </div>
          <SparkLine
            class="mt-2"
            :series="[
              { name: $t('In use'), points: server.jdbcActive, tone: 'default' },
              { name: $t('Waiting'), points: server.jdbcWaiting, tone: 'bad' },
            ]"
            :height="40"
            interactive
            :gap-ms="history.gapMs"
            :title="$t('JDBC connections in use, and requests waiting for one — {window}', { window: historyWindow })"
            :empty-text="$t('history builds up while the console runs')"
          />
          <p v-if="server.jdbcWaitingNow > 0" class="mt-1 text-xs text-red-500">
            {{
              $t('{count} request(s) are queued for a connection right now.', { count: num(server.jdbcWaitingNow) })
            }}
          </p>
        </div>

        <p class="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          <span
            :title="
              $t(
                'Network sockets the server currently holds open, including client connections and connections to other servers',
              )
            "
          >
            {{ $t('Open sockets {count}', { count: num(server.sockets) }) }}
          </span>
          ·
          <span
            :title="$t('Health the thread pool reports about itself — it turns critical when threads stay stuck')"
          >
            {{ $t('Pool health {health}', { health: healthOf(server.poolHealth) }) }}
          </span>
          ·
          <span :title="$t('WebLogic version this server runs')">
            {{ server.version || $t('version unknown') }}
          </span>
        </p>
      </section>
    </div>

    <p
      v-if="anyWaiting"
      class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {{
        $t(
          'Requests are queued for JDBC connections on at least one server. Before adding threads or memory, check the pool sizes and the database on the Data Sources page — thread pressure caused by a slow database is not fixed by more threads.',
        )
      }}
    </p>
  </div>
</template>
