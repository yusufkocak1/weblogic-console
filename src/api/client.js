/**
 * Talks to the local console backend, never to WebLogic directly.
 *
 * server/index.mjs holds the AdminServer connection (URL + credentials) for the
 * session and forwards everything under /api/wls to the REST management API, so
 * the browser carries nothing but an httpOnly session cookie.
 */

export const API_BASE = '/api'
export const WLS_BASE = '/api/wls'

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
  const title =
    payload?.title ||
    messages[0] ||
    payload?.detail ||
    (status === 401 ? 'Not connected' : `Request failed with status ${status}`)
  const detail = payload?.detail && payload.detail !== title ? payload.detail : ''
  return new WlsError(title, { status, detail, messages, path })
}

async function send(url, { method = 'GET', body, signal, timeoutMs = 60000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new WlsError('Request timed out', { path: url })), timeoutMs)
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
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof WlsError) throw err
    if (err?.name === 'AbortError') throw err
    throw new WlsError('The console backend is not responding', {
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

export const request = (path, options = {}) =>
  send(buildUrl(WLS_BASE, path, options.params), options)

export const get = (path, params, options) => request(path, { ...options, params })
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body: body ?? {} })
export const put = (path, body, options) => request(path, { ...options, method: 'PUT', body: body ?? {} })
export const del = (path, options) => request(path, { ...options, method: 'DELETE' })

/**
 * The bulk-read endpoint every tree exposes. One POST returns a whole subtree,
 * which keeps a page to a single round trip instead of one call per MBean.
 */
export const search = (tree, payload, options) => post(`/${tree}/search`, payload, options)

// --- console backend ---------------------------------------------------------

export const connect = (credentials) => send(`${API_BASE}/connect`, { method: 'POST', body: credentials, timeoutMs: 30000 })
export const disconnect = () => send(`${API_BASE}/disconnect`, { method: 'POST' })
export const session = () => send(`${API_BASE}/session`, { timeoutMs: 10000 })
