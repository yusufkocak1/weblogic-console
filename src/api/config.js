/**
 * Configuration editing over the `edit` tree.
 *
 * Reading a monitoring page is a plain GET, but changing a setting is a
 * three-step protocol in WebLogic: take the configuration lock (startEdit),
 * post the new attribute values, then activate what is pending. Nothing is live
 * until that last step, and the lock is domain-wide — one person at a time.
 *
 * Everything here is deliberately thin; the changes store owns the sequence and
 * the Configuration page makes each step visible instead of hiding it.
 */

import { get, post } from './client'

const enc = encodeURIComponent

/** Lock state of the domain: who holds it, and whether changes are waiting. */
export function changeManager(options) {
  return get('/edit/changeManager', { links: 'none' }, options)
}

/**
 * The list of pending changes. Only some releases expose it, so a failure is
 * reported as "unknown" rather than an error: `hasChanges` above still tells
 * the user that something is waiting.
 */
export async function pendingChanges(options) {
  try {
    return await get('/edit/changeManager/changes', { links: 'none' }, options)
  } catch (err) {
    if (err?.name === 'AbortError' || err?.isAuthError) throw err
    return null
  }
}

/** Takes the configuration lock. Fails with 400 if somebody else holds it. */
export const startEdit = (options) => post('/edit/changeManager/startEdit', {}, options)

/** Makes every pending change live and releases the lock. */
export const activateChanges = (options) => post('/edit/changeManager/activateChanges', {}, options)

/** Throws every pending change away; the lock is released with cancelEdit. */
export const undoChanges = (options) => post('/edit/changeManager/undoChanges', {}, options)

export const cancelEdit = (options) => post('/edit/changeManager/cancelEdit', {}, options)

/**
 * Reads one MBean from the edit tree. Values come back with pending changes
 * already applied, which is what an operator expects to see in a form.
 *
 * No `fields` filter: naming an attribute a release does not have is an error,
 * and a single MBean is small enough to fetch whole.
 */
export const readMBean = (path, options) => get(path, { links: 'none' }, options)

/** Writes the given attributes. Only changed ones should be in `attributes`. */
export const updateMBean = (path, attributes, options) => post(path, attributes, options)

/** Names only — enough to fill the "which one?" picker on the page. */
const names = (collection, options) => get(`/edit/${collection}`, { links: 'none', fields: 'name' }, options)

export function editTargets(options) {
  return Promise.all([
    names('servers', options),
    names('clusters', options),
    names('JDBCSystemResources', options),
    names('appDeployments', options),
  ]).then(([servers, clusters, dataSources, deployments]) => ({
    servers,
    clusters,
    dataSources,
    deployments,
  }))
}

export const serverPath = (name) => `/edit/servers/${enc(name)}`
export const clusterPath = (name) => `/edit/clusters/${enc(name)}`
export const dataSourcePath = (name) => `/edit/JDBCSystemResources/${enc(name)}/JDBCResource`
export const deploymentPath = (name) => `/edit/appDeployments/${enc(name)}`
