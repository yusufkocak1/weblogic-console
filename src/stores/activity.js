import { defineStore } from 'pinia'
import * as wls from '@/api/weblogic'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { t } from '@/i18n'

/**
 * What this console has changed, and how to put it back.
 *
 * The browser already knows which pages you have opened; that is not worth
 * recording. What is worth recording is what you *did* — which attribute on
 * which MBean went from which value to which other value, which server was
 * shut down, which application was stopped — because that is the question
 * asked five minutes later, usually as "what did I just change?".
 *
 * Every entry therefore carries the change itself, value by value, and where
 * the operation has an inverse it carries that too: writing the old attribute
 * values back, starting the server that was stopped, starting the application
 * that was stopped. Roll back replays that inverse through the same REST calls
 * the console would have made by hand.
 *
 * The log is deliberately short-lived. It is an undo window, not an audit
 * trail — WebLogic keeps the audit trail — so entries expire after fifteen
 * minutes by default, taking their rollback with them. The window is settable
 * for anyone who wants longer or shorter.
 */

const ENTRIES_KEY = 'wl-console.activity'
const RETENTION_KEY = 'wl-console.activity.retention'

/** Fifteen minutes: long enough to notice a mistake, short enough to forget. */
export const DEFAULT_RETENTION_MS = 15 * 60 * 1000

/** Labels are thunks so they follow a language change — see REFRESH_OPTIONS. */
export const RETENTION_OPTIONS = [
  { label: () => t('5 minutes'), value: 5 * 60 * 1000 },
  { label: () => t('15 minutes'), value: DEFAULT_RETENTION_MS },
  { label: () => t('30 minutes'), value: 30 * 60 * 1000 },
  { label: () => t('1 hour'), value: 60 * 60 * 1000 },
  { label: () => t('4 hours'), value: 4 * 60 * 60 * 1000 },
  { label: () => t('12 hours'), value: 12 * 60 * 60 * 1000 },
]

const MIN_RETENTION_MS = 60 * 1000
const MAX_RETENTION_MS = 24 * 60 * 60 * 1000

/** A cap on top of the time window, so a scripted afternoon cannot fill storage. */
const MAX_ENTRIES = 200

/** How often expired entries are swept out while the console is open. */
const PRUNE_MS = 15000

let timer = null

function readRetention() {
  try {
    const raw = Number(localStorage.getItem(RETENTION_KEY))
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_RETENTION_MS
    return Math.min(MAX_RETENTION_MS, Math.max(MIN_RETENTION_MS, raw))
  } catch {
    return DEFAULT_RETENTION_MS
  }
}

function readEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry.at === 'number') : []
  } catch {
    return []
  }
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/** The same change read backwards, for the entry a rollback leaves behind. */
const invert = (changes) => (changes || []).map((change) => ({ ...change, from: change.to, to: change.from }))

