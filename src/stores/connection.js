import { defineStore } from 'pinia'
import * as api from '@/api/client'

const RECENT_KEY = 'wl-console.recent'
const MAX_RECENT = 6

/**
 * Connection targets the user has used before — host, port and username only.
 * Passwords are never written anywhere: they live in the backend process for the
 * lifetime of the session and nowhere else.
 */
function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(raw) ? raw.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function writeRecent(entries) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
  } catch {
    /* storage disabled — recent list just won't persist */
  }
}

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    connected: false,
    host: '',
    port: null,
    ssl: false,
    insecure: false,
    username: '',
    baseUrl: '',
    domain: null,
    connectedAt: null,
    busy: false,
    ready: false,
    recent: readRecent(),
  }),

  getters: {
    domainName: (state) => state.domain?.name || 'WebLogic Domain',
    productionMode: (state) => Boolean(state.domain?.productionModeEnabled),
    target: (state) => (state.connected ? `${state.host}:${state.port}` : ''),
  },

  actions: {
    /** Asks the backend whether this browser already has a live session. */
    async init() {
      try {
        const info = await api.session()
        if (info?.connected) this.$patch({ ...info, connected: true })
        else this.reset()
      } catch {
        // Backend unreachable at boot: fall through to the login screen, which
        // will surface the real error when the user tries to connect.
        this.reset()
      } finally {
        this.ready = true
      }
    },

    async connect(form) {
      this.busy = true
      try {
        const info = await api.connect({
          host: form.host.trim(),
          port: Number(form.port),
          ssl: Boolean(form.ssl),
          insecure: Boolean(form.insecure),
          username: form.username,
          password: form.password,
        })
        this.$patch({ ...info, connected: true })
        this.rememberTarget(info)
        return info
      } finally {
        this.busy = false
      }
    },

    rememberTarget({ host, port, ssl, insecure, username }) {
      const entry = { host, port, ssl, insecure, username }
      const key = (e) => `${e.host}:${e.port}:${e.username}`
      this.recent = [entry, ...this.recent.filter((e) => key(e) !== key(entry))].slice(0, MAX_RECENT)
      writeRecent(this.recent)
    },

    forgetTarget(entry) {
      const key = (e) => `${e.host}:${e.port}:${e.username}`
      this.recent = this.recent.filter((e) => key(e) !== key(entry))
      writeRecent(this.recent)
    },

    async disconnect() {
      try {
        await api.disconnect()
      } catch {
        // Even if the call fails the local state must clear, or the UI keeps
        // showing a connection the user asked to end.
      }
      this.reset()
    },

    reset() {
      this.$patch({
        connected: false,
        host: '',
        port: null,
        ssl: false,
        insecure: false,
        username: '',
        baseUrl: '',
        domain: null,
        connectedAt: null,
      })
    },
  },
})
