import { defineStore } from 'pinia'
import * as api from '@/api/client'
import { useAlertsStore } from '@/stores/alerts'
import { t } from '@/i18n'

/**
 * The recent past of every server in the active domain.
 *
 * The numbers on the monitoring pages have always been polled; what was missing
 * was memory. A single reading of "heap at 78%" says nothing — whether it has
 * been climbing for an hour is the whole question. The backend samples each
 * live connection on a timer and keeps a couple of hours of it, and this store
 * is the browser's copy: one poll feeds every sparkline on screen, and the
 * alert watcher reads the same samples.
 *
 * Only what is new is fetched: each poll asks for samples after the newest one
 * already held.
 */

/** How many samples the browser keeps, whatever the backend's retention is. */
const MAX_CLIENT_SAMPLES = 720

// Timer and listener live outside the store: there is one poller, and neither
// belongs in reactive state.
let timer = null
let onVisible = null

export const useHistoryStore = defineStore('history', {
  state: () => ({
    samples: [],
    intervalMs: 15000,
    /** False when the backend was started with WLC_SAMPLE_MS=0. */
    sampling: true,
    error: null,
    connectionId: null,
    polling: false,
  }),

  getters: {
    latest: (state) => state.samples[state.samples.length - 1] || null,

    /** Every server name seen in the buffer, not only the ones running now. */
    serverNames: (state) => {
      const names = new Set()
      for (const sample of state.samples) for (const name of Object.keys(sample.servers)) names.add(name)
      return [...names].sort()
    },

    /**
     * One metric of one server as a plain array, ready for a sparkline.
     * Missing points are dropped rather than zero-filled: a server that was
     * down has no reading, and drawing that as zero would be a lie.
     */
    series: (state) => (server, key) =>
      state.samples.map((sample) => sample.servers[server]?.[key]).filter((value) => typeof value === 'number'),

    /** Heap used as a percentage of maximum, the series worth watching most. */
    heapPercentSeries() {
      return (server) =>
        this.samples
          .map((sample) => {
            const entry = sample.servers[server]
            if (!entry || !entry.hm) return null
            return (entry.hu / entry.hm) * 100
          })
          .filter((value) => value !== null)
    },

    span: (state) => {
      if (state.samples.length < 2) return 0
      return state.samples[state.samples.length - 1].t - state.samples[0].t
    },
  },

  actions: {
    reset() {
      this.samples = []
      this.error = null
    },

    async refresh() {
      const since = this.latest?.t || 0
      try {
        const payload = await api.history(since)
        this.sampling = payload?.sampling !== false
        this.intervalMs = Number(payload?.intervalMs) || this.intervalMs
        this.error = payload?.error || null
        const incoming = Array.isArray(payload?.samples) ? payload.samples : []
        if (incoming.length) {
          this.samples = [...this.samples, ...incoming].slice(-MAX_CLIENT_SAMPLES)
          useAlertsStore().ingest(incoming)
        }
      } catch (err) {
        // A dead session is handled by whichever page is open; here it only
        // means there is nothing to draw.
        this.error = err?.fullText || err?.message || t('History is unavailable.')
      }
    },

    /**
     * Polls for as long as the console is open, pausing with the tab so a
     * console left overnight stops asking. The backend stops sampling on its
     * own once nothing has asked for a while.
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
  },
})
