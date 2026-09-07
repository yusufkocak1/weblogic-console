import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { REFRESH_OPTIONS, useUiStore } from '@/stores/ui'

let store

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  setActivePinia(createPinia())
  store = useUiStore()
})

afterEach(() => vi.useRealTimers())

describe('the refresh interval', () => {
  it('opens at fifteen seconds, not at Off', () => {
    // "Off" is worth 0, and an unset key reads as 0 unless that is checked
    // for — which would leave a first-time console never refreshing itself.
    expect(store.refreshMs).toBe(15000)
  })

  it('remembers a choice', () => {
    store.setRefresh(30000)
    setActivePinia(createPinia())
    expect(useUiStore().refreshMs).toBe(30000)
  })

  it('remembers Off, which is a choice like any other', () => {
    store.setRefresh(0)
    setActivePinia(createPinia())
    expect(useUiStore().refreshMs).toBe(0)
  })

  it('ignores a saved value that is not on offer', () => {
    localStorage.setItem('wl-console.refresh', '1234')
    setActivePinia(createPinia())
    expect(useUiStore().refreshMs).toBe(15000)
  })

  it('offers Off as well as four intervals', () => {
    expect(REFRESH_OPTIONS.map((option) => option.value)).toEqual([0, 5000, 15000, 30000, 60000])
    expect(REFRESH_OPTIONS.every((option) => typeof option.label() === 'string')).toBe(true)
  })
})

describe('the theme', () => {
  it('opens dark', () => {
    expect(store.theme).toBe('dark')
  })

  it('is written to the document when applied', () => {
    store.applyTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles between the two and remembers which', () => {
    store.toggleTheme()
    expect(store.theme).toBe('light')
    setActivePinia(createPinia())
    expect(useUiStore().theme).toBe('light')
  })
})

describe('the hints', () => {
  it('are on by default, because the console is easier to learn with them', () => {
    expect(store.helpVisible).toBe(true)
  })

  it('stay off once turned off', () => {
    store.toggleHelp()
    expect(store.helpVisible).toBe(false)
    setActivePinia(createPinia())
    expect(useUiStore().helpVisible).toBe(false)
  })
})

describe('toasts', () => {
  it('gives each one an id of its own', () => {
    const a = store.info('one')
    const b = store.info('two')
    expect(a).not.toBe(b)
    expect(store.toasts).toHaveLength(2)
  })

  it('dismisses an informational toast on its own', () => {
    vi.useFakeTimers()
    store.info('gone in a moment')
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toEqual([])
  })

  it('leaves a failure until it is dismissed, since it is worth reading', () => {
    vi.useFakeTimers()
    store.error('it broke', 'stack trace')
    vi.advanceTimersByTime(600_000)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]).toMatchObject({ tone: 'error', timeout: 0 })
  })

  it('dismisses only the one asked for', () => {
    const first = store.success('saved')
    store.success('also saved')
    store.dismiss(first)
    expect(store.toasts.map((toast) => toast.title)).toEqual(['also saved'])
  })

  it('tones each kind for what it means', () => {
    store.success('a')
    store.info('b')
    store.error('c')
    expect(store.toasts.map((toast) => toast.tone)).toEqual(['success', 'info', 'error'])
  })
})
