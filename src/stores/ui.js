import { defineStore } from 'pinia'

const THEME_KEY = 'wl-console.theme'
const REFRESH_KEY = 'wl-console.refresh'
const HELP_KEY = 'wl-console.help'

export const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
]

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

/** Hints are on by default: the console is easier to learn with them. */
function readHelp() {
  try {
    return localStorage.getItem(HELP_KEY) !== '0'
  } catch {
    return true
  }
}

function readRefresh() {
  try {
    const raw = Number(localStorage.getItem(REFRESH_KEY))
    return REFRESH_OPTIONS.some((o) => o.value === raw) ? raw : 15000
  } catch {
    return 15000
  }
}

let toastSeq = 0

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: readTheme(),
    refreshMs: readRefresh(),
    helpVisible: readHelp(),
    sidebarOpen: false,
    toasts: [],
  }),

  actions: {
    applyTheme() {
      document.documentElement.classList.toggle('dark', this.theme === 'dark')
    },

    setTheme(theme) {
      this.theme = theme
      try {
        localStorage.setItem(THEME_KEY, theme)
      } catch {
        /* storage disabled — theme resets next visit */
      }
      this.applyTheme()
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    setRefresh(ms) {
      this.refreshMs = ms
      try {
        localStorage.setItem(REFRESH_KEY, String(ms))
      } catch {
        /* storage disabled */
      }
    },

    setHelp(visible) {
      this.helpVisible = visible
      try {
        localStorage.setItem(HELP_KEY, visible ? '1' : '0')
      } catch {
        /* storage disabled — hints come back next visit */
      }
    },

    toggleHelp() {
      this.setHelp(!this.helpVisible)
    },

    notify(toast) {
      const id = ++toastSeq
      const entry = { id, tone: 'info', timeout: 5000, ...toast }
      this.toasts.push(entry)
      if (entry.timeout) setTimeout(() => this.dismiss(id), entry.timeout)
      return id
    },

    success(title, detail) {
      return this.notify({ tone: 'success', title, detail })
    },

    error(title, detail) {
      // Failures stay until dismissed; they usually carry a stack trace worth reading.
      return this.notify({ tone: 'error', title, detail, timeout: 0 })
    },

    info(title, detail) {
      return this.notify({ tone: 'info', title, detail })
    },

    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
