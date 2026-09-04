import { ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useUiStore } from '@/stores/ui'

/**
 * Server lifecycle operations, shared by the Servers list and a single
 * server's own page — a setting that needs a restart is useless if the restart
 * lives on another screen.
 */

/** Which lifecycle operations make sense for a given state. */
export function actionsFor(state) {
  switch (state) {
    case 'RUNNING':
      return [
        { action: 'suspend', label: 'Suspend' },
        { action: 'shutdown', label: 'Shutdown', danger: true },
      ]
    case 'ADMIN':
    case 'STANDBY':
      return [
        { action: 'resume', label: 'Resume' },
        { action: 'shutdown', label: 'Shutdown', danger: true },
      ]
    case 'SHUTDOWN':
    case 'FAILED_NOT_RESTARTABLE':
      return [{ action: 'start', label: 'Start' }]
    case 'FAILED':
      return [
        { action: 'start', label: 'Start' },
        { action: 'forceShutdown', label: 'Force shutdown', danger: true },
      ]
    default:
      return [{ action: 'forceShutdown', label: 'Force shutdown', danger: true }]
  }
}

export const ACTION_DESCRIPTIONS = {
  start: 'Node Manager must be running on the target machine for a server to start.',
  shutdown: 'The server stops accepting new work and shuts down gracefully.',
  forceShutdown: 'The server is killed immediately. In-flight work is lost.',
  suspend: 'The server moves to ADMIN state and stops serving application traffic.',
  resume: 'The server returns to RUNNING and resumes serving traffic.',
}

/**
 * @param {{confirm: import('vue').Ref, onChanged: () => void}} options
 *   `confirm` is a ref to a ConfirmDialog; `onChanged` reloads the caller's
 *   data once the transition has had a moment to show up in the runtime tree.
 */
export function useServerActions({ confirm, onChanged }) {
  const ui = useUiStore()
  const busy = ref(null)

  async function run(server, { action, label, danger }) {
    const ok = await confirm.value.ask({
      title: `${label} ${server}?`,
      body: ACTION_DESCRIPTIONS[action] || '',
      confirmLabel: label,
      danger: Boolean(danger),
    })
    if (!ok) return

    busy.value = server
    try {
      await wls.serverAction(server, action)
      ui.success(`${label} requested`, `${server} is transitioning — the state updates as it changes.`)
      setTimeout(() => onChanged?.(), 1500)
    } catch (err) {
      ui.error(`${label} failed on ${server}`, err.fullText || err.message)
    } finally {
      busy.value = null
    }
  }

  return { busy, run }
}
