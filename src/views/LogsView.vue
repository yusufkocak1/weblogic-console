<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from 'vue'
import * as wls from '@/api/weblogic'
import { useUiStore } from '@/stores/ui'
import { useUrlState } from '@/composables/useUrlState'
import { items } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'

const ui = useUiStore()

const SEVERITIES = ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Info', 'Debug', 'Trace']

/** Rank by seriousness, so sorting by severity puts the emergencies on top. */
const SEVERITY_RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s.toUpperCase(), i]))

/** The value that means "the range in the two date boxes", not a rolling window. */
const CUSTOM_WINDOW = 0

const WINDOWS = [
  { label: 'Last 15 minutes', value: 15 * 60_000 },
  { label: 'Last hour', value: 60 * 60_000 },
  { label: 'Last 6 hours', value: 6 * 60 * 60_000 },
  { label: 'Last 24 hours', value: 24 * 60 * 60_000 },
  { label: 'Last 7 days', value: 7 * 24 * 60 * 60_000 },
  { label: 'Custom range…', value: CUSTOM_WINDOW },
]

const SEVERITY_CLASSES = {
  EMERGENCY: 'text-red-600 dark:text-red-400',
  ALERT: 'text-red-600 dark:text-red-400',
  CRITICAL: 'text-red-600 dark:text-red-400',
  ERROR: 'text-red-600 dark:text-red-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  NOTICE: 'text-sky-600 dark:text-sky-400',
  INFO: 'text-zinc-500 dark:text-zinc-400',
  DEBUG: 'text-zinc-400 dark:text-zinc-500',
  TRACE: 'text-zinc-400 dark:text-zinc-500',
}

const SORTS = [
  { key: 'timestamp', label: 'Time', defaultDir: 'desc' },
  { key: 'severity', label: 'Severity', defaultDir: 'asc' },
  { key: 'subsystem', label: 'Subsystem', defaultDir: 'asc' },
  { key: 'message', label: 'Message', defaultDir: 'asc' },
]

const form = reactive({
  server: '',
  log: 'ServerLog',
  minSeverity: 'Warning',
  contains: '',
  sinceMs: 60 * 60_000,
  from: '',
  to: '',
  limit: 200,
  sort: 'timestamp',
  dir: 'desc',
})

const DEFAULTS = {
  server: '',
  log: 'ServerLog',
  severity: 'Warning',
  contains: '',
  since: 60 * 60_000,
  from: '',
  to: '',
  limit: 200,
  sort: 'timestamp',
  dir: 'desc',
}

/**
 * The filters live in the URL. "The errors on ms2 in the last six hours" then
 * becomes a link that can go in a ticket, survives a reload, and comes back
 * with the back button.
 */
useUrlState(
  {
    server: toRef(form, 'server'),
    log: toRef(form, 'log'),
    severity: toRef(form, 'minSeverity'),
    contains: toRef(form, 'contains'),
    since: toRef(form, 'sinceMs'),
    from: toRef(form, 'from'),
    to: toRef(form, 'to'),
    limit: toRef(form, 'limit'),
    sort: toRef(form, 'sort'),
    dir: toRef(form, 'dir'),
  },
  DEFAULTS,
)

const servers = ref([])
const logNames = ref(['ServerLog', 'DomainLog', 'HTTPAccessLog', 'DataSourceLog'])
const rows = ref([])
const error = ref(null)
const loading = ref(false)
const lastUpdated = ref(null)
/** The window the rows on screen actually came from, not the one being edited. */
const activeRange = ref(null)

// ------------------------------------------------------------------ the window

/**
 * `datetime-local` hands back naive local time ("2026-09-04T14:30"), which is
 * what someone reading a log in their own timezone means by it.
 */
function parseLocalInput(text) {
  if (!text) return null
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : ms
}

