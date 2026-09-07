<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAlertsStore, DEFAULT_RULES, SNOOZE_OPTIONS } from '@/stores/alerts'
import { useHistoryStore } from '@/stores/history'
import InfoTip from '@/components/InfoTip.vue'
import { t } from '@/i18n'

/**
 * The bell in the top bar: what the watcher has noticed, and the thresholds it
 * watches against. Both live here because the first question after seeing an
 * alert is usually "at what number did that fire?".
 *
 * The panel also carries the three controls that decide whether an operator
 * keeps the bell switched on at all — how long a level has to hold before it
 * counts, a per-server threshold for the server whose normal is not everyone's
 * normal, and which clusters the watch covers at all — because the alternative
 * to each of them is turning a rule off for the whole domain and never turning
 * it back on.
 */
const alerts = useAlertsStore()
const history = useHistoryStore()

const open = ref(false)
const showRules = ref(false)
/** The server whose own thresholds are being edited, if any. */
const editing = ref('')

const badge = computed(() => (alerts.unread > 99 ? '99+' : String(alerts.unread)))

const TONE_DOT = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-sky-500',
}

const BELL_TONE = {
  error: 'text-red-500 dark:text-red-400',
  warn: 'text-amber-500 dark:text-amber-400',
  info: 'text-sky-500 dark:text-sky-400',
  none: '',
}

/** How long a level must hold before it is announced. */
const SUSTAIN_OPTIONS = [
  { label: () => t('at once'), value: 0 },
  { label: () => t('30 seconds'), value: 30_000 },
  { label: () => t('1 minute'), value: 60_000 },
  { label: () => t('2 minutes'), value: 120_000 },
  { label: () => t('5 minutes'), value: 300_000 },
]

/** The rules worth overriding per server — the ones whose normal varies. */
const OVERRIDABLE = [
  { key: 'heapPercent', label: () => t('Heap above'), suffix: '%', min: 1, max: 100 },
  { key: 'queueLength', label: () => t('Queued requests at or above'), suffix: '', min: 0 },
  { key: 'jdbcWaiting', label: () => t('Waiting for a JDBC connection at or above'), suffix: '', min: 0 },
]

const servers = computed(() => history.serverNames)

/** The clusters this bell can be pointed at, and who is in each of them. */
const groups = computed(() => alerts.watchGroups)

/**
 * The cluster list is read from the domain's configuration, so it is asked for
 * again whenever the thresholds are opened: a cluster added this morning should
 * be on offer this morning.
 */
function toggleRules() {
  showRules.value = !showRules.value
  if (showRules.value) alerts.readTopology(true)
}

const groupLabel = (cluster) => cluster || t('Servers in no cluster')

const snoozedServers = computed(() =>
  Object.entries(alerts.snoozed)
    .filter(([, until]) => until > Date.now())
    .map(([server, until]) => ({ server, until }))
    .sort((a, b) => a.server.localeCompare(b.server)),
)

function toggle() {
  open.value = !open.value
  alerts.open = open.value
  if (open.value) alerts.markAllRead()
}

function close() {
  open.value = false
  alerts.open = false
}

