import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { setTitleBadge } from '@/utils/title'

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
 */

const RULES_KEY = 'wl-console.alerts.rules'
const DESKTOP_KEY = 'wl-console.alerts.desktop'
const MAX_ALERTS = 200

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
}

function readRules() {
  try {
    const raw = JSON.parse(localStorage.getItem(RULES_KEY) || '{}')
    return { ...DEFAULT_RULES, ...raw }
  } catch {
    return { ...DEFAULT_RULES }
  }
}

function readDesktop() {
  try {
    return localStorage.getItem(DESKTOP_KEY) === '1'
  } catch {
    return false
  }
}

let sequence = 0

/**
 * Which conditions are currently holding, keyed by rule and server. This is
 * what makes the rules edge-triggered rather than a stream of repeats.
 */
const firing = new Map()

export const useAlertsStore = defineStore('alerts', {
  state: () => ({
    alerts: [],
    unread: 0,
    rules: readRules(),
    /** Browser notifications, off until the user turns them on and grants it. */
    desktop: readDesktop(),
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
  },

  actions: {
    setRule(key, value) {
      this.rules = { ...this.rules, [key]: value }
      try {
        localStorage.setItem(RULES_KEY, JSON.stringify(this.rules))
      } catch {
        /* storage disabled — the rules go back to defaults next visit */
      }
    },

    resetRules() {
      this.rules = { ...DEFAULT_RULES }
      try {
        localStorage.removeItem(RULES_KEY)
      } catch {
        /* nothing to clean up */
      }
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
          'Desktop notifications are blocked',
          'The browser refused permission for this site, so alerts will only appear in the console.',
        )
      }
      return this.desktop
    },

    raise({ key, severity = 'warn', title, detail = '', server = '' }) {
      const alert = {
        id: ++sequence,
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
      return alert
    },

    /**
     * Runs the rules over new samples.
     *
     * @param {{t: number, servers: Record<string, object>}[]} samples
     */
    ingest(samples) {
      // The first batch also carries whatever history the backend had already
      // collected, so it only sets the baseline. Everything after it is a
      // change that happened while you were watching.
      const silent = !this.primed
      for (const sample of samples) {
        for (const [server, entry] of Object.entries(sample.servers || {})) {
          this.check(server, entry, silent)
        }
      }
      if (samples.length) this.primed = true
    },

    /** One server, one sample. Kept separate so it can be reasoned about alone. */
    check(server, entry, silent = false) {
      const running = entry.st === 'RUNNING'

      this.evaluate(silent, {
        key: `down:${server}`,
        active: this.rules.serverDown && !running && entry.st !== 'UNKNOWN',
        severity: 'error',
        title: `${server} is ${String(entry.st || 'not running').toLowerCase()}`,
        detail: 'The server left the RUNNING state. Check the Servers page and its log.',
        server,
        recovery: {
          severity: 'info',
          title: `${server} is running again`,
          detail: 'The server is back in the RUNNING state.',
        },
      })

      const heapPercent = entry.hm ? (entry.hu / entry.hm) * 100 : null
      this.evaluate(silent, {
        key: `heap:${server}`,
        active: running && heapPercent !== null && heapPercent >= Number(this.rules.heapPercent || 0),
        severity: 'warn',
        title: `${server} heap at ${Math.round(heapPercent || 0)}%`,
        detail: `Heap in use has passed ${this.rules.heapPercent}% of the JVM maximum. Sustained, this shows up as slowness long before an OutOfMemoryError.`,
        server,
        recovery: {
          severity: 'info',
          title: `${server} heap is back under ${this.rules.heapPercent}%`,
          detail: 'Garbage collection recovered the memory.',
        },
      })

      this.evaluate(silent, {
        key: `stuck:${server}`,
        active: running && entry.sk >= Number(this.rules.stuckThreads || 1),
        severity: 'error',
        title: `${server} has ${entry.sk} stuck thread${entry.sk === 1 ? '' : 's'}`,
        detail: 'Requests are blocked on something outside the server — a database, a remote call or a lock.',
        server,
        recovery: {
          severity: 'info',
          title: `${server} has no stuck threads`,
          detail: 'Whatever the threads were waiting on has cleared.',
        },
      })

      this.evaluate(silent, {
        key: `queue:${server}`,
        active: running && entry.q >= Number(this.rules.queueLength || 0) && Number(this.rules.queueLength) > 0,
        severity: 'warn',
        title: `${server} has ${entry.q} requests queued`,
        detail: 'More work is arriving than the thread pool is finishing. Look for a slow downstream system first.',
        server,
      })

      this.evaluate(silent, {
        key: `health:${server}`,
        active: this.rules.unhealthy && running && entry.he && entry.he !== 'OK' && entry.he !== 'UNKNOWN',
        severity: 'warn',
        title: `${server} reports ${entry.he}`,
        detail: 'The server is running but does not consider itself healthy. Its log usually says which subsystem.',
        server,
        recovery: { severity: 'info', title: `${server} reports OK again`, detail: 'Health is back to normal.' },
      })
    },

    /**
     * Raises on the rising edge, and optionally says so again when it clears.
     * `silent` records the condition without announcing it, which is how the
     * first batch of samples becomes a baseline instead of a burst of alerts.
     */
    evaluate(silent, { key, active, recovery, ...alert }) {
      const wasActive = firing.get(key) === true
      if (active && !wasActive) {
        firing.set(key, true)
        if (!silent) this.raise({ key, ...alert })
      } else if (!active && wasActive) {
        firing.set(key, false)
        if (recovery && !silent) this.raise({ key: `${key}:clear`, server: alert.server, ...recovery })
      }
    },

    markAllRead() {
      for (const alert of this.alerts) alert.read = true
      this.unread = 0
      setTitleBadge(0)
    },

    clear() {
      this.alerts = []
      this.unread = 0
      setTitleBadge(0)
    },

    /** Switching domains: the old domain's alerts are not this domain's news. */
    reset() {
      firing.clear()
      this.primed = false
      this.clear()
    },
  },
})
