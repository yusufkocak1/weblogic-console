import { defineStore } from 'pinia'
import * as config from '@/api/config'
import { items } from '@/utils/format'
import { t } from '@/i18n'

/**
 * The domain's pending configuration changes.
 *
 * WebLogic edits are staged, not immediate: one person holds a domain-wide
 * lock, writes attribute values into a pending set, and activates them when the
 * set is complete. Nothing is live before that. This store keeps that state in
 * one place so the Configuration page can say, at any moment, whether what is
 * on screen is live or still waiting — and who else is holding the lock.
 */

/** JMX object names read badly; the MBean's own name is the useful part. */
function shortMBeanName(value) {
  const text = String(value ?? '')
  const named = text.match(/Name=([^,]+)/)
  if (named) return named[1]
  const identity = text.split('/').filter(Boolean)
  return identity.length ? identity[identity.length - 1] : text
}

/**
 * A pending change as WebLogic reports it, reduced to one readable line. The
 * shape differs between releases, so anything unrecognised falls back to its
 * JSON rather than disappearing.
 */
function describeChange(change) {
  if (typeof change === 'string') return { text: change, detail: '' }
  const property = change.property || change.attribute || change.propertyName || ''
  const mbean = shortMBeanName(change.mbean ?? change.mBean ?? change.bean ?? change.identity ?? '')
  const operation = change.operation || 'modify'
  const from = change.oldValue ?? change.old ?? null
  const to = change.newValue ?? change.new ?? null

  if (!property && !mbean) return { text: JSON.stringify(change), detail: '' }

  const text = mbean && property ? `${property} on ${mbean}` : property || mbean
  const detail =
    from === null && to === null
      ? operation
      : `${operation}: ${from === null || from === '' ? t('(empty)') : from} → ${to === null || to === '' ? t('(empty)') : to}`
  return { text, detail }
}

export const useChangesStore = defineStore('changes', {
  state: () => ({
    /** True while somebody — possibly another operator — holds the lock. */
    locked: false,
    lockOwner: '',
    hasChanges: false,
    mergeNeeded: false,
    /** Readable pending changes. Empty when the release does not expose them. */
    pending: [],
    pendingKnown: false,
    loaded: false,
    /** '' | 'saving' | 'activating' | 'discarding' — drives the buttons. */
    busy: '',
  }),

  getters: {
    /** Somebody is mid-edit: either holding the lock or leaving changes behind. */
    editSessionOpen: (state) => state.locked || state.hasChanges,
  },

  actions: {
    reset() {
      this.$patch({
        locked: false,
        lockOwner: '',
        hasChanges: false,
        mergeNeeded: false,
        pending: [],
        pendingKnown: false,
        loaded: false,
        busy: '',
      })
    },

    async refresh(options) {
      const status = await config.changeManager(options)
      this.locked = Boolean(status?.locked)
      this.lockOwner = status?.lockOwner || ''
      this.hasChanges = Boolean(status?.hasChanges)
      this.mergeNeeded = Boolean(status?.mergeNeeded)
      this.loaded = true

      if (!this.hasChanges) {
        this.pending = []
        this.pendingKnown = true
        return
      }
      const changes = await config.pendingChanges(options)
      this.pendingKnown = changes !== null
      this.pending = changes === null ? [] : items(changes).map(describeChange)
    },

    /**
     * Writes edits into the pending set, taking the lock first if this session
     * does not already hold one. Each edit is `{ path, attributes }`.
     */
    async save(edits) {
      this.busy = 'saving'
      try {
        await this.refresh()
        if (!this.locked) await config.startEdit()
        for (const { path, attributes } of edits) {
          await config.updateMBean(path, attributes)
        }
      } finally {
        this.busy = ''
        // Even a partial failure leaves earlier writes pending, so the bar has
        // to be re-read either way.
        await this.refresh().catch(() => {})
      }
    },

    /** Makes every pending change live, including anyone else's. */
    async activate() {
      this.busy = 'activating'
      try {
        await config.activateChanges()
      } finally {
        this.busy = ''
        await this.refresh().catch(() => {})
      }
    },

    /** Throws the pending set away and releases the lock. */
    async discard() {
      this.busy = 'discarding'
      try {
        if (this.hasChanges) await config.undoChanges()
        // Releasing the lock is best effort: it is already gone if the session
        // timed out, and that is not something to report as a failure.
        await config.cancelEdit().catch(() => {})
      } finally {
        this.busy = ''
        await this.refresh().catch(() => {})
      }
    },
  },
})
