import { ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useActivityStore } from '@/stores/activity'
import { useUiStore } from '@/stores/ui'
import { useConnectionStore } from '@/stores/connection'
import { curlForServerAction, wlstForServerAction } from '@/utils/wlst'

/**
 * Server lifecycle operations, shared by the Servers list and a single
 * server's own page — a setting that needs a restart is useless if the restart
 * lives on another screen.
 */

/**
 * Which lifecycle operations make sense for a given state.
 *
 * The state itself rides along on each descriptor as `from`: it is what the
 * server was in before the button was pressed, and the activity log needs it
 * to say what the action actually changed.
 */
export function actionsFor(state) {
  return actionsForState(state).map((entry) => ({ ...entry, from: state }))
}

function actionsForState(state) {
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
 * The state each operation is asking the server to reach. Used to describe the
 * action in the activity log, and — read the other way round — to know which
 * operation would undo it.
 */
export const ACTION_RESULT = {
  start: 'RUNNING',
  resume: 'RUNNING',
  suspend: 'ADMIN',
  shutdown: 'SHUTDOWN',
  forceShutdown: 'SHUTDOWN',
}

/**
 * The operation that undoes each one. A shutdown is undone by starting the
 * server again — which is not the same as the shutdown never having happened,
 * so the log says so rather than calling it an erasure.
 */
export const INVERSE_ACTION = {
  start: { action: 'shutdown', label: 'Shutdown' },
  resume: { action: 'suspend', label: 'Suspend' },
  suspend: { action: 'resume', label: 'Resume' },
  shutdown: { action: 'start', label: 'Start' },
  forceShutdown: { action: 'start', label: 'Start' },
}

/**
 * @param {{confirm: import('vue').Ref, onChanged: () => void}} options
 *   `confirm` is a ref to a ConfirmDialog; `onChanged` reloads the caller's
 *   data once the transition has had a moment to show up in the runtime tree.
 */
export function useServerActions({ confirm, onChanged }) {
  const ui = useUiStore()
  const connection = useConnectionStore()
  const activity = useActivityStore()
  const busy = ref(null)

  const scriptContext = () => ({ username: connection.username, baseUrl: connection.baseUrl })

  /**
   * One lifecycle operation as the activity log holds it: which servers, from
   * which state to which, and the request that would put them back.
   *
   * `from` is only known when the button came from actionsFor() — a bulk
   * action offers the same operation over servers in different states — so it
   * falls back to whatever the runtime last reported rather than inventing one.
   */
  function log(servers, { action, label, from }, error) {
    const inverse = INVERSE_ACTION[action]
    const changes = servers.map((server) => ({
      label: server,
      attr: 'state',
      from: from || 'previous state',
      to: ACTION_RESULT[action] || action,
    }))
    const what = servers.length === 1 ? servers[0] : `${servers.length} servers`

    if (error) {
      activity.record({
        kind: 'lifecycle',
        title: `Failed — ${label} ${what}`,
        summary: error,
        changes,
        status: 'failed',
        undoNote: 'Nothing to roll back: the operation did not go through.',
      })
      return
    }

    activity.record({
      kind: 'lifecycle',
      title: `${label} ${what}`,
      summary: ACTION_DESCRIPTIONS[action] || '',
      changes,
      undo: inverse
        ? {
            type: 'lifecycle',
            servers: [...servers],
            action: inverse.action,
            summary: `${inverse.label} requested on ${what}.`,
            body:
              `${inverse.label} is requested on ${what}, one server at a time. ` +
              'A server that has been through a shutdown does not come back where it was — sessions and in-flight work are gone either way.',
            hint: `${inverse.label} ${what}`,
          }
        : null,
      undoNote: inverse ? '' : 'This operation has no opposite.',
    })
  }

  async function run(server, { action, label, danger, from }) {
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
      log([server], { action, label, from })
      ui.success(`${label} requested`, `${server} is transitioning — the state updates as it changes.`)
      setTimeout(() => onChanged?.(), 1500)
    } catch (err) {
      log([server], { action, label, from }, err.fullText || err.message)
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
  async function runMany(servers, { action, label, danger, from }) {
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
    const succeeded = []
    for (const server of servers) {
      busy.value = server
      try {
        await wls.serverAction(server, action)
        succeeded.push(server)
      } catch (err) {
        failures.push(`${server}: ${err.fullText || err.message}`)
      }
    }
    busy.value = null

    // Logged as two entries rather than one mixed one: the servers it worked
    // on are the ones a rollback would act on, and the ones it failed on are a
    // different piece of news.
    if (succeeded.length) log(succeeded, { action, label, from })
    if (failures.length) log(servers.filter((server) => !succeeded.includes(server)), { action, label, from }, failures.join(' · '))

    const done = servers.length - failures.length
    if (done) ui.success(`${label} requested on ${done} server${done === 1 ? '' : 's'}`, 'States update as they change.')
    if (failures.length) ui.error(`${label} failed on ${failures.length}`, failures.join(' · '))
    setTimeout(() => onChanged?.(), 1500)
  }

  return { busy, run, runMany }
}