export const useActivityStore = defineStore('activity', {
  state: () => ({
    /** Newest first — the order the panel reads in. */
    entries: readEntries(),
    retentionMs: readRetention(),
    /** Id of the entry currently being rolled back, so its button can wait. */
    undoing: null,
  }),

  getters: {
    /**
     * Entries belonging to the domain on screen. A rollback is a write to one
     * specific AdminServer, so listing another domain's changes here would
     * invite replaying them against the wrong one.
     */
    visible: (state) => {
      const activeId = useConnectionStore().activeId
      return state.entries.filter((entry) => !entry.connectionId || entry.connectionId === activeId)
    },

    count() {
      return this.visible.length
    },

    /** Whether the panel can offer a Roll back button for this entry. */
    revertible: () => (entry) => Boolean(entry?.undo) && entry.status === 'done',

    retentionLabel: (state) =>
      RETENTION_OPTIONS.find((option) => option.value === state.retentionMs)?.label() ||
      t('{count} minutes', { count: Math.round(state.retentionMs / 60000) }),
  },

  actions: {
    persist() {
      try {
        localStorage.setItem(ENTRIES_KEY, JSON.stringify(this.entries))
      } catch {
        /* storage disabled or full — the log is then only as long as this page */
      }
    },

    /**
     * Adds one operation to the log.
     *
     * @param {{
     *   kind: 'config'|'lifecycle'|'deployment'|'lock',
     *   title: string,
     *   summary?: string,
     *   changes?: {label: string, attr?: string, path?: string, from: any, to: any, note?: string}[],
     *   status?: 'done'|'failed',
     *   undo?: object|null,
     *   undoNote?: string,
     * }} entry
     */
    record(entry) {
      const connection = useConnectionStore()
      const item = {
        id: newId(),
        at: Date.now(),
        status: 'done',
        changes: [],
        undo: null,
        undoNote: '',
        connectionId: connection.activeId,
        connectionLabel: connection.activeLabel,
        user: connection.username,
        ...entry,
      }
      this.entries.unshift(item)
      if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
      this.prune()
      this.persist()
      return item.id
    },

    /**
     * Drops everything past the retention window. Runs on a timer, so it only
     * touches storage when it actually dropped something.
     */
    prune() {
      const cutoff = Date.now() - this.retentionMs
      const kept = this.entries.filter((entry) => entry.at >= cutoff)
      if (kept.length === this.entries.length) return
      this.entries = kept
      this.persist()
    },

    setRetention(ms) {
      const value = Number(ms)
      if (!Number.isFinite(value) || value <= 0) return
      this.retentionMs = Math.min(MAX_RETENTION_MS, Math.max(MIN_RETENTION_MS, value))
      try {
        localStorage.setItem(RETENTION_KEY, String(this.retentionMs))
      } catch {
        /* storage disabled — the window resets to the default next visit */
      }
      // Shortening the window takes effect at once, including on entries
      // already on screen: that is the point of shortening it.
      this.prune()
    },

    clear() {
      this.entries = []
      this.persist()
    },

    /** Sweeps expired entries out while the console is open. */
    start() {
      this.stop()
      this.prune()
      timer = setInterval(() => this.prune(), PRUNE_MS)
    },

    stop() {
      clearInterval(timer)
      timer = null
    },

    /**
     * Replays the inverse of one operation.
     *
     * Configuration rollbacks go through the ordinary staged protocol — take
     * the lock, write the old values, activate if the original was activated —
     * so they are as visible to everyone else as the change itself was.
     * Lifecycle and deployment rollbacks are simply the opposite request.
     *
     * Errors are thrown rather than swallowed: the caller is a button, and a
     * rollback that failed has to say so.
     */
    async rollback(id) {
      const entry = this.entries.find((item) => item.id === id)
      if (!entry?.undo || entry.status !== 'done' || this.undoing) return

      const connection = useConnectionStore()
      if (entry.connectionId && entry.connectionId !== connection.activeId) {
        throw new Error(
          t('This change was made on {domain}. Switch to it first.', {
            domain: entry.connectionLabel || t('another domain'),
          }),
        )
      }

      this.undoing = id
      try {
        const undo = entry.undo
        if (undo.type === 'config') {
          const changes = useChangesStore()
          await changes.save(undo.edits)
          if (undo.activate) await changes.activate()
        } else if (undo.type === 'lifecycle') {
          // One at a time, for the same reason the forward operation is: a
          // Node Manager asked to start six servers at once is how a machine
          // falls over.
          for (const server of undo.servers || [undo.server]) {
            await wls.serverAction(server, undo.action)
          }
        } else if (undo.type === 'deployment') {
          await wls.deploymentAction(undo.app, undo.action, undo.targets || [])
        } else {
          throw new Error(t('This operation has no rollback.'))
        }

        entry.status = 'rolled-back'
        entry.rolledBackAt = Date.now()
        this.record({
          kind: entry.kind,
          title: t('Rolled back — {title}', { title: entry.title }),
          summary: undo.summary || t('The previous values were written back.'),
          changes: invert(entry.changes),
          undoNote: t('A rollback is not itself rolled back. Make the change again if it was wanted after all.'),
        })
      } finally {
        this.undoing = null
        this.persist()
      }
    },
  },
})
