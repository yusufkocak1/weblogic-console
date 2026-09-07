import { defineStore } from 'pinia'
import * as api from '@/api/client'
import * as wls from '@/api/weblogic'
import { useUiStore } from '@/stores/ui'
import { items, targetNames } from '@/utils/format'
import { setTitleBadge } from '@/utils/title'
import { t } from '@/i18n'

/**
 * Watching the domain, so nobody has to sit and watch it.
 *
 * A console you have to look at only helps while you are looking. These rules
 * run over every runtime sample the backend collects — on every page, not only
 * the dashboard — and say something the moment a server leaves RUNNING, a heap
 * stays high, or a thread gets stuck.
 *
 * Rules are edge-triggered: an alert is raised when a condition starts holding
 * and again only after it has stopped. A heap sitting at 95% for an hour is one
 * alert, not two hundred and forty.
 *
 * Two things separate a threshold that is useful from one that gets muted in a
 * week. The first is that a level has to *hold*: a heap touching 91% for a
 * single sample during a garbage collection is not news, so level rules must be
 * true continuously for `sustainMs` before they are announced, while rules
 * about state — a server leaving RUNNING, a thread going stuck — fire at once,
 * because those are already events rather than levels. The second is that one
 * threshold rarely fits every server: an AdminServer idling at 85% heap is
 * normal and a managed server doing the same is not, so any rule can be
 * overridden per server.
 *
 * The third thing is that a domain is rarely one person's to look after. A
 * console watching every cluster tells an operator who runs the payments
 * cluster about the reporting cluster's heap, and the bell that cries about
 * somebody else's servers is the bell that gets ignored when it is about
 * yours. So the watch itself has a scope: a cluster can be left out of it
 * entirely, which is a snooze that does not expire and is chosen by where a
 * server lives rather than by its name.
 */

const RULES_KEY = 'wl-console.alerts.rules'
const OVERRIDES_KEY = 'wl-console.alerts.overrides'
const DESKTOP_KEY = 'wl-console.alerts.desktop'
const FORWARD_KEY = 'wl-console.alerts.forward'
const ALERTS_KEY = 'wl-console.alerts.log'
const SNOOZE_KEY = 'wl-console.alerts.snoozed'
const CLUSTERS_KEY = 'wl-console.alerts.unwatched'
const MAX_ALERTS = 200
/** Alerts older than this are not worth reading back after a reload. */
const ALERT_TTL_MS = 24 * 60 * 60 * 1000

export const DEFAULT_RULES = {
  /** Any server that was RUNNING and no longer is. */
  serverDown: true,
  /** Heap in use, as a percentage of the JVM maximum. */
  heapPercent: 90,
  /** Threads busy longer than the server's stuck-thread timeout. */
  stuckThreads: 1,
  /** Requests waiting for a thread. */
  queueLength: 50,
  /** A running server reporting anything other than OK. */
  unhealthy: true,
  /** Threads waiting for a JDBC connection. 0 turns the rule off. */
  jdbcWaiting: 1,
  /** JMS messages sitting unacknowledged. 0 turns the rule off. */
  jmsPending: 0,
  /**
   * A heap that climbs this many percentage points inside the window below.
   * This is the rule that catches a leak before it reaches the ceiling, which
   * a fixed threshold by definition cannot.
   */
  heapRisePercent: 25,
  heapRiseMinutes: 10,
  /** A JVM whose start time changed between two samples — it was restarted. */
  restart: true,
  /**
   * How long a level has to hold before it is announced. Zero announces the
   * first sample that crosses, which is what this console used to do and what
   * made a threshold near the working range unusable.
   */
  sustainMs: 60_000,
}

/** How long a snooze lasts, offered where one is taken. */
export const SNOOZE_OPTIONS = [
  { label: () => t('15 minutes'), value: 15 * 60_000 },
  { label: () => t('1 hour'), value: 60 * 60_000 },
  { label: () => t('4 hours'), value: 4 * 60 * 60_000 },
  { label: () => t('Until tomorrow'), value: 12 * 60 * 60_000 },
]

/** Rules about a level, which must hold; everything else is an event. */
const SUSTAINED = new Set(['heap', 'queue', 'health', 'jdbc', 'jms'])

function readJson(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    return raw && typeof raw === 'object' ? raw : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled or full — the setting lasts as long as this page */
  }
}

