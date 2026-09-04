import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useConnectionStore } from '@/stores/connection'

/**
 * Loads a resource once and, when `poll` is set, keeps it fresh on the interval
 * chosen in the top bar. Polling pauses while the tab is hidden so a console
 * left open overnight does not hammer the AdminServer.
 *
 * @param {(ctx: {signal: AbortSignal}) => Promise<any>} loader
 */
export function useResource(loader, { immediate = true, poll = true, onError } = {}) {
  const ui = useUiStore()
  const connection = useConnectionStore()
  const router = useRouter()

  const data = shallowRef(null)
  const error = shallowRef(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const lastUpdated = ref(null)

  let controller = null
  let timer = null
  let disposed = false

  async function run({ silent = false } = {}) {
    if (disposed) return
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal

    if (silent && data.value !== null) refreshing.value = true
    else loading.value = true

    try {
      const result = await loader({ signal })
      if (signal.aborted || disposed) return
      data.value = result
      error.value = null
      lastUpdated.value = Date.now()
    } catch (err) {
      if (signal.aborted || disposed || err?.name === 'AbortError') return
      error.value = err
      if (err?.isAuthError) {
        // The backend session expired or the process restarted. Start over.
        stop()
        connection.reset()
        ui.error('Session ended', 'Connect to the AdminServer again.')
        router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
        return
      }
      onError?.(err)
    } finally {
      if (!disposed) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  function schedule() {
    clearTimeout(timer)
    if (!poll || !ui.refreshMs || disposed) return
    timer = setTimeout(async () => {
      if (document.visibilityState === 'visible') await run({ silent: true })
      schedule()
    }, ui.refreshMs)
  }

  function stop() {
    clearTimeout(timer)
    timer = null
  }

  async function reload() {
    await run({ silent: true })
    schedule()
  }

  watch(() => ui.refreshMs, schedule)

  const onVisible = () => {
    if (document.visibilityState === 'visible' && poll && ui.refreshMs) reload()
  }
  document.addEventListener('visibilitychange', onVisible)

  onScopeDispose(() => {
    disposed = true
    stop()
    controller?.abort()
    document.removeEventListener('visibilitychange', onVisible)
  })

  if (immediate) run().then(schedule)

  return { data, error, loading, refreshing, lastUpdated, reload, run, stop }
}
