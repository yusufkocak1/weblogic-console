import { ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useUiStore } from '@/stores/ui'
import { useConnectionStore } from '@/stores/connection'
import { curlForServerAction, wlstForServerAction } from '@/utils/wlst'

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

/** Everything a bulk action can be, whatever the states of the selection are. */
export const BULK_ACTIONS = [
  { action: 'start', label: 'Start' },
  { action: 'resume', label: 'Resume' },
  { action: 'suspend', label: 'Suspend' },
  { action: 'shutdown', label: 'Shutdown', danger: true },
  { action: 'forceShutdown', label: 'Force shutdown', danger: true },
]

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
  const connection = useConnectionStore()
  const busy = ref(null)

  const scriptContext = () => ({ username: connection.username, baseUrl: connection.baseUrl })

  async function run(server, { action, label, danger }) {
    const ok = await confirm.value.ask({
      title: `${label} ${server}?`,
      body: ACTION_DESCRIPTIONS[action] || '',
      confirmLabel: label,
      danger: Boolean(danger),
      script: {
        subtitle: `${label} ${server}`,
        wlst: wlstForServerAction(server, action, scriptContext()),
        curl: curlForServerAction(server, action, scriptContext()),
      },
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

  /**
   * The same operation over a selection.
   *
   * Requests go out one at a time rather than all at once: starting six servers
   * simultaneously is exactly how a Node Manager and a machine get overwhelmed,
   * and a failure halfway through has to be reported per server, not as one
   * rejected promise.
   */
  async function runMany(servers, { action, label, danger }) {
    if (!servers.length) return
    const list = servers.join(', ')
    const ok = await confirm.value.ask({
      title: `${label} ${servers.length} server${servers.length === 1 ? '' : 's'}?`,
      body: `${list}. ${ACTION_DESCRIPTIONS[action] || ''} Each one is requested in turn.`,
      confirmLabel: `${label} ${servers.length}`,
      danger: Boolean(danger),
      script: {
        subtitle: `${label} ${list}`,
        wlst: servers.map((server) => wlstForServerAction(server, action, scriptContext())).join('\n\n'),
        curl: servers.map((server) => curlForServerAction(server, action, scriptContext())).join('\n\n'),
      },
    })
    if (!ok) return

    const failures = []
    for (const server of servers) {
      busy.value = server
      try {
        await wls.serverAction(server, action)
      } catch (err) {
        failures.push(`${server}: ${err.fullText || err.message}`)
      }
    }
    busy.value = null

    const done = servers.length - failures.length
    if (done) ui.success(`${label} requested on ${done} server${done === 1 ? '' : 's'}`, 'States update as they change.')
    if (failures.length) ui.error(`${label} failed on ${failures.length}`, failures.join(' · '))
    setTimeout(() => onChanged?.(), 1500)
  }

  return { busy, run, runMany }
}
