import { defineStore } from 'pinia'
import * as api from '@/api/client'
import { useAlertsStore } from '@/stores/alerts'
import { countDrops, fractionAtLeast, linearTrend, perMinute, ratePerHour, rollingMin, stats } from '@/utils/series'
import { t } from '@/i18n'

/**
 * The recent past of every server in the active domain.
 *
 * The numbers on the monitoring pages have always been polled; what was missing
 * was memory. A single reading of "heap at 78%" says nothing — whether it has
 * been climbing for an hour is the whole question. The backend samples each
 * live connection on a timer and keeps it, on disk as well as in memory, and
 * this store is the browser's copy: one poll feeds every chart on screen, and
 * the alert watcher reads the same samples.
 *
 * Only what is new is fetched: each poll asks for samples after the newest one
 * already held.
 *
 * Readings are handed out as `{t, v}` pairs rather than bare numbers. That
 * costs an object per point and buys the one thing a bare array cannot express:
 * *when* each reading was taken. A server that was down for forty minutes has
 * no readings for those forty minutes, and a chart given only values would
 * draw the gap as a short straight line between two distant moments — history
 * that was never observed, shown as though it had been.
 */

/**
 * How many samples the browser keeps, whatever the backend's retention is.
 * Twelve hours at the default interval: the backend hands over its own two
 * hours on connect, and a console left open collects the rest itself.
 */
const MAX_CLIENT_SAMPLES = 2880

const WINDOW_KEY = 'wl-console.history.window'

/** The ranges the monitoring page offers. 0 means everything held. */
export const WINDOW_OPTIONS = [
  { label: () => t('15 min'), value: 15 * 60_000 },
  { label: () => t('1 hour'), value: 60 * 60_000 },
  { label: () => t('6 hours'), value: 6 * 60 * 60_000 },
  { label: () => t('All'), value: 0 },
]

/**
 * Keys the backend leaves out when they are zero, because zero is what they
 * read almost all the time. A missing one means zero; a missing key outside
 * this set means the reading did not happen at all, which is a gap.
 */
const ZERO_KEYS = new Set(['dsa', 'dsc', 'dsw', 'dsf', 'jta', 'jtc', 'jtr', 'jmc', 'jmp'])

/** Every metric a chart or an export can ask for, with how it should read. */
export const METRICS = {
  hu: { label: () => t('Heap used'), unit: 'bytes' },
  hm: { label: () => t('Heap maximum'), unit: 'bytes' },
  tt: { label: () => t('Threads total'), unit: '' },
  tb: { label: () => t('Threads busy'), unit: '' },
  sk: { label: () => t('Stuck threads'), unit: '' },
  hg: { label: () => t('Hogging threads'), unit: '' },
  q: { label: () => t('Queue length'), unit: '' },
  pr: { label: () => t('Pending requests'), unit: '' },
  tp: { label: () => t('Throughput'), unit: 'req/s' },
  so: { label: () => t('Open sockets'), unit: '' },
  dsa: { label: () => t('JDBC connections in use'), unit: '' },
  dsc: { label: () => t('JDBC pool capacity'), unit: '' },
  dsw: { label: () => t('Waiting for a JDBC connection'), unit: '' },
  jta: { label: () => t('Active transactions'), unit: '' },
  jtr: { label: () => t('Rolled back transactions'), unit: 'total' },
  jmp: { label: () => t('JMS messages pending'), unit: '' },
}

// Timer and listener live outside the store: there is one poller, and neither
// belongs in reactive state.
let timer = null
let onVisible = null