function readRules() {
  return { ...DEFAULT_RULES, ...readJson(RULES_KEY, {}) }
}

function readAlerts() {
  const raw = readJson(ALERTS_KEY, [])
  if (!Array.isArray(raw)) return []
  const cutoff = Date.now() - ALERT_TTL_MS
  return raw.filter((alert) => alert && typeof alert.at === 'number' && alert.at > cutoff).slice(0, MAX_ALERTS)
}

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

let sequence = Date.now()

/**
 * Which conditions are currently holding, keyed by rule and server, and since
 * when. This is what makes the rules edge-triggered rather than a stream of
 * repeats, and what lets a level be required to hold before it is announced.
 */
const conditions = new Map()

/**
 * A short tail of heap readings per server, long enough to answer "how much has
 * this climbed in the last ten minutes". The history store holds the same
 * numbers, but a rule that reached into it would only run when a page using it
 * was open; this runs wherever the samples arrive.
 */
const heapTail = new Map()

/** The JVM start time last seen per server, for spotting a restart. */
const lastActivation = new Map()

export const useAlertsStore = defineStore('alerts', {
  state: () => ({
    alerts: readAlerts(),
    // An alert raised while the tab was closed is still unread when it opens.
    unread: readAlerts().filter((alert) => !alert.read).length,
    rules: readRules(),
    /** Per-server thresholds, sparse: only what differs from the rules above. */
    overrides: readJson(OVERRIDES_KEY, {}),
    /** server -> epoch ms until which nothing about it is announced. */
    snoozed: readJson(SNOOZE_KEY, {}),
    /**
     * Clusters left out of the watch, as `{[cluster]: true}`. Sparse and
     * inverted on purpose: a cluster added to the domain tomorrow is watched
     * without anybody having to come back here and say so.
     */
    unwatched: readJson(CLUSTERS_KEY, {}),
    /**
     * server -> the cluster it is configured into, or '' for a server that is
     * in none. Read from the domain's configuration rather than from the
     * samples, because a stopped server has no runtime to ask and "a member of
     * the cluster I am not watching is down" is precisely the alert this has to
     * be able to place.
     */
    membership: {},
    /** Whether that map has been asked for yet on this connection. */
    topologyRead: false,
    /** Browser notifications, off until the user turns them on and grants it. */
    desktop: readFlag(DESKTOP_KEY),
    /** Hand alerts to the backend's webhook as well, when it has one. */
    forward: readFlag(FORWARD_KEY),
    /** Whether the backend actually has a webhook configured. */
    webhookAvailable: false,
    /** Set while the user is looking at the panel, so nothing is marked unread. */
    open: false,
    /**
     * False until the first batch of samples has been read. That batch is the
     * state of the domain as you found it, not news: three servers that were
     * already down are a fact the dashboard shows plainly, and announcing them
     * as three alerts on every page load would teach you to ignore the bell.
     */
    primed: false,
  }),

  getters: {
    worst: (state) => {
      if (state.alerts.some((alert) => !alert.read && alert.severity === 'error')) return 'error'
      if (state.alerts.some((alert) => !alert.read && alert.severity === 'warn')) return 'warn'
      return state.alerts.some((alert) => !alert.read) ? 'info' : 'none'
    },

    /** The value a rule has for one server: its override, else the default. */
    ruleFor: (state) => (server, key) => {
      const override = state.overrides[server]?.[key]
      return override === undefined || override === null || override === '' ? state.rules[key] : override
    },

    /** Servers with a threshold of their own, for the panel to list. */
    overriddenServers: (state) => Object.keys(state.overrides).sort(),

    snoozedUntil: (state) => (server) => {
      const until = state.snoozed[server]
      return until && until > Date.now() ? until : null
    },

    anySnoozed: (state) => Object.values(state.snoozed).some((until) => until > Date.now()),

    /** The cluster a server belongs to, '' for none, undefined while unknown. */
    clusterOf: (state) => (server) => state.membership[server],

    /**
     * Whether this server is inside a cluster nobody asked to watch.
     *
     * A server the map does not mention yet is watched. The alternative — no
     * map, so everything counts as "in no cluster" — would let an operator who
     * left the standalone group out silence the whole domain for the seconds
     * between connecting and reading the configuration, including the
     * AdminServer.
     */
    unwatchedServer: (state) => (server) => {
      const cluster = state.membership[server]
      return cluster === undefined ? false : Boolean(state.unwatched[cluster])
    },

    /** The clusters left out, for the panel to show and offer back. */
    unwatchedClusters: (state) => Object.keys(state.unwatched).sort(),

    /**
     * One row per cluster for the panel: its members, and whether it is
     * watched. A cluster that is only in the ignore list — the domain was
     * switched, or it was removed — is still listed, or there would be no way
     * to take it off that list again.
     */
    watchGroups: (state) => {
      const groups = new Map()
      for (const [server, cluster] of Object.entries(state.membership)) {
        if (!groups.has(cluster)) groups.set(cluster, [])
        groups.get(cluster).push(server)
      }
      for (const cluster of Object.keys(state.unwatched)) if (!groups.has(cluster)) groups.set(cluster, [])
      return [...groups.entries()]
        .map(([cluster, servers]) => ({
          cluster,
          servers: servers.sort(),
          watched: !state.unwatched[cluster],
        }))
        // Servers in no cluster are a group like any other, but they are not a
        // cluster, so they go last rather than first under an empty name.
        .sort((a, b) => {
          if (!a.cluster !== !b.cluster) return a.cluster ? -1 : 1
          return a.cluster.localeCompare(b.cluster)
        })
    },

    /** Anything at all being kept quiet, for the bell to admit to. */
    anyMuted() {
      return this.anySnoozed || Object.keys(this.unwatched).length > 0
    },
  },

  actions: {
    setRule(key, value) {
      this.rules = { ...this.rules, [key]: value }
      writeJson(RULES_KEY, this.rules)
    },

    /** One server's own threshold. An empty value drops back to the default. */
    setOverride(server, key, value) {
      const next = { ...(this.overrides[server] || {}) }
      if (value === '' || value === null || value === undefined) delete next[key]
      else next[key] = value
      const all = { ...this.overrides }
      if (Object.keys(next).length) all[server] = next
      else delete all[server]
      this.overrides = all
      writeJson(OVERRIDES_KEY, all)
    },

    clearOverrides(server) {
      const all = { ...this.overrides }
      if (server) delete all[server]
      this.overrides = server ? all : {}
      writeJson(OVERRIDES_KEY, this.overrides)
    },

    resetRules() {
      this.rules = { ...DEFAULT_RULES }
      try {
        localStorage.removeItem(RULES_KEY)
      } catch {
        /* nothing to clean up */
      }
    },

    /**
     * Quiet about one server for a while.
     *
     * The alternative to this is turning a rule off across the domain because
     * one server is being worked on, and then not turning it back on. A snooze
     * expires by itself.
     */
    snooze(server, ms) {
      const all = { ...this.snoozed }
      if (ms) all[server] = Date.now() + Number(ms)
      else delete all[server]
      this.snoozed = all
      writeJson(SNOOZE_KEY, all)
    },

    /**
     * Which clusters this bell speaks for.
     *
     * Unwatching is deliberately not a rule that can be forgotten about: the
     * bell keeps a mark while any part of the domain is out of the watch, and
     * the panel lists what is missing, because a quiet console and a console
     * that was told to be quiet look identical otherwise.
     */
    watchCluster(cluster, watched) {
      const key = cluster || ''
      const all = { ...this.unwatched }
      if (watched) delete all[key]
      else all[key] = true
      this.unwatched = all
      writeJson(CLUSTERS_KEY, all)
    },

    /** Back to watching the whole domain. */
    watchEverything() {
      this.unwatched = {}
      writeJson(CLUSTERS_KEY, {})
    },

    /**
     * Reads which cluster each server is configured into.
     *
     * One request per connection, from the configuration rather than the
     * runtime: the servers this most needs to place are the ones that are down.
     * A failure is not retried on every sample — with no map nothing is
     * filtered, which is the behaviour this console had before — but opening
     * the panel asks again.
     */
    async readTopology(force = false) {
      if (this.topologyRead && !force) return this.membership
      this.topologyRead = true
      try {
        const payload = await wls.configuredServers()
        const map = {}
        for (const server of items(payload)) {
          if (!server?.name) continue
          map[server.name] = targetNames(server.cluster)[0] || ''
        }
        this.membership = map
      } catch {
        /* left unfiltered rather than wrongly filtered */
      }
      return this.membership
    },

    /** Asks the browser for permission the first time notifications are turned on. */
    async setDesktop(enabled) {
      if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          /* dismissed — fall through and let the check below decide */
        }
      }
      const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
      this.desktop = Boolean(enabled) && granted
      try {
        localStorage.setItem(DESKTOP_KEY, this.desktop ? '1' : '0')
      } catch {
        /* storage disabled */
      }
      if (enabled && !granted) {
        useUiStore().info(
          t('Desktop notifications are blocked'),
          t('The browser refused permission for this site, so alerts will only appear in the console.'),
        )
      }
      return this.desktop
    },

    setForward(enabled) {
      this.forward = Boolean(enabled)
      try {
        localStorage.setItem(FORWARD_KEY, this.forward ? '1' : '0')
      } catch {
        /* storage disabled */
      }
    },

    persist() {
      writeJson(ALERTS_KEY, this.alerts)
    },

    raise({ key, severity = 'warn', title, detail = '', server = '' }) {
      const alert = {
        id: (sequence += 1),
        key,
        severity,
        title,
        detail,
        server,
        at: Date.now(),
        read: this.open,
      }
      this.alerts.unshift(alert)
      if (this.alerts.length > MAX_ALERTS) this.alerts.length = MAX_ALERTS
      if (!alert.read) this.unread += 1
      setTitleBadge(this.unread)
      this.persist()

      const ui = useUiStore()
      if (severity === 'error') ui.error(title, detail)
      else if (severity === 'warn') ui.notify({ tone: 'error', title, detail, timeout: 12000 })
      else ui.info(title, detail)

      if (this.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: detail, tag: key })
        } catch {
          // Some browsers refuse to construct notifications outside a service
          // worker; the in-console toast has already been shown either way.
        }
      }

      // Out of the browser entirely, when the backend was given somewhere to
      // send it. Deliberately not awaited: an alert is on screen already, and
      // a slow chat server must not hold up the sample being processed.
      if (this.forward && this.webhookAvailable && severity !== 'info') {
        api.notify({ severity, title, detail, server }).catch(() => {
          /* the backend reports its own failures; here it changes nothing */
        })
      }
      return alert
    },

    /**
     * Runs the rules over new samples.
     *
     * @param {{t: number, servers: Record<string, object>}[]} samples
     * @param {{intervalMs?: number, webhook?: boolean}} context
     */
    ingest(samples, context = {}) {
      if (context.webhook !== undefined) this.webhookAvailable = Boolean(context.webhook)
      // Samples arrive wherever the console is open, so this is also where the
      // map of who belongs to which cluster gets read — not awaited, because
      // this batch is judged with whatever is already known.
      if (!this.topologyRead) this.readTopology()
      // The first batch also carries whatever history the backend had already
      // collected, so it only sets the baseline. Everything after it is a
      // change that happened while you were watching.
      const silent = !this.primed
      for (const sample of samples) {
        for (const [server, entry] of Object.entries(sample.servers || {})) {
          this.remember(server, entry, sample.t)
          this.check(server, entry, silent, sample.t)
        }
      }
      if (samples.length) this.primed = true
    },

    /** Keeps the tail of readings the rules that need more than one sample use. */
    remember(server, entry, at) {
      if (!entry.hm) return
      const tail = heapTail.get(server) || []
      tail.push({ t: at, v: (entry.hu / entry.hm) * 100 })
      const window = Math.max(1, Number(this.rules.heapRiseMinutes || 10)) * 60_000
      while (tail.length > 2 && tail[0].t < at - window) tail.shift()
      heapTail.set(server, tail)
    },

    /** How much the heap has climbed across the tail above, in points. */
    heapRise(server) {
      const tail = heapTail.get(server)
      if (!tail || tail.length < 3) return null
      const window = Math.max(1, Number(this.rules.heapRiseMinutes || 10)) * 60_000
      // Only worth reporting once the tail actually covers most of its window;
      // before that a rise of 25 points may be 25 points in ninety seconds.
      if (tail[tail.length - 1].t - tail[0].t < window * 0.8) return null
      let lowest = tail[0].v
      for (const point of tail) if (point.v < lowest) lowest = point.v
      return tail[tail.length - 1].v - lowest
    },

    /** One server, one sample. Kept separate so it can be reasoned about alone. */
    check(server, entry, silent = false, at = Date.now()) {
      const running = entry.st === 'RUNNING'
      const rule = (key) => this.ruleFor(server, key)
      // A snooze silences the announcement, not the bookkeeping: conditions
      // still rise and clear underneath, so nothing double-fires when it ends.
      // An unwatched cluster is the same thing without an end date.
      const quiet = silent || Boolean(this.snoozedUntil(server)) || this.unwatchedServer(server)

      this.evaluate(quiet, at, {
        key: `down:${server}`,
        active: rule('serverDown') && !running && entry.st !== 'UNKNOWN',
        severity: 'error',
        title: t('{server} is {state}', { server, state: String(entry.st || t('not running')).toLowerCase() }),
        detail: t('The server left the RUNNING state. Check the Servers page and its log.'),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} is running again', { server }),
          detail: t('The server is back in the RUNNING state.'),
        },
      })

      // A JVM whose start time moved went away and came back. Nothing else in
      // a sample says so: every other number simply starts again from a
      // plausible value, and a crash-restart loop reads as a quiet server.
      const activation = Number(entry.ac || 0)
      const previousActivation = lastActivation.get(server)
      if (activation) lastActivation.set(server, activation)
      if (
        rule('restart') &&
        !quiet &&
        running &&
        previousActivation &&
        activation &&
        activation !== previousActivation
      ) {
        this.raise({
          key: `restart:${server}:${activation}`,
          severity: 'warn',
          server,
          title: t('{server} restarted', { server }),
          detail: t(
            'This JVM started again at {time}. If nobody restarted it, the process is failing and being brought back.',
            { time: new Date(activation).toLocaleTimeString() },
          ),
        })
      }

      const heapPercent = entry.hm ? (entry.hu / entry.hm) * 100 : null
      this.evaluate(quiet, at, {
        key: `heap:${server}`,
        observable: running,
        kind: 'heap',
        active: running && heapPercent !== null && heapPercent >= Number(rule('heapPercent') || 0),
        severity: 'warn',
        title: t('{server} heap at {percent}%', { server, percent: Math.round(heapPercent || 0) }),
        detail: t(
          'Heap in use has passed {threshold}% of the JVM maximum for {minutes} min. Sustained, this shows up as slowness long before an OutOfMemoryError.',
          { threshold: rule('heapPercent'), minutes: Math.round(Number(this.rules.sustainMs || 0) / 60000) || 1 },
        ),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} heap is back under {threshold}%', { server, threshold: rule('heapPercent') }),
          detail: t('Garbage collection recovered the memory.'),
        },
      })

      // The shape a leak makes, rather than the level it eventually reaches.
      const rise = running ? this.heapRise(server) : null
      const riseLimit = Number(rule('heapRisePercent') || 0)
      this.evaluate(quiet, at, {
        key: `heaprise:${server}`,
        observable: running,
        active: riseLimit > 0 && rise !== null && rise >= riseLimit,
        severity: 'warn',
        title: t('{server} heap climbing', { server }),
        detail: t(
          'Heap has risen {points} points in the last {minutes} min without coming back down. That is the shape of a leak, whatever the current level is.',
          {
            points: Math.round(rise || 0),
            minutes: this.rules.heapRiseMinutes,
          },
        ),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} heap settled', { server }),
          detail: t('The heap came back down; garbage collection is keeping up again.'),
        },
      })

      this.evaluate(quiet, at, {
        key: `stuck:${server}`,
        observable: running,
        active: running && entry.sk >= Number(rule('stuckThreads') || 1),
        severity: 'error',
        title:
          entry.sk === 1
            ? t('{server} has 1 stuck thread', { server })
            : t('{server} has {count} stuck threads', { server, count: entry.sk }),
        detail: t('Requests are blocked on something outside the server — a database, a remote call or a lock.'),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} has no stuck threads', { server }),
          detail: t('Whatever the threads were waiting on has cleared.'),
        },
      })

      this.evaluate(quiet, at, {
        key: `queue:${server}`,
        observable: running,
        kind: 'queue',
        active: running && entry.q >= Number(rule('queueLength') || 0) && Number(rule('queueLength')) > 0,
        severity: 'warn',
        title: t('{server} has {count} requests queued', { server, count: entry.q }),
        detail: t('More work is arriving than the thread pool is finishing. Look for a slow downstream system first.'),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} queue has drained', { server }),
          detail: t('Requests are no longer waiting for a thread.'),
        },
      })

      // Where "look for a slow downstream system" usually ends: threads are
      // not blocked in the server at all, they are queuing for a database
      // connection. This is the rule the thread-pool numbers alone cannot make.
      const waiting = Number(entry.dsw || 0)
      const waitLimit = Number(rule('jdbcWaiting') || 0)
      this.evaluate(quiet, at, {
        key: `jdbc:${server}`,
        observable: running,
        kind: 'jdbc',
        active: running && waitLimit > 0 && waiting >= waitLimit,
        severity: 'warn',
        title: t('{server} is waiting for JDBC connections', { server }),
        detail: t(
          '{count} request(s) are queued for a connection from a data source pool. Either the pool is too small or the database is answering slowly.',
          { count: waiting },
        ),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} is no longer waiting for JDBC connections', { server }),
          detail: t('Connections are available again.'),
        },
      })

      const pending = Number(entry.jmp || 0)
      const pendingLimit = Number(rule('jmsPending') || 0)
      this.evaluate(quiet, at, {
        key: `jms:${server}`,
        observable: running,
        kind: 'jms',
        active: running && pendingLimit > 0 && pending >= pendingLimit,
        severity: 'warn',
        title: t('{server} has {count} JMS messages pending', { server, count: pending }),
        detail: t('Messages are sitting unacknowledged. A consumer has probably stopped or slowed down.'),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} JMS messages are clearing', { server }),
          detail: t('Pending messages are back under the threshold.'),
        },
      })

      this.evaluate(quiet, at, {
        key: `health:${server}`,
        observable: running,
        kind: 'health',
        active: rule('unhealthy') && running && entry.he && entry.he !== 'OK' && entry.he !== 'UNKNOWN',
        severity: 'warn',
        title: t('{server} reports {health}', { server, health: entry.he }),
        detail: t('The server is running but does not consider itself healthy. Its log usually says which subsystem.'),
        server,
        recovery: {
          severity: 'info',
          title: t('{server} reports OK again', { server }),
          detail: t('Health is back to normal.'),
        },
      })
    },

    /**
     * Raises on the rising edge, and optionally says so again when it clears.
     *
     * A rule about a level (`kind` in SUSTAINED) must be true continuously for
     * `sustainMs` before it is announced — the timestamps come from the samples
     * themselves, so a batch of history replayed at once is judged on when the
     * readings were taken rather than on when they were read.
     *
     * `silent` records the condition without announcing it, which is how the
     * first batch of samples becomes a baseline instead of a burst of alerts,
     * and how a snoozed server stays quiet without losing its edges.
     *
     * `observable` is the difference between "no longer true" and "no longer
     * knowable". Every rule below the server state reads a runtime that a
     * stopped server does not have, so its condition goes false the moment the
     * server does — and announcing a recovery for it would put "heap is back
     * under 90%, garbage collection recovered the memory" in the log directly
     * underneath "ms1 is failed". The condition is dropped either way, so the
     * server coming back still raises fresh alerts; only the false good news
     * is suppressed.
     */
    evaluate(silent, at, { key, kind, active, recovery, observable = true, ...alert }) {
      const state = conditions.get(key) || { since: 0, fired: false }

      if (active) {
        if (!state.since) state.since = at
        const sustain = SUSTAINED.has(kind) ? Number(this.rules.sustainMs || 0) : 0
        if (!state.fired && at - state.since >= sustain) {
          state.fired = true
          if (!silent) this.raise({ key, ...alert })
        }
      } else if (state.since) {
        const wasFired = state.fired
        state.since = 0
        state.fired = false
        if (wasFired && recovery && !silent && observable) {
          this.raise({ key: `${key}:clear`, server: alert.server, ...recovery })
        }
      }

      conditions.set(key, state)
    },

    markAllRead() {
      for (const alert of this.alerts) alert.read = true
      this.unread = 0
      setTitleBadge(0)
      this.persist()
    },

    clear() {
      this.alerts = []
      this.unread = 0
      setTitleBadge(0)
      this.persist()
    },

    /** Switching domains: the old domain's alerts are not this domain's news. */
    reset() {
      conditions.clear()
      heapTail.clear()
      lastActivation.clear()
      // Another domain's servers, and its clusters. The list of clusters left
      // out is a preference and survives, the way the per-server thresholds do.
      this.membership = {}
      this.topologyRead = false
      this.primed = false
      this.clear()
    },
  },
})
