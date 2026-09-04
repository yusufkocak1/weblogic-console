<script setup>
import { computed, onMounted, reactive, ref, toRef, watch } from 'vue'
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

const WINDOWS = [
  { label: 'Last 15 minutes', value: 15 * 60_000 },
  { label: 'Last hour', value: 60 * 60_000 },
  { label: 'Last 6 hours', value: 6 * 60 * 60_000 },
  { label: 'Last 24 hours', value: 24 * 60 * 60_000 },
  { label: 'Last 7 days', value: 7 * 24 * 60 * 60_000 },
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

const form = reactive({
  server: '',
  log: 'ServerLog',
  minSeverity: 'Warning',
  contains: '',
  sinceMs: 60 * 60_000,
  limit: 200,
})

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
    limit: toRef(form, 'limit'),
  },
  { server: '', log: 'ServerLog', severity: 'Warning', contains: '', since: 60 * 60_000, limit: 200 },
)

const servers = ref([])
const logNames = ref(['ServerLog', 'DomainLog', 'HTTPAccessLog', 'DataSourceLog'])
const rows = ref([])
const error = ref(null)
const loading = ref(false)
const lastUpdated = ref(null)

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

async function loadLog() {
  if (!form.server) return
  loading.value = true
  error.value = null
  try {
    const result = await wls.fetchLog(form.server, {
      log: form.log,
      query: buildQuery(),
      limit: Number(form.limit),
      sinceMs: Number(form.sinceMs),
    })
    // Newest first: the accessor returns records in chronological order.
    rows.value = [...result].reverse()
    lastUpdated.value = Date.now()
    if (!result.length) ui.info('No matching log records', 'Try a wider time window or a lower severity.')
  } catch (err) {
    error.value = err
    rows.value = []
  } finally {
    loading.value = false
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

watch(
  () => form.server,
  (server) => {
    if (!server) return
    loadAvailableLogs()
    loadLog()
  },
)

onMounted(async () => {
  await loadServers()
  if (form.server) {
    await loadAvailableLogs()
    await loadLog()
  }
})

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(Number(ts)).toLocaleString(undefined, { hour12: false })
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
          then press <strong>Fetch</strong>.
        </li>
        <li>
          Nothing found? Widen the window or drop to Warning. Too much? Put a message id such as
          <code class="font-mono">BEA-000337</code> or a class name in <strong>Message contains</strong>.
        </li>
      </ol>
      <p>
        The first matching record is usually the real cause; the ones after it are often knock-on failures. Note the
        subsystem in brackets - JDBC, JMS or Deployer tells you which page to look at next.
      </p>
      <p>
        These filters are kept in the page's address, so the browser's back button steps through them and the link in
        the address bar reopens exactly this search for whoever you send it to.
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
        <select id="log-name" v-model="form.log" class="input" @change="loadLog">
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
        <select id="log-severity" v-model="form.minSeverity" class="input" @change="loadLog">
          <option v-for="severity in SEVERITIES" :key="severity" :value="severity">{{ severity }}</option>
        </select>
      </div>
      <div>
        <label class="label-row" for="log-window">
          Time window
          <InfoTip
            heading="Time window"
            text="How far back to search, counted from now. Start narrow: a wide window on a busy server returns a lot and takes longer to read."
          />
        </label>
        <select id="log-window" v-model.number="form.sinceMs" class="input" @change="loadLog">
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
              text="Most records to fetch, between 10 and 2000. The newest are kept, so a low limit on a wide window can hide older matches."
            />
          </label>
          <input id="log-limit" v-model.number="form.limit" class="input" type="number" min="10" max="2000" step="10" />
        </div>
        <button
          class="btn btn-primary flex-1"
          title="Run the query with these filters. Severity, log, window and time changes fetch on their own; the text box needs this button or the Enter key."
          :disabled="loading || !form.server"
          @click="loadLog"
        >
          {{ loading ? 'Loading…' : 'Fetch' }}
        </button>
      </div>
    </div>

    <ErrorState v-if="error" :error="error" title="Could not read the log" @retry="loadLog" />

    <div v-else class="card overflow-hidden">
      <div v-if="loading && !rows.length" class="p-10 text-center text-sm text-zinc-400">Reading log records…</div>
      <div v-else-if="!rows.length" class="p-10 text-center text-sm text-zinc-400">
        No records for these filters.
      </div>
      <ul v-else class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <li v-for="row in rows" :key="row.id" class="px-3 py-2 font-mono text-xs leading-relaxed">
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
      Records are read through the WLDF data accessor on the selected server, newest first.
    </p>
  </div>
</template>