function toLocalInput(epochMs) {
  const d = new Date(epochMs)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * Turns the form into the absolute window to query, or into the reason it
 * cannot be queried yet. A rolling window ends now; a custom one ends where
 * the user put it.
 */
function resolveRange() {
  if (Number(form.sinceMs) !== CUSTOM_WINDOW) {
    const endTime = Date.now()
    return { startTime: endTime - Number(form.sinceMs), endTime }
  }
  const startTime = parseLocalInput(form.from)
  const endTime = parseLocalInput(form.to)
  if (startTime === null || endTime === null) return { invalid: 'Enter both a start and an end time.' }
  if (startTime >= endTime) return { invalid: 'The start of the range has to come before its end.' }
  return { startTime, endTime }
}

const isCustom = computed(() => Number(form.sinceMs) === CUSTOM_WINDOW)
const rangeIssue = computed(() => (isCustom.value ? resolveRange().invalid || '' : ''))

/** Seeds the date boxes from the rolling window being left, so they open filled. */
watch(
  () => form.sinceMs,
  (next, previous) => {
    if (Number(next) !== CUSTOM_WINDOW || (form.from && form.to)) return
    const end = Date.now()
    const span = Number(previous) > 0 ? Number(previous) : 60 * 60_000
    form.from = toLocalInput(end - span)
    form.to = toLocalInput(end)
  },
)

function formatRange(range) {
  if (!range) return ''
  const opts = { hour12: false }
  const start = new Date(range.startTime)
  const end = new Date(range.endTime)
  const sameDay = start.toDateString() === end.toDateString()
  const endText = sameDay ? end.toLocaleTimeString(undefined, opts) : end.toLocaleString(undefined, opts)
  return `${start.toLocaleString(undefined, opts)} → ${endText}`
}

// ------------------------------------------------------------------- fetching

/**
 * WLDF has no "severity >= X" operator, so the levels at or above the chosen
 * one are expanded into an OR chain. MESSAGE LIKE takes SQL-style wildcards.
 */
function buildQuery() {
  const clauses = []
  const index = SEVERITIES.indexOf(form.minSeverity)
  if (index >= 0 && form.minSeverity !== 'Trace') {
    const wanted = SEVERITIES.slice(0, index + 1)
    clauses.push(`(${wanted.map((s) => `SEVERITY = '${s}'`).join(' OR ')})`)
  }
  const needle = form.contains.trim().replace(/'/g, "''")
  if (needle) clauses.push(`MESSAGE LIKE '%${needle}%'`)
  return clauses.join(' AND ')
}

async function loadServers() {
  try {
    const result = await wls.serverLifeCycles()
    const list = items(result).filter((s) => s.state === 'RUNNING')
    servers.value = list.map((s) => s.name)
    if (!form.server && servers.value.length) form.server = servers.value[0]
  } catch (err) {
    error.value = err
  }
}

/** Only the newest request may write to `rows`; a slow earlier one is dropped. */
let requestSeq = 0

async function loadLog() {
  if (!form.server) return
  const range = resolveRange()
  if (range.invalid) {
    ui.info('Check the time range', range.invalid)
    return
  }
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  try {
    const result = await wls.fetchLog(form.server, {
      log: form.log,
      query: buildQuery(),
      limit: Number(form.limit),
      startTime: range.startTime,
      endTime: range.endTime,
    })
    if (seq !== requestSeq) return
    rows.value = result
    activeRange.value = range
    lastUpdated.value = Date.now()
    if (!result.length) ui.info('No matching log records', 'Try a wider time window or a lower severity.')
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = err
    rows.value = []
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadAvailableLogs() {
  if (!form.server) return
  try {
    const result = await wls.availableLogs(form.server)
    const names = items(result).map((l) => l.name)
    if (names.length) logNames.value = names
  } catch {
    // Not every release exposes the accessor list; the defaults still work.
  }
}

/**
 * Every filter refetches, including the ones the back button changes - a URL
 * that says "last 6 hours" next to rows from the last hour is worse than no
 * URL state at all. Typing into Limit or a date box settles first.
 */
let debounce = null
function scheduleLoad(delay = 450) {
  clearTimeout(debounce)
  debounce = setTimeout(() => loadLog(), delay)
}

const ready = ref(false)

watch(
  () => [form.log, form.minSeverity, form.sinceMs, form.from, form.to, form.limit],
  () => {
    if (!ready.value || !form.server || rangeIssue.value) return
    scheduleLoad()
  },
)

watch(
  () => form.server,
  (server) => {
    if (!ready.value || !server) return
    loadAvailableLogs()
    scheduleLoad(0)
  },
)

onMounted(async () => {
  // A link that says "custom range" but carries no dates would otherwise open
  // on an error and a disabled button; give it the last hour to start from.
  if (isCustom.value && (!form.from || !form.to)) {
    const end = Date.now()
    form.from = toLocalInput(end - 60 * 60_000)
    form.to = toLocalInput(end)
  }
  await loadServers()
  if (form.server) {
    await loadAvailableLogs()
    await loadLog()
  }
  ready.value = true
})

onBeforeUnmount(() => clearTimeout(debounce))

// -------------------------------------------------------------------- sorting

function toggleSort(key) {
  const column = SORTS.find((s) => s.key === key)
  if (!column) return
  if (form.sort === key) form.dir = form.dir === 'asc' ? 'desc' : 'asc'
  else {
    form.sort = key
    form.dir = column.defaultDir
  }
}

/** Severity sorts by rank; alphabetical order would file Error under Emergency. */
function sortValue(row, key) {
  if (key === 'severity') return SEVERITY_RANK[row.severity] ?? SEVERITIES.length
  if (key === 'timestamp') return row.timestamp
  return String(row[key] ?? '').toLowerCase()
}

const sortedRows = computed(() => {
  const key = SORTS.some((s) => s.key === form.sort) ? form.sort : 'timestamp'
  const dir = form.dir === 'asc' ? 1 : -1
  return [...rows.value].sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    // A record with no readable timestamp goes last either way rather than
    // pretending to be from 1970.
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
  })
})

const sortArrow = (key) => (form.sort !== key ? '' : form.dir === 'asc' ? '↑' : '↓')

function formatTime(ts) {
  if (ts === null || ts === undefined) return '—'
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { hour12: false })
}

const summary = computed(() => {
  if (!rows.value.length) return ''
  const counts = rows.value.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] || 0) + 1
    return acc
  }, {})
  return Object.entries(counts)
    .map(([severity, count]) => `${count} ${severity.toLowerCase()}`)
    .join(' · ')
})
</script>