function readWindow() {
  try {
    const raw = Number(localStorage.getItem(WINDOW_KEY))
    if (WINDOW_OPTIONS.some((option) => option.value === raw)) return raw
  } catch {
    /* storage disabled — the default window it is */
  }
  return 60 * 60_000
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    samples: [],
    intervalMs: 15000,
    /** False when the backend was started with WLC_SAMPLE_MS=0. */
    sampling: true,
    /** 'full' unless the backend was told to skip JDBC, JTA and JMS. */
    depth: 'full',
    /** Whether the backend can forward an alert to somebody not watching. */
    webhook: false,
    retentionMs: 0,
    fileRetentionMs: 0,
    error: null,
    connectionId: null,
    polling: false,
    /** The span the charts show. Held here so every page agrees on it. */
    windowMs: readWindow(),
  }),

  getters: {
    latest: (state) => state.samples[state.samples.length - 1] || null,

    /**
     * A hole wider than this is a gap rather than a slow tick. Two and a half
     * intervals leaves room for one late sample without breaking the line.
     */
    gapMs: (state) => state.intervalMs * 2.5,

    /** The samples inside the chosen window — what every chart reads. */
    windowed: (state) => {
      if (!state.windowMs) return state.samples
      const cutoff = Date.now() - state.windowMs
      return state.samples.filter((sample) => sample.t >= cutoff)
    },

    /** Every server name seen in the buffer, not only the ones running now. */
    serverNames: (state) => {
      const names = new Set()
      for (const sample of state.samples) for (const name of Object.keys(sample.servers)) names.add(name)
      return [...names].sort()
    },

    /** Data sources this server has been seen using, newest sample first. */
    dataSourceNames: (state) => (server) => {
      const names = new Set()
      for (let index = state.samples.length - 1; index >= 0; index -= 1) {
        for (const name of Object.keys(state.samples[index].servers[server]?.ds || {})) names.add(name)
      }
      return [...names].sort()
    },

    /**
     * One metric of one server, in time order.
     *
     * A sample with no entry for this server is skipped rather than zero-filled
     * — a server that was down has no reading, and drawing that as zero would
     * be a lie — and the timestamps carried alongside let the chart show the
     * hole for what it is.
     */
    points() {
      return (server, key) => {
        const out = []
        for (const sample of this.windowed) {
          const entry = sample.servers[server]
          if (!entry) continue
          const raw = entry[key]
          if (typeof raw === 'number') out.push({ t: sample.t, v: raw })
          // A zero-omitted key reads as zero, but only where there was a
          // runtime to read: an entry carrying nothing but a state is a server
          // that was down, and it has no reading of anything.
          else if (ZERO_KEYS.has(key) && entry.tt !== undefined) out.push({ t: sample.t, v: 0 })
        }
        return out
      }
    },

    /** Heap used as a percentage of maximum, the series worth watching most. */
    heapPercentPoints() {
      return (server) => {
        const out = []
        for (const sample of this.windowed) {
          const entry = sample.servers[server]
          if (!entry?.hm) continue
          out.push({ t: sample.t, v: (entry.hu / entry.hm) * 100 })
        }
        return out
      }
    },

    /** One data source's readings on one server: 'a', 'c', 'w', 'd' or 'f'. */
    dataSourcePoints() {
      return (server, dataSource, key) => {
        const out = []
        for (const sample of this.windowed) {
          const entry = sample.servers[server]
          if (!entry || entry.tt === undefined) continue
          out.push({ t: sample.t, v: Number(entry.ds?.[dataSource]?.[key] || 0) })
        }
        return out
      }
    },

    /** A monotonic total read as a rate — transactions and messages per minute. */
    ratePoints() {
      return (server, key) => perMinute(this.points(server, key))
    },

    /**
     * What the heap is doing underneath the sawtooth, and what that means.
     *
     * `baseline` is the floor each collection returns to; `perHour` is how fast
     * that floor is moving; `collections` is how often the JVM had to collect.
     * Together they separate the two states that look identical in a single
     * reading: a busy server with a healthy heap, and one that is leaking.
     */
    heapAnalysis() {
      return (server) => {
        const points = this.heapPercentPoints(server)
        const baseline = rollingMin(points, Math.max(4, Math.round(120_000 / this.intervalMs) * 2))
        const trend = linearTrend(baseline)
        const spanMs = points.length > 1 ? points[points.length - 1].t - points[0].t : 0
        // One percentage point is well above sampling noise and well below any
        // collection worth counting.
        const collections = countDrops(points, 1)
        return {
          points,
          baseline,
          summary: stats(points),
          floor: stats(baseline),
          perHour: trend.perHour,
          confident: trend.confident,
          collectionsPerHour: ratePerHour(collections, spanMs),
          spanMs,
        }
      }
    },

    /**
     * How hard the thread pool has been working, rather than how hard it is
     * working right now.
     *
     * `saturated` is the share of the window the pool spent at 90% busy or
     * more — the number that separates "it peaked while I was looking" from
     * "it has been full all morning". `perThread` is throughput divided by the
     * threads doing it, which says whether requests got slower or merely more
     * numerous.
     */
    poolAnalysis() {
      return (server) => {
        const busy = this.points(server, 'tb')
        const total = this.points(server, 'tt')
        const byTime = new Map(total.map((point) => [point.t, point.v]))
        const used = busy
          .filter((point) => byTime.get(point.t))
          .map((point) => ({ t: point.t, v: (point.v / byTime.get(point.t)) * 100 }))
        const throughput = this.points(server, 'tp')
        const perThread = throughput
          .map((point, index) => ({ t: point.t, busy: busy[index]?.v || 0, v: point.v }))
          .filter((point) => point.busy > 0)
          .map((point) => ({ t: point.t, v: point.v / point.busy }))
        return {
          busy,
          used,
          throughput,
          queue: this.points(server, 'q'),
          saturated: fractionAtLeast(used, 90),
          summary: stats(used),
          perThread: stats(perThread).avg,
        }
      }
    },

    /**
     * Restarts inside the window.
     *
     * WebLogic reports when the JVM came up; a value that changes between two
     * samples means the process went away and came back. Nothing else in the
     * buffer says so — a server that crashes and is restarted by Node Manager
     * between two samples looks, in every other number, like a server that
     * simply got quieter.
     */
    restarts() {
      return (server) => {
        const out = []
        let previous = null
        for (const sample of this.windowed) {
          const at = sample.servers[server]?.ac
          if (!at) continue
          if (previous && at !== previous) out.push({ t: sample.t, activatedAt: at })
          previous = at
        }
        return out
      }
    },

    span: (state) => {
      const samples = state.windowMs
        ? state.samples.filter((sample) => sample.t >= Date.now() - state.windowMs)
        : state.samples
      if (samples.length < 2) return 0
      return samples[samples.length - 1].t - samples[0].t
    },

    /** The window as a sentence, for a chart title. */
    windowLabel: (state) => {
      const minutes = Math.round(state.span / 60000)
      if (!minutes) return t('building up')
      if (minutes < 60) return t('last {minutes} min', { minutes })
      return t('last {hours} h', { hours: (minutes / 60).toFixed(1) })
    },
  },

  actions: {
    reset() {
      this.samples = []
      this.error = null
    },

    setWindow(ms) {
      this.windowMs = Number(ms) || 0
      try {
        localStorage.setItem(WINDOW_KEY, String(this.windowMs))
      } catch {
        /* storage disabled — the window resets next visit */
      }
    },

    async refresh() {
      const since = this.latest?.t || 0
      try {
        const payload = await api.history(since)
        this.sampling = payload?.sampling !== false
        this.intervalMs = Number(payload?.intervalMs) || this.intervalMs
        this.retentionMs = Number(payload?.retentionMs) || 0
        this.fileRetentionMs = Number(payload?.fileRetentionMs) || 0
        this.depth = payload?.depth || 'full'
        this.webhook = Boolean(payload?.webhook)
        this.error = payload?.error || null
        const incoming = Array.isArray(payload?.samples) ? payload.samples : []
        if (incoming.length) {
          this.samples = [...this.samples, ...incoming].slice(-MAX_CLIENT_SAMPLES)
          useAlertsStore().ingest(incoming, { intervalMs: this.intervalMs, webhook: this.webhook })
        }
      } catch (err) {
        // A dead session is handled by whichever page is open; here it only
        // means there is nothing to draw.
        this.error = err?.fullText || err?.message || t('History is unavailable.')
      }
    },

    /**
     * Polls for as long as the console is open, pausing with the tab so a
     * console left overnight stops asking. The backend keeps sampling on its
     * own if it was started with WLC_SAMPLE_ALWAYS=1, and keeps what it
     * collected on disk either way.
     */
    start(connectionId) {
      this.stop()
      if (connectionId !== this.connectionId) {
        this.reset()
        this.connectionId = connectionId
      }
      if (!connectionId) return
      this.polling = true

      const tick = async () => {
        if (!this.polling) return
        if (document.visibilityState === 'visible') await this.refresh()
        if (this.polling) timer = setTimeout(tick, Math.max(5000, this.intervalMs))
      }
      tick()

      onVisible = () => {
        if (document.visibilityState === 'visible') this.refresh()
      }
      document.addEventListener('visibilitychange', onVisible)
    },

    stop() {
      this.polling = false
      clearTimeout(timer)
      timer = null
      if (onVisible) {
        document.removeEventListener('visibilitychange', onVisible)
        onVisible = null
      }
    },

    /**
     * The window on screen, flattened for a spreadsheet.
     *
     * A capacity review or an incident ticket is written somewhere else, and
     * the numbers in it are retyped from a screenshot unless the console can
     * simply hand them over. One row per server per sample, so a pivot table
     * can do the rest.
     */
    exportRows(servers) {
      const wanted = servers?.length ? new Set(servers) : null
      const rows = []
      for (const sample of this.windowed) {
        for (const [server, entry] of Object.entries(sample.servers)) {
          if (wanted && !wanted.has(server)) continue
          rows.push({
            time: new Date(sample.t).toISOString(),
            server,
            state: entry.st,
            health: entry.he,
            heapUsedBytes: entry.hu ?? '',
            heapMaxBytes: entry.hm ?? '',
            heapPercent: entry.hm ? ((entry.hu / entry.hm) * 100).toFixed(1) : '',
            threadsTotal: entry.tt ?? '',
            threadsBusy: entry.tb ?? '',
            stuckThreads: entry.sk ?? '',
            hoggingThreads: entry.hg ?? '',
            queueLength: entry.q ?? '',
            pendingRequests: entry.pr ?? '',
            throughput: entry.tp ?? '',
            openSockets: entry.so ?? '',
            jdbcActive: entry.dsa ?? 0,
            jdbcCapacity: entry.dsc ?? 0,
            jdbcWaiting: entry.dsw ?? 0,
            activeTransactions: entry.jta ?? 0,
            rolledBackTransactions: entry.jtr ?? 0,
            jmsPending: entry.jmp ?? 0,
          })
        }
      }
      return rows
    },
  },
})