const onKey = (event) => {
  if (event.key === 'Escape') close()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const time = (at) => new Date(at).toLocaleTimeString(undefined, { hour12: false })

/** An empty box means "use the domain default", not "zero". */
function overrideValue(server, key) {
  const value = alerts.overrides[server]?.[key]
  return value === undefined ? '' : value
}

function applyOverride(server, key, raw) {
  alerts.setOverride(server, key, raw === '' ? '' : Number(raw))
}

function snooze(server, raw) {
  if (!raw) return
  alerts.snooze(server, Number(raw))
}
</script>

<template>
  <div class="relative">
    <button
      class="btn btn-ghost relative"
      :aria-label="alerts.unread ? $t('{count} unread alerts', { count: alerts.unread }) : $t('Alerts')"
      :aria-expanded="open"
      :title="
        $t(
          'Alerts raised by watching this domain: a server leaving RUNNING, a heap or queue past its threshold, a stuck thread. Click to see them and to set the thresholds.',
        )
      "
      @click="toggle"
    >
      <svg
        class="h-4 w-4"
        :class="BELL_TONE[alerts.worst]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span
        v-if="alerts.unread"
        class="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white"
      >
        {{ badge }}
      </span>
      <!-- A muted domain must say so, or the quiet reads as good news. -->
      <span
        v-else-if="alerts.anyMuted"
        class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-zinc-400"
        :title="$t('Part of this domain is not being watched')"
      />
    </button>

    <div v-if="open" class="fixed inset-0 z-30" @click="close" />

    <div
      v-if="open"
      class="card absolute right-0 z-40 mt-2 flex max-h-[70vh] w-96 max-w-[92vw] flex-col overflow-hidden shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p class="flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {{ $t('Alerts') }}
          <InfoTip
            :heading="$t('Alerts')"
            :text="
              $t(
                'Raised from the runtime samples the console collects in the background, on whichever page you are on. Each one fires when the condition starts holding and again only once it has cleared, so a long-running problem is one line, not hundreds.',
              )
            "
          />
        </p>
        <button
          class="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('Show the thresholds these alerts fire at')"
          @click="toggleRules()"
        >
          {{ showRules ? $t('Hide thresholds') : $t('Thresholds') }}
        </button>
        <button
          v-if="alerts.alerts.length"
          class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('Remove every alert from this list. It does not change anything on the domain.')"
          @click="alerts.clear()"
        >
          {{ $t('Clear') }}
        </button>
      </div>

      <div v-if="showRules" class="space-y-3 overflow-y-auto border-b border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
        <label class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            {{ $t('A level must hold for') }}
            <InfoTip
              :heading="$t('A level must hold for')"
              :text="
                $t(
                  'How long heap, queue, JDBC and health have to stay past their threshold before an alert is raised. A heap touching 91% for one sample during a garbage collection is not news; the same heap still at 91% a minute later is. Events — a server leaving RUNNING, a thread going stuck, a restart — are always announced at once.',
                )
              "
            />
          </span>
          <select
            class="input w-28 py-1"
            :value="alerts.rules.sustainMs"
            @change="alerts.setRule('sustainMs', Number($event.target.value))"
          >
            <option v-for="option in SUSTAIN_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label() }}
            </option>
          </select>
        </label>

        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Server leaves RUNNING') }}</span>
          <input
            type="checkbox"
            :checked="alerts.rules.serverDown"
            @change="alerts.setRule('serverDown', $event.target.checked)"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Heap above') }}</span>
          <span class="flex items-center gap-1">
            <input
              class="input w-20 py-1"
              type="number"
              min="1"
              max="100"
              :value="alerts.rules.heapPercent"
              @change="alerts.setRule('heapPercent', Number($event.target.value))"
            />
            <span class="text-xs text-zinc-400">%</span>
          </span>
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            {{ $t('Heap climbs by') }}
            <InfoTip
              :heading="$t('Heap climbs by')"
              :text="
                $t(
                  'Percentage points the heap may rise inside the window below without coming back down. This is the rule that catches a leak while there is still room to act — a fixed ceiling by definition only fires once the memory is nearly gone. 0 turns it off.',
                )
              "
            />
          </span>
          <span class="flex items-center gap-1">
            <input
              class="input w-16 py-1"
              type="number"
              min="0"
              max="100"
              :value="alerts.rules.heapRisePercent"
              @change="alerts.setRule('heapRisePercent', Number($event.target.value))"
            />
            <span class="text-xs text-zinc-400">{{ $t('pts in') }}</span>
            <input
              class="input w-14 py-1"
              type="number"
              min="1"
              max="120"
              :value="alerts.rules.heapRiseMinutes"
              @change="alerts.setRule('heapRiseMinutes', Number($event.target.value))"
            />
            <span class="text-xs text-zinc-400">{{ $t('min') }}</span>
          </span>
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Stuck threads at or above') }}</span>
          <input
            class="input w-20 py-1"
            type="number"
            min="1"
            :value="alerts.rules.stuckThreads"
            @change="alerts.setRule('stuckThreads', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Queued requests at or above') }}</span>
          <input
            class="input w-20 py-1"
            type="number"
            min="0"
            :value="alerts.rules.queueLength"
            @change="alerts.setRule('queueLength', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            {{ $t('Waiting for a JDBC connection at or above') }}
            <InfoTip
              :heading="$t('Waiting for a JDBC connection')"
              :text="
                $t(
                  'Requests queued for a connection from any data source pool on the server. This is where a thread pool filling up usually turns out to have started, and it is worth its own alert because the thread numbers alone point at the wrong place. 0 turns it off.',
                )
              "
            />
          </span>
          <input
            class="input w-20 py-1"
            type="number"
            min="0"
            :value="alerts.rules.jdbcWaiting"
            @change="alerts.setRule('jdbcWaiting', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('JMS messages pending at or above') }}</span>
          <input
            class="input w-20 py-1"
            type="number"
            min="0"
            :value="alerts.rules.jmsPending"
            @change="alerts.setRule('jmsPending', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Running server reports unhealthy') }}</span>
          <input
            type="checkbox"
            :checked="alerts.rules.unhealthy"
            @change="alerts.setRule('unhealthy', $event.target.checked)"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            {{ $t('Server restarted') }}
            <InfoTip
              :heading="$t('Server restarted')"
              :text="
                $t(
                  'The JVM start time changed between two samples, so the process went away and came back. Nothing else in a sample reveals this: a server that crashes and is restarted looks, in every other number, like one that simply got quieter.',
                )
              "
            />
          </span>
          <input
            type="checkbox"
            :checked="alerts.rules.restart"
            @change="alerts.setRule('restart', $event.target.checked)"
          />
        </label>

        <!-- Nobody looks after every cluster in a domain, and an alert about
             somebody else's is what teaches an operator to ignore the bell. -->
        <div class="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
              {{ $t('Clusters to watch') }}
              <InfoTip
                :heading="$t('Clusters to watch')"
                :text="
                  $t(
                    'Which part of the domain this bell speaks for. An unticked cluster raises nothing at all — no alert, no toast, no notification — for any of its servers, until it is ticked again. Unlike a snooze it does not expire, so it is the setting for a cluster that somebody else looks after rather than for one that is being worked on right now.',
                  )
                "
              />
            </span>
            <button
              v-if="alerts.unwatchedClusters.length"
              class="shrink-0 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              :title="$t('Watch every cluster in this domain again')"
              @click="alerts.watchEverything()"
            >
              {{ $t('Watch all') }}
            </button>
          </div>

          <ul v-if="groups.length" class="space-y-1">
            <li v-for="group in groups" :key="group.cluster" class="flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0">
                <span class="text-zinc-600 dark:text-zinc-300">{{ groupLabel(group.cluster) }}</span>
                <span v-if="group.servers.length" class="ml-1 text-zinc-400 dark:text-zinc-500">
                  {{ group.servers.join(', ') }}
                </span>
                <span v-else class="ml-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('not in this domain') }}
                </span>
              </span>
              <input
                type="checkbox"
                class="shrink-0"
                :checked="group.watched"
                :aria-label="$t('Watch {cluster}', { cluster: groupLabel(group.cluster) })"
                @change="alerts.watchCluster(group.cluster, $event.target.checked)"
              />
            </li>
          </ul>
          <p v-else class="text-[11px] text-zinc-400 dark:text-zinc-500">
            {{ $t('The clusters in this domain appear here once its configuration has been read.') }}
          </p>
        </div>

        <!-- One threshold rarely fits an AdminServer and a managed server both. -->
        <div class="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
              {{ $t('Per-server thresholds') }}
              <InfoTip
                :heading="$t('Per-server thresholds')"
                :text="
                  $t(
                    'What one server may do that the rest may not. An AdminServer sitting at 85% heap is ordinary and a managed server doing the same is not, and without this the only way to stop the false alarm is to raise the threshold for everybody.',
                  )
                "
              />
            </span>
            <select class="input w-40 py-1" :value="editing" @change="editing = $event.target.value">
              <option value="">{{ $t('Choose a server…') }}</option>
              <option v-for="server in servers" :key="server" :value="server">{{ server }}</option>
            </select>
          </div>

          <div v-if="editing" class="space-y-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-800/50">
            <label
              v-for="rule in OVERRIDABLE"
              :key="rule.key"
              class="flex items-center justify-between gap-2 text-xs"
            >
              <span class="text-zinc-600 dark:text-zinc-300">{{ rule.label() }}</span>
              <span class="flex items-center gap-1">
                <input
                  class="input w-20 py-1"
                  type="number"
                  :min="rule.min"
                  :max="rule.max"
                  :placeholder="String(alerts.rules[rule.key])"
                  :value="overrideValue(editing, rule.key)"
                  @change="applyOverride(editing, rule.key, $event.target.value)"
                />
                <span v-if="rule.suffix" class="text-zinc-400">{{ rule.suffix }}</span>
              </span>
            </label>
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500">
              {{ $t('An empty box uses the domain-wide value above.') }}
            </p>
          </div>

          <ul v-if="alerts.overriddenServers.length" class="space-y-1 text-xs">
            <li
              v-for="server in alerts.overriddenServers"
              :key="server"
              class="flex items-center justify-between gap-2"
            >
              <span class="truncate text-zinc-600 dark:text-zinc-300">
                {{ server }}
                <span class="text-zinc-400 dark:text-zinc-500">
                  {{
                    Object.entries(alerts.overrides[server])
                      .map(([key, value]) => `${key} ${value}`)
                      .join(', ')
                  }}
                </span>
              </span>
              <button
                class="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                :title="$t('Back to the domain-wide thresholds for this server')"
                @click="alerts.clearOverrides(server)"
              >
                {{ $t('Remove') }}
              </button>
            </li>
          </ul>
        </div>

        <div class="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <label class="flex items-center justify-between gap-2">
            <span class="text-zinc-700 dark:text-zinc-200">
              {{ $t('Desktop notifications') }}
              <span class="block text-xs text-zinc-400 dark:text-zinc-500">
                {{ $t('Also notify when this tab is hidden') }}
              </span>
            </span>
            <input type="checkbox" :checked="alerts.desktop" @change="alerts.setDesktop($event.target.checked)" />
          </label>
          <label v-if="alerts.webhookAvailable" class="flex items-center justify-between gap-2">
            <span class="text-zinc-700 dark:text-zinc-200">
              {{ $t('Send to the configured webhook') }}
              <span class="block text-xs text-zinc-400 dark:text-zinc-500">
                {{ $t('Reaches somebody who has no browser open') }}
              </span>
            </span>
            <input type="checkbox" :checked="alerts.forward" @change="alerts.setForward($event.target.checked)" />
          </label>
          <p v-else class="text-xs text-zinc-400 dark:text-zinc-500">
            {{
              $t(
                'Start the console with WLC_ALERT_WEBHOOK set to a URL and these alerts can also be posted there, for when nobody has the console open.',
              )
            }}
          </p>
        </div>

        <button
          class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="
            $t('Back to the defaults: heap {heap}%, {stuck} stuck thread, {queued} queued requests', {
              heap: DEFAULT_RULES.heapPercent,
              stuck: DEFAULT_RULES.stuckThreads,
              queued: DEFAULT_RULES.queueLength,
            })
          "
          @click="alerts.resetRules()"
        >
          {{ $t('Reset to defaults') }}
        </button>
      </div>

      <div
        v-if="snoozedServers.length || alerts.unwatchedClusters.length"
        class="border-b border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
      >
        <p class="mb-1 text-zinc-500 dark:text-zinc-400">{{ $t('Not being watched') }}</p>
        <ul class="space-y-1">
          <li
            v-for="cluster in alerts.unwatchedClusters"
            :key="`cluster:${cluster}`"
            class="flex items-center justify-between gap-2"
          >
            <span class="truncate text-zinc-600 dark:text-zinc-300">
              {{ groupLabel(cluster) }}
              <span class="text-zinc-400 dark:text-zinc-500">{{ $t('until you turn it back on') }}</span>
            </span>
            <button
              class="shrink-0 text-indigo-600 hover:underline dark:text-indigo-400"
              @click="alerts.watchCluster(cluster, true)"
            >
              {{ $t('Watch') }}
            </button>
          </li>
          <li v-for="entry in snoozedServers" :key="entry.server" class="flex items-center justify-between gap-2">
            <span class="truncate text-zinc-600 dark:text-zinc-300">
              {{ entry.server }}
              <span class="text-zinc-400 dark:text-zinc-500">{{ $t('until {time}', { time: time(entry.until) }) }}</span>
            </span>
            <button
              class="shrink-0 text-indigo-600 hover:underline dark:text-indigo-400"
              @click="alerts.snooze(entry.server, 0)"
            >
              {{ $t('Wake') }}
            </button>
          </li>
        </ul>
      </div>

      <p
        v-if="!history.sampling"
        class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ $t('Runtime sampling is switched off in the backend (WLC_SAMPLE_MS=0), so nothing is being watched.') }}
      </p>
      <p
        v-else-if="history.error"
        class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ history.error }}
      </p>

      <ul v-if="alerts.alerts.length" class="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        <li v-for="alert in alerts.alerts" :key="alert.id" class="flex gap-2 px-3 py-2">
          <span :class="['mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[alert.severity] || 'bg-zinc-400']" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">{{ alert.title }}</p>
            <p class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ alert.detail }}</p>
            <div class="mt-0.5 flex items-center gap-2">
              <p class="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{{ time(alert.at) }}</p>
              <!-- Quieting one server while it is being worked on, rather than
                   turning the rule off across the domain and forgetting. -->
              <select
                v-if="alert.server && !alerts.snoozedUntil(alert.server)"
                class="border-none bg-transparent p-0 text-[11px] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                :title="$t('Stop announcing anything about {server} for a while', { server: alert.server })"
                @change="snooze(alert.server, $event.target.value)"
              >
                <option value="">{{ $t('Snooze…') }}</option>
                <option v-for="option in SNOOZE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label() }}
                </option>
              </select>
            </div>
          </div>
        </li>
      </ul>
      <p v-else class="flex-1 px-3 py-8 text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
        {{
          $t(
            'Nothing to report. Alerts appear here when something changes — the state the domain was already in when you opened the console is on the Dashboard, not in this list.',
          )
        }}
      </p>
    </div>
  </div>
</template>