<template>
  <div>
    <PageHeader
      title="Logs"
      :subtitle="summary || 'Server log records via the WLDF accessor'"
      :last-updated="lastUpdated"
      :refreshing="loading"
      help="Reads log records straight out of a running server through the WLDF accessor, so you can search them without shell access to the machine. Set the filters, press Fetch, and the newest records appear first."
      @refresh="loadLog"
    />

    <HelpPanel id="logs" title="How to find the error behind an incident">
      <ol class="list-decimal space-y-1 pl-4">
        <li>Pick the <strong>Server</strong> that showed the problem. Only running servers can be queried.</li>
        <li>
          Leave <strong>Log</strong> on ServerLog for application and server messages. DomainLog is the AdminServer's
          merged copy, HTTPAccessLog is one line per HTTP request.
        </li>
        <li>
          Set <strong>Minimum severity</strong> to Error and a <strong>Time window</strong> that covers the incident,
          then press <strong>Fetch</strong>. When you know when it happened, pick <strong>Custom range</strong> and
          give the exact start and end.
        </li>
        <li>
          Nothing found? Widen the window or drop to Warning. Too much? Put a message id such as
          <code class="font-mono">BEA-000337</code> or a class name in <strong>Message contains</strong>.
        </li>
        <li>
          Click a heading in the <strong>Sort by</strong> row to reorder the records, and again to reverse it.
          Severity orders by seriousness rather than by name, so the worst records come first.
        </li>
      </ol>
      <p>
        The first matching record is usually the real cause; the ones after it are often knock-on failures. Note the
        subsystem in brackets - JDBC, JMS or Deployer tells you which page to look at next.
      </p>
      <p>
        These filters and the sort are kept in the page's address, so the browser's back button steps through them and
        the link in the address bar reopens exactly this search for whoever you send it to.
      </p>
    </HelpPanel>

    <div class="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
      <div>
        <label class="label-row" for="log-server">
          Server
          <InfoTip
            heading="Server"
            text="Which server's log to read. Each server writes its own log file, so pick the one that served the failing request. Stopped servers cannot be queried at all."
          />
        </label>
        <select id="log-server" v-model="form.server" class="input">
          <option v-if="!servers.length" value="">No running server</option>
          <option v-for="server in servers" :key="server" :value="server">{{ server }}</option>
        </select>
      </div>
      <div>
        <label class="label-row" for="log-name">
          Log
          <InfoTip
            heading="Log"
            text="ServerLog is the general server and application log and the right default. DomainLog is the AdminServer's merged view of the domain. HTTPAccessLog has one line per HTTP request. DataSourceLog carries JDBC detail."
          />
        </label>
        <select id="log-name" v-model="form.log" class="input">
          <option v-for="name in logNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
      <div>
        <label class="label-row" for="log-severity">
          Minimum severity
          <InfoTip
            heading="Minimum severity"
            text="Keeps this level and everything more serious. Error is the usual starting point; Warning catches problems that have not failed yet; Info is verbose on a busy server."
          />
        </label>
        <select id="log-severity" v-model="form.minSeverity" class="input">
          <option v-for="severity in SEVERITIES" :key="severity" :value="severity">{{ severity }}</option>
        </select>
      </div>
      <div>
        <label class="label-row" for="log-window">
          Time window
          <InfoTip
            heading="Time window"
            text="How far back to search, counted from now. Custom range takes an exact start and end in this browser's timezone, which is what you want when you know when the incident happened. Records outside the window are dropped even when the server sends them."
          />
        </label>
        <select id="log-window" v-model.number="form.sinceMs" class="input">
          <option v-for="window in WINDOWS" :key="window.value" :value="window.value">{{ window.label }}</option>
        </select>
      </div>
      <div>
        <label class="label-row" for="log-contains">
          Message contains
          <InfoTip
            heading="Message contains"
            text="Free text matched inside the message body, case sensitive. Good values: a message id such as BEA-000337, an exception class, an order number. Leave it empty to see everything at this severity."
          />
        </label>
        <input id="log-contains" v-model="form.contains" class="input" placeholder="e.g. BEA-000337" @keyup.enter="loadLog" />
      </div>
      <div class="flex items-end gap-2">
        <div class="w-20">
          <label class="label-row" for="log-limit">
            Limit
            <InfoTip
              heading="Limit"
              text="Most records to fetch, between 10 and 2000. The newest ones inside the window are kept, so a low limit on a wide window can hide older matches."
            />
          </label>
          <input id="log-limit" v-model.number="form.limit" class="input" type="number" min="10" max="2000" step="10" />
        </div>
        <button
          class="btn btn-primary flex-1"
          title="Run the query with these filters. Severity, log, window and time changes fetch on their own; the text box needs this button or the Enter key."
          :disabled="loading || !form.server || !!rangeIssue"
          @click="loadLog"
        >
          {{ loading ? 'Loading…' : 'Fetch' }}
        </button>
      </div>

      <div v-if="isCustom" class="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-3">
        <div>
          <label class="label-row" for="log-from">
            From
            <InfoTip
              heading="From"
              text="Start of the range, read in this browser's timezone. Records before it are not shown."
            />
          </label>
          <input id="log-from" v-model="form.from" class="input" type="datetime-local" />
        </div>
        <div>
          <label class="label-row" for="log-to">
            To
            <InfoTip
              heading="To"
              text="End of the range, read in this browser's timezone. Records after it are not shown."
            />
          </label>
          <input id="log-to" v-model="form.to" class="input" type="datetime-local" />
        </div>
        <p v-if="rangeIssue" class="self-end text-xs text-red-600 dark:text-red-400">{{ rangeIssue }}</p>
      </div>
    </div>

    <ErrorState v-if="error" :error="error" title="Could not read the log" @retry="loadLog" />

    <div v-else class="card overflow-hidden">
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
      >
        <span class="text-zinc-500 dark:text-zinc-400">Sort by</span>
        <button
          v-for="column in SORTS"
          :key="column.key"
          class="font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
          :class="
            form.sort === column.key
              ? 'text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-500 dark:text-zinc-400'
          "
          :title="`Order the records by ${column.label.toLowerCase()}. Click again to reverse it.`"
          @click="toggleSort(column.key)"
        >
          {{ column.label }} <span class="text-indigo-500">{{ sortArrow(column.key) }}</span>
        </button>
        <span v-if="activeRange" class="ml-auto tabular-nums text-zinc-400 dark:text-zinc-500">
          {{ rows.length }} records · {{ formatRange(activeRange) }}
        </span>
      </div>

      <div v-if="loading && !rows.length" class="p-10 text-center text-sm text-zinc-400">Reading log records…</div>
      <div v-else-if="!rows.length" class="p-10 text-center text-sm text-zinc-400">
        No records for these filters.
      </div>
      <ul v-else class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <li v-for="row in sortedRows" :key="row.id" class="px-3 py-2 font-mono text-xs leading-relaxed">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span class="tabular-nums text-zinc-400 dark:text-zinc-500">{{ formatTime(row.timestamp) }}</span>
            <span :class="['font-semibold uppercase', SEVERITY_CLASSES[row.severity] || 'text-zinc-500']">
              {{ row.severity || 'INFO' }}
            </span>
            <span v-if="row.subsystem" class="text-indigo-600 dark:text-indigo-400">[{{ row.subsystem }}]</span>
            <span v-if="row.messageId" class="text-zinc-400 dark:text-zinc-500">{{ row.messageId }}</span>
          </div>
          <p class="mt-0.5 whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-200">{{ row.message }}</p>
        </li>
      </ul>
    </div>

    <p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
      Records are read through the WLDF data accessor on the selected server and trimmed to the time window shown above.
    </p>
  </div>
</template>