/** Column order for the export above, so the CSV reads left to right. */
export const EXPORT_COLUMNS = [
  { key: 'time', label: () => t('Time') },
  { key: 'server', label: () => t('Server') },
  { key: 'state', label: () => t('State') },
  { key: 'health', label: () => t('Health') },
  { key: 'heapUsedBytes', label: () => t('Heap used (bytes)') },
  { key: 'heapMaxBytes', label: () => t('Heap maximum (bytes)') },
  { key: 'heapPercent', label: () => t('Heap %') },
  { key: 'threadsTotal', label: () => t('Threads total') },
  { key: 'threadsBusy', label: () => t('Threads busy') },
  { key: 'stuckThreads', label: () => t('Stuck threads') },
  { key: 'hoggingThreads', label: () => t('Hogging threads') },
  { key: 'queueLength', label: () => t('Queue length') },
  { key: 'pendingRequests', label: () => t('Pending requests') },
  { key: 'throughput', label: () => t('Throughput') },
  { key: 'openSockets', label: () => t('Open sockets') },
  { key: 'jdbcActive', label: () => t('JDBC connections in use') },
  { key: 'jdbcCapacity', label: () => t('JDBC pool capacity') },
  { key: 'jdbcWaiting', label: () => t('Waiting for a JDBC connection') },
  { key: 'activeTransactions', label: () => t('Active transactions') },
  { key: 'rolledBackTransactions', label: () => t('Rolled back transactions') },
  { key: 'jmsPending', label: () => t('JMS messages pending') },
]
