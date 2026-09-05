/**
 * Talks to the local console backend, never to WebLogic directly.
 *
 * server/index.mjs holds the AdminServer connections (URL + credentials) and
 * forwards everything under /api/wls to the REST management API, so the browser
 * carries nothing but an httpOnly session cookie.
 */

import { t } from '@/i18n'

export const API_BASE = '/api'
export const WLS_BASE = '/api/wls'

/**
 * The connection a REST call should be routed to. Pinning it per request means
 * a response that arrives after the user switched domains cannot be mistaken
 * for data about the newly active one.
 */
let activeConnectionId = null

export function setActiveConnectionId(id) {
  activeConnectionId = id || null
}

export class WlsError extends Error {
  constructor(message, { status = 0, detail = '', messages = [], path = '' } = {}) {
    super(message)
    this.name = 'WlsError'
    this.status = status
    this.detail = detail
    this.messages = messages
    this.path = path
  }

  /** 401 means the console session is gone; 403 means WebLogic said no. */
  get isAuthError() {
    return this.status === 401
  }

  /** The user is signed in, but their WebLogic role does not allow this. */
  get isForbidden() {
    return this.status === 403
  }

  get fullText() {
    return [this.message, this.detail, ...this.messages].filter(Boolean).join(' — ')
  }
}

function buildUrl(base, path, params) {
  const url = base + (path.startsWith('/') ? path : `/${path}`)
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const query = qs.toString()
  return query ? `${url}?${query}` : url
}

/**
 * Two error shapes arrive here: the backend's {status,title,detail} and
 * WebLogic's own {type,title,detail,messages[]}. Both collapse to the same
 * WlsError so views can render failures uniformly.
 */
function describeError(status, payload, path) {
  const messages = (payload?.messages || [])
    .map((m) => (typeof m === 'string' ? m : m?.message))
    .filter(Boolean)

  // 403 is the one status whose own words never help: WebLogic answers with
  // "Forbidden", or with a security-policy sentence that reads like a bug. The
  // console says what it actually means and keeps the server's words below it,
  // so every caller gets the same sentence without repeating it at 23 sites.
  if (status === 403) {
    const reason = [payload?.title, payload?.detail, ...messages]
      .filter(Boolean)
      .filter((line, index, all) => line !== 'Not authorized for this operation' && all.indexOf(line) === index)
      .join(' — ')
    return new WlsError(t('You are not authorized to do this'), {
      status,
      detail:
        reason ||
        t('Your WebLogic user does not have the role this operation needs. Ask a domain administrator.'),
      path,
    })
  }

  const title =
    payload?.title ||
    messages[0] ||
    payload?.detail ||
    (status === 401 ? t('Not connected') : t('Request failed with status {status}', { status }))
  const detail = payload?.detail && payload.detail !== title ? payload.detail : ''
  return new WlsError(title, { status, detail, messages, path })
}

async function send(url, { method = 'GET', body, signal, timeoutMs = 60000, headers = {}, form } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new WlsError(t('Request timed out'), { path: url })), timeoutMs)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        // A multipart upload must set no Content-Type at all: the browser adds
        // one with the boundary, and overriding it makes the body unparseable.
        ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: form ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof WlsError) throw err
    if (err?.name === 'AbortError') throw err
    throw new WlsError(t('The console backend is not responding'), {
      detail: 'Make sure the local server is running (npm run dev).',
      path: url,
    })
  }
  clearTimeout(timer)

  const isJson = (response.headers.get('content-type') || '').includes('json')
  const payload =
    response.status === 204 ? null : isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    throw describeError(response.status, isJson ? payload : { detail: String(payload || '').slice(0, 500) }, url)
  }
  return payload
}

// --- WebLogic REST (proxied) -------------------------------------------------

export const request = (path, options = {}) => {
  // `connectionId` lets one call go to a domain other than the active one —
  // the Compare page reads two domains side by side that way.
  const target = options.connectionId || activeConnectionId
  return send(buildUrl(WLS_BASE, path, options.params), {
    ...options,
    headers: {
      ...(target ? { 'X-Connection-Id': target } : {}),
      ...options.headers,
    },
  })
}

export const get = (path, params, options) => request(path, { ...options, params })
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body: body ?? {} })
export const put = (path, body, options) => request(path, { ...options, method: 'PUT', body: body ?? {} })
export const del = (path, options) => request(path, { ...options, method: 'DELETE' })

/**
 * Multipart POST — how WebLogic takes an application archive. The body is a
 * FormData, so it is sent as-is and the browser writes the Content-Type.
 */
export const postForm = (path, formData, options = {}) =>
  request(path, { ...options, method: 'POST', body: formData, form: true, timeoutMs: options.timeoutMs ?? 600000 })

/**
 * The bulk-read endpoint every tree exposes. One POST returns a whole subtree,
 * which keeps a page to a single round trip instead of one call per MBean.
 */
export const search = (tree, payload, options) => post(`/${tree}/search`, payload, options)

// --- console backend ---------------------------------------------------------
// Each of these returns the full session state: connections plus saved profiles.

export const session = () => send(`${API_BASE}/session`, { timeoutMs: 10000 })

/**
 * Runtime samples the backend has collected for a connection. `since` is the
 * newest timestamp already held, so a poll carries back only what is new.
 */
export const history = (since = 0, options = {}) => {
  const target = options.connectionId || activeConnectionId
  return send(buildUrl(API_BASE, '/history', { since: since || undefined }), {
    ...options,
    timeoutMs: options.timeoutMs ?? 15000,
    headers: target ? { 'X-Connection-Id': target } : {},
  })
}

export const openConnection = (credentials) =>
  send(`${API_BASE}/connections`, { method: 'POST', body: credentials, timeoutMs: 30000 })

export const activateConnection = (id) =>
  send(`${API_BASE}/connections/${encodeURIComponent(id)}/activate`, { method: 'POST' })

export const closeConnection = (id) =>
  send(`${API_BASE}/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const disconnectAll = () => send(`${API_BASE}/disconnect`, { method: 'POST' })

export const renameProfile = (id, name) =>
  send(`${API_BASE}/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } })

export const deleteProfile = (id) => send(`${API_BASE}/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
