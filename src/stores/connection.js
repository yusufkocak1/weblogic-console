import { defineStore } from 'pinia'
import * as api from '@/api/client'
import { t } from '@/i18n'

/**
 * Connection state mirrors the backend, which is the single source of truth.
 *
 * Several domains can be open at once: `connections` holds the live ones (their
 * credentials sit in the backend process), `profiles` holds the saved targets
 * that persist across restarts. A profile without a live connection just needs
 * its password entered again.
 */
export const useConnectionStore = defineStore('connection', {
  state: () => ({
    connections: [],
    profiles: [],
    activeId: null,
    busy: false,
    switching: false,
    ready: false,
  }),

  getters: {
    active: (state) => state.connections.find((c) => c.id === state.activeId) || null,
    connected() {
      return Boolean(this.active)
    },
    domainName() {
      return this.active?.domain?.name || t('WebLogic Domain')
    },
    /** The user-facing label: the profile name, falling back to host:port. */
    activeLabel() {
      const active = this.active
      return active ? active.name || `${active.host}:${active.port}` : ''
    },
    productionMode() {
      return Boolean(this.active?.domain?.productionModeEnabled)
    },
    target() {
      return this.active ? `${this.active.host}:${this.active.port}` : ''
    },
    baseUrl() {
      return this.active?.baseUrl || ''
    },
    username() {
      return this.active?.username || ''
    },
    /** Live connection for a saved profile, if that profile is currently open. */
    connectionForProfile: (state) => (profileId) =>
      state.connections.find((c) => c.profileId === profileId) || null,
    /** Profiles that are saved but not currently connected. */
    offlineProfiles: (state) =>
      state.profiles.filter((p) => !state.connections.some((c) => c.profileId === p.id)),
  },

  actions: {
    apply(payload) {
      this.connections = payload?.connections ?? []
      this.profiles = payload?.profiles ?? []
      this.activeId = payload?.activeId ?? null
      // The API client pins every REST call to this id.
      api.setActiveConnectionId(this.activeId)
    },

    /** Asks the backend which connections this browser already has open. */
    async init() {
      try {
        this.apply(await api.session())
      } catch {
        // Backend unreachable at boot: fall through to the connect screen,
        // which surfaces the real error when the user tries to connect.
        this.apply(null)
      } finally {
        this.ready = true
      }
    },

    async connect(form) {
      this.busy = true
      try {
        this.apply(
          await api.openConnection({
            name: form.name?.trim() || '',
            host: form.host.trim(),
            port: Number(form.port),
            ssl: Boolean(form.ssl),
            insecure: Boolean(form.insecure),
            username: form.username,
            password: form.password,
            save: form.save !== false,
          }),
        )
        return this.active
      } finally {
        this.busy = false
      }
    },

    async activate(id) {
      if (id === this.activeId) return
      this.switching = true
      try {
        this.apply(await api.activateConnection(id))
      } finally {
        this.switching = false
      }
    },

    /** Closes one connection; its credentials are dropped by the backend. */
    async close(id) {
      this.apply(await api.closeConnection(id))
    },

    async disconnectAll() {
      try {
        await api.disconnectAll()
      } catch {
        // Even if the call fails the local state must clear, or the UI keeps
        // showing connections the user asked to end.
      }
      this.apply(null)
    },

    async renameProfile(id, name) {
      this.apply(await api.renameProfile(id, name))
    },

    async deleteProfile(id) {
      this.apply(await api.deleteProfile(id))
    },

    /** Called when the backend reports the session is gone. */
    reset() {
      this.apply(null)
    },
  },
})
