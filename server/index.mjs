/**
 * Local backend for wl-console.
 *
 * The browser cannot talk to a WebLogic AdminServer directly: the REST
 * management API sends no CORS headers, and we do not want Basic credentials
 * living in browser storage. So this process — which runs on the operator's own
 * machine — holds the connections and proxies /api/wls/* to whichever
 * AdminServer is currently active. The browser only ever carries an opaque,
 * httpOnly session cookie.
 *
 * One browser session can hold several live connections at once, so switching
 * between domains is instant and does not re-authenticate. Saved profiles
 * (name, host, port, SSL, username) are persisted to disk; passwords never are,
 * so after a restart each profile needs its password entered once.
 *
 * It also serves the built SPA from dist/, so `npm start` is the whole app.
 */

import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { createReadStream, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORT = Number(process.env.WLC_PORT || 7101)
// Bound to loopback on purpose: this process can reach an AdminServer with
// admin credentials, so it must not be exposed on the network by default.
const HOST = process.env.WLC_HOST || '127.0.0.1'
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const HOME = process.env.WLC_HOME || path.join(os.homedir(), '.wl-console')
const PROFILES_FILE = path.join(HOME, 'profiles.json')
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
// A JSON API body is tiny; an application archive on its way to the deployment
// endpoint is not, so the two limits are kept apart.
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_UPLOAD_BYTES = Number(process.env.WLC_MAX_UPLOAD_MB || 256) * 1024 * 1024
/**
 * Runtime history. The browser polls only while a page is open, so trends are
 * sampled here instead: every live connection is asked for one compact runtime
 * snapshot on this interval and the result is kept in a ring buffer. Set
 * WLC_SAMPLE_MS=0 to turn sampling off completely.
 */
const SAMPLE_MS = Number(process.env.WLC_SAMPLE_MS ?? 15_000)
const HISTORY_MINUTES = Number(process.env.WLC_HISTORY_MINUTES || 120)
const MAX_SAMPLES = SAMPLE_MS > 0 ? Math.max(2, Math.ceil((HISTORY_MINUTES * 60_000) / SAMPLE_MS)) : 0
// Sampling follows the browser: a session nobody has touched for this long is
// left alone, so a console forgotten in a background tab stops polling.
const SAMPLE_IDLE_MS = 15 * 60_000
const COOKIE_NAME = 'wlc_session'
const REST_BASE = '/management/weblogic/latest'

/**
 * token -> { connections: Map<id, connection>, activeId, lastUsed }
 * In memory only: restarting the server drops every live connection.
 */
const sessions = new Map()

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [token, session] of sessions) {
    if (session.lastUsed < cutoff) sessions.delete(token)
  }
}, 60_000).unref()

// ---------------------------------------------------------------- profiles

/**
 * Saved connection targets, without credentials. Kept on disk so the list
 * survives restarts; a password is still required to bring one back to life.
 */
let profiles = loadProfiles()

function loadProfiles() {
  try {
    const raw = JSON.parse(readFileSync(PROFILES_FILE, 'utf8'))
    return Array.isArray(raw) ? raw.filter((p) => p?.id && p?.host) : []
  } catch {
    // Missing or unreadable file simply means "no profiles yet".
    return []
  }
}

function saveProfiles() {
  try {
    mkdirSync(HOME, { recursive: true })
    // Write-then-rename so an interrupted write cannot truncate the list.
    const tmp = `${PROFILES_FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(profiles, null, 2), { mode: 0o600 })
    renameSync(tmp, PROFILES_FILE)
  } catch (err) {
    console.error(`  Could not save profiles to ${PROFILES_FILE}: ${err.message}`)
  }
}

const profileKey = (p) => `${p.ssl ? 'https' : 'http'}://${p.username}@${p.host}:${p.port}`

function upsertProfile({ name, host, port, ssl, insecure, username }) {
  const key = profileKey({ host, port, ssl, username })
  const existing = profiles.find((p) => profileKey(p) === key)
  const profile = existing || { id: randomUUID() }
  Object.assign(profile, {
    name: name?.trim() || existing?.name || `${host}:${port}`,
    host,
    port,
    ssl,
    insecure,
    username,
    lastUsedAt: Date.now(),
  })
  if (!existing) profiles.push(profile)
  profiles.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
  saveProfiles()
  return profile
}

// ---------------------------------------------------------------- helpers

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(body)
}

function sendError(res, status, title, detail = '') {
  sendJson(res, status, { status, title, detail })
}

function readBody(req, limit = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const raw = await readBody(req)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw Object.assign(new Error('Malformed JSON body'), { status: 400 })
  }
}

function parseCookies(header = '') {
  const out = Object.create(null)
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function sessionFor(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  session.lastUsed = Date.now()
  return session
}

function cookieHeader(token) {
  // No Secure flag: this is served over plain http on loopback.
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
}

const clearedCookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

/** Everything about a connection except the credential itself. */
function publicConnection(connection, activeId) {
  return {
    id: connection.id,
    profileId: connection.profileId,
    name: connection.name,
    host: connection.host,
    port: connection.port,
    ssl: connection.ssl,
    insecure: connection.insecure,
    username: connection.username,
    baseUrl: connection.baseUrl,
    domain: connection.domain,
    connectedAt: connection.connectedAt,
    active: connection.id === activeId,
  }
}

function sessionState(session) {
  const connections = session ? [...session.connections.values()] : []
  const activeId = session?.activeId ?? null
  return {
    connected: Boolean(activeId && session.connections.has(activeId)),
    activeId,
    connections: connections.map((c) => publicConnection(c, activeId)),
    profiles,
  }
}

/** The connection a proxied call should use: pinned by header, else active. */
function resolveConnection(session, req) {
  if (!session) return null
  const pinned = req.headers['x-connection-id']
  if (pinned && session.connections.has(pinned)) return session.connections.get(pinned)
  if (pinned) return null
  return session.connections.get(session.activeId) || null
}

// ---------------------------------------------------------------- upstream

/**
 * One request to the AdminServer. Uses node:http(s) rather than fetch so that
 * self-signed certificates can be accepted per connection.
 */
function callAdminServer(connection, { method, path: restPath, body, headers = {}, timeoutMs = 120_000 }) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = new URL(connection.baseUrl + restPath)
    } catch {
      reject(Object.assign(new Error('Invalid upstream path'), { status: 400 }))
      return
    }
    const transport = url.protocol === 'https:' ? https : http
    const req = transport.request(
      url,
      {
        method,
        headers: {
          Authorization: connection.auth,
          Accept: 'application/json',
          // WebLogic rejects state-changing REST calls without this header.
          'X-Requested-By': 'wl-console',
          ...headers,
          ...(body?.length ? { 'Content-Length': body.length } : {}),
        },
        rejectUnauthorized: !connection.insecure,
      },
      (upstreamRes) => {
        const chunks = []
        upstreamRes.on('data', (c) => chunks.push(c))
        upstreamRes.on('end', () =>
          resolve({
            status: upstreamRes.statusCode || 502,
            contentType: upstreamRes.headers['content-type'] || 'application/json',
            body: Buffer.concat(chunks),
          }),
        )
      },
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error('The AdminServer did not respond in time'), { status: 504 }))
    })
    req.on('error', (err) => reject(normalizeUpstreamError(err)))
    if (body?.length) req.write(body)
    req.end()
  })
}

function normalizeUpstreamError(err) {
  const code = err?.code || ''
  const map = {
    ECONNREFUSED: 'Connection refused — is the AdminServer running on that host and port?',
    ENOTFOUND: 'Host not found — check the hostname or IP address.',
    EHOSTUNREACH: 'Host unreachable — check the network route or firewall.',
    ETIMEDOUT: 'Connection timed out — the host is not answering on that port.',
    ECONNRESET: 'Connection reset by the AdminServer. If it uses SSL, enable the SSL option.',
    EPROTO: 'Protocol mismatch — the port probably speaks SSL. Enable the SSL option.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'The AdminServer uses a self-signed certificate. Enable "trust self-signed".',
    SELF_SIGNED_CERT_IN_CHAIN: 'The certificate chain is self-signed. Enable "trust self-signed".',
    ERR_TLS_CERT_ALTNAME_INVALID: 'The certificate does not match this hostname. Enable "trust self-signed".',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'The certificate could not be verified. Enable "trust self-signed".',
  }
  const detail = map[code] || err?.message || 'The request to the AdminServer failed.'
  return Object.assign(new Error(detail), { status: err?.status || 502, code })
}

// ---------------------------------------------------------------- history

/**
 * One search that returns every running server's state, heap and thread pool.
 * Deliberately narrow: this runs on a timer, so it must stay one small request.
 */
const SAMPLE_PAYLOAD = JSON.stringify({
  links: [],
  fields: [],
  children: {
    serverRuntimes: {
      links: [],
      fields: ['name', 'state', 'healthState'],
      children: {
        JVMRuntime: { links: [], fields: ['heapSizeCurrent', 'heapFreeCurrent', 'heapSizeMax'] },
        threadPoolRuntime: {
          links: [],
          fields: [
            'executeThreadTotalCount',
            'executeThreadIdleCount',
            'standbyThreadCount',
            'stuckThreadCount',
            'hoggingThreadCount',
            'queueLength',
            'pendingUserRequestCount',
            'throughput',
          ],
        },
      },
    },
  },
})

/** healthState is an object in current releases and a HEALTH_* string in older ones. */
function healthLabel(health) {
  if (!health) return 'UNKNOWN'
  const raw = typeof health === 'string' ? health : health.state || 'UNKNOWN'
  return String(raw).replace(/^HEALTH_/, '').toUpperCase()
}

/**
 * Keys are short on purpose: one entry is stored per server per interval, and
 * the whole buffer goes to the browser on every poll.
 */
function toSample(payload) {
  const servers = {}
  for (const runtime of payload?.serverRuntimes?.items ?? []) {
    if (!runtime?.name) continue
    const jvm = runtime.JVMRuntime || {}
    const pool = runtime.threadPoolRuntime || {}
    const total = Number(pool.executeThreadTotalCount || 0)
    servers[runtime.name] = {
      st: runtime.state || 'UNKNOWN',
      he: healthLabel(runtime.healthState),
      hu: Number(jvm.heapSizeCurrent || 0) - Number(jvm.heapFreeCurrent || 0),
      hm: Number(jvm.heapSizeMax || jvm.heapSizeCurrent || 0),
      tt: total,
      tb: Math.max(0, total - Number(pool.executeThreadIdleCount || 0) - Number(pool.standbyThreadCount || 0)),
      sk: Number(pool.stuckThreadCount || 0),
      hg: Number(pool.hoggingThreadCount || 0),
      q: Number(pool.queueLength || 0),
      pr: Number(pool.pendingUserRequestCount || 0),
      tp: Number(pool.throughput || 0),
    }
  }
  return { t: Date.now(), servers }
}

async function sampleConnection(connection) {
  try {
    const upstream = await callAdminServer(connection, {
      method: 'POST',
      path: REST_BASE + '/domainRuntime/search',
      body: Buffer.from(SAMPLE_PAYLOAD),
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: 20_000,
    })
    if (upstream.status >= 400) {
      connection.historyError = 'The AdminServer answered ' + upstream.status + ' to the sampling request.'
      return
    }
    connection.history.push(toSample(JSON.parse(upstream.body.toString('utf8'))))
    if (connection.history.length > MAX_SAMPLES) {
      connection.history.splice(0, connection.history.length - MAX_SAMPLES)
    }
    connection.historyError = null
  } catch (err) {
    // A domain that is down must not write one console line per interval; the
    // last reason is reported to the UI instead.
    connection.historyError = err?.message || 'Sampling failed.'
  }
}

/** Live connections whose browser session is still being used, deduplicated. */
function connectionsToSample() {
  const seen = new Set()
  const out = []
  const cutoff = Date.now() - SAMPLE_IDLE_MS
  for (const session of sessions.values()) {
    if (session.lastUsed < cutoff) continue
    for (const connection of session.connections.values()) {
      if (seen.has(connection.id)) continue
      seen.add(connection.id)
      out.push(connection)
    }
  }
  return out
}

let sampling = false

function startSampler() {
  if (!SAMPLE_MS) return
  setInterval(async () => {
    // One tick at a time: a slow AdminServer must not stack requests up.
    if (sampling) return
    sampling = true
    try {
      await Promise.all(connectionsToSample().map(sampleConnection))
    } finally {
      sampling = false
    }
  }, SAMPLE_MS).unref()
}

function handleHistory(req, res, url) {
  const session = sessionFor(req)
  const connection = resolveConnection(session, req)
  if (!connection) {
    return sendError(res, 401, 'Not connected', 'The console session expired. Connect to an AdminServer again.')
  }
  const since = Number(url.searchParams.get('since') || 0)
  sendJson(res, 200, {
    sampling: SAMPLE_MS > 0,
    intervalMs: SAMPLE_MS,
    retentionMs: SAMPLE_MS * MAX_SAMPLES,
    error: connection.historyError || null,
    samples: connection.history.filter((sample) => sample.t > since),
  })
}

// ---------------------------------------------------------------- connections

/**
 * Hosts are routinely pasted as `t3://host:7001` — that is the address people
 * already have in WLST scripts. The UI splits those into fields, but a direct
 * API caller might not, and `http://t3://host:7001` is not a URL. T3 and HTTP
 * share the listen port, so only the scheme and any trailing port have to go.
 */
function sanitiseHost(value) {
  let host = String(value || '').trim()
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  host = host.split(',')[0].split(/[/?#]/)[0]
  const at = host.lastIndexOf('@')
  if (at >= 0) host = host.slice(at + 1)
  // A trailing :port is dropped; the port field is authoritative. IPv6 keeps
  // its colons because the pattern only matches a single one.
  const withPort = host.match(/^([^:]+):\d+$/)
  if (withPort) host = withPort[1]
  return host.trim()
}

async function handleCreateConnection(req, res) {
  const payload = await readJson(req)
  const host = sanitiseHost(payload.host)
  const port = Number(payload.port)
  const ssl = Boolean(payload.ssl)
  const insecure = Boolean(payload.insecure)
  const username = String(payload.username || '')
  const password = String(payload.password || '')
  const save = payload.save !== false

  if (!host) return sendError(res, 400, 'Host is required')
  if (/[\s\\]/.test(host)) {
    return sendError(res, 400, 'Invalid host', 'Enter a hostname or IP address, for example 10.0.0.12.')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return sendError(res, 400, 'Port must be between 1 and 65535')
  if (!username) return sendError(res, 400, 'Username is required')

  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const connection = {
    id: randomUUID(),
    name: String(payload.name || '').trim(),
    host,
    port,
    ssl,
    insecure,
    username,
    baseUrl: `${ssl ? 'https' : 'http'}://${bracketed}:${port}`,
    auth: 'Basic ' + Buffer.from(`${username}:${password}`, 'utf8').toString('base64'),
    domain: null,
    connectedAt: Date.now(),
    /** Ring buffer of runtime samples, filled by the sampler above. */
    history: [],
    historyError: null,
  }

  let upstream
  try {
    upstream = await callAdminServer(connection, {
      method: 'GET',
      path:
        REST_BASE +
        '/domainConfig?links=none&fields=name,configurationVersion,productionModeEnabled,rootDirectory,adminServerName',
      timeoutMs: 20_000,
    })
  } catch (err) {
    return sendError(res, err.status || 502, 'Cannot reach the AdminServer', err.message)
  }

  if (upstream.status === 401) {
    return sendError(res, 401, 'Invalid username or password', 'The AdminServer rejected these credentials.')
  }
  if (upstream.status === 403) {
    return sendError(res, 403, 'Access denied', 'This user cannot read the domain configuration.')
  }
  if (upstream.status === 404) {
    return sendError(
      res,
      404,
      'REST management API not found',
      'The port answered but /management is missing. Check that this is the AdminServer port and that RESTful Management Services are enabled.',
    )
  }
  if (upstream.status >= 400) {
    return sendError(
      res,
      upstream.status,
      'The AdminServer refused the connection check',
      upstream.body.toString('utf8').slice(0, 400),
    )
  }

  try {
    connection.domain = JSON.parse(upstream.body.toString('utf8'))
  } catch {
    return sendError(
      res,
      502,
      'Unexpected response',
      'The endpoint did not return JSON. Check that the host and port belong to a WebLogic AdminServer.',
    )
  }

  // A name the user gave wins; otherwise keep whatever this target is already
  // saved as, so reconnecting never silently renames an existing profile.
  const saved = profiles.find((p) => profileKey(p) === profileKey({ host, port, ssl, username }))
  connection.name = connection.name || saved?.name || connection.domain?.name || `${host}:${port}`
  if (save) connection.profileId = upsertProfile(connection).id

  // Reuse the browser's existing session so adding a second connection keeps
  // the first one live; only mint a cookie when there is no session yet.
  let session = sessionFor(req)
  let setCookie = null
  if (!session) {
    const token = randomUUID()
    session = { connections: new Map(), activeId: null, lastUsed: Date.now() }
    sessions.set(token, session)
    setCookie = cookieHeader(token)
  }

  // Reconnecting the same target as the same user replaces the old entry
  // rather than stacking duplicates.
  for (const [id, existing] of session.connections) {
    if (existing.baseUrl === connection.baseUrl && existing.username === connection.username) {
      session.connections.delete(id)
    }
  }

  session.connections.set(connection.id, connection)
  session.activeId = connection.id

  sendJson(res, 200, sessionState(session), setCookie ? { 'Set-Cookie': setCookie } : {})
}

function handleActivate(req, res, id) {
  const session = sessionFor(req)
  if (!session?.connections.has(id)) {
    return sendError(res, 404, 'No such connection', 'It may have been closed already. Reconnect to that domain.')
  }
  session.activeId = id
  const connection = session.connections.get(id)
  if (connection.profileId) {
    const profile = profiles.find((p) => p.id === connection.profileId)
    if (profile) {
      profile.lastUsedAt = Date.now()
      saveProfiles()
    }
  }
  sendJson(res, 200, sessionState(session))
}

function handleCloseConnection(req, res, id) {
  const session = sessionFor(req)
  if (!session) return sendJson(res, 200, sessionState(null))
  session.connections.delete(id)
  if (session.activeId === id) {
    // Fall back to whatever is still open, so the UI stays usable.
    session.activeId = session.connections.keys().next().value ?? null
  }
  sendJson(res, 200, sessionState(session))
}

function handleDisconnectAll(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  if (token) sessions.delete(token)
  sendJson(res, 200, sessionState(null), { 'Set-Cookie': clearedCookie })
}

function handleSession(req, res) {
  sendJson(res, 200, sessionState(sessionFor(req)))
}

async function handleUpdateProfile(req, res, id) {
  const profile = profiles.find((p) => p.id === id)
  if (!profile) return sendError(res, 404, 'No such profile')
  const payload = await readJson(req)
  const name = String(payload.name || '').trim()
  if (!name) return sendError(res, 400, 'Name cannot be empty')
  profile.name = name
  saveProfiles()

  // Keep any live connection created from this profile labelled consistently.
  const session = sessionFor(req)
  for (const connection of session?.connections.values() || []) {
    if (connection.profileId === id) connection.name = name
  }
  sendJson(res, 200, sessionState(session))
}

function handleDeleteProfile(req, res, id) {
  profiles = profiles.filter((p) => p.id !== id)
  saveProfiles()
  sendJson(res, 200, sessionState(sessionFor(req)))
}

async function handleProxy(req, res, restPath) {
  const session = sessionFor(req)
  const connection = resolveConnection(session, req)
  if (!connection) {
    return sendError(res, 401, 'Not connected', 'The console session expired. Connect to an AdminServer again.')
  }

  // Deploying an application posts an archive through here, so the proxy gets
  // the generous limit while the console's own JSON endpoints keep the small one.
  const body = ['GET', 'HEAD', 'DELETE'].includes(req.method) ? null : await readBody(req, MAX_UPLOAD_BYTES)
  let upstream
  try {
    upstream = await callAdminServer(connection, {
      method: req.method,
      path: REST_BASE + restPath,
      body,
      headers: body?.length ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {},
    })
  } catch (err) {
    return sendError(res, err.status || 502, 'Cannot reach the AdminServer', err.message)
  }

  res.writeHead(upstream.status, {
    'Content-Type': upstream.contentType,
    'Cache-Control': 'no-store',
    'Content-Length': upstream.body.length,
  })
  res.end(upstream.body)
}

// ---------------------------------------------------------------- static

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

async function serveStatic(req, res, urlPath) {
  const relative = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '')
  let file = path.join(DIST, relative)
  // Directory traversal guard: everything must stay inside dist/.
  if (!file.startsWith(DIST)) return sendError(res, 400, 'Bad path')

  let info = await stat(file).catch(() => null)
  if (info?.isDirectory()) {
    file = path.join(file, 'index.html')
    info = await stat(file).catch(() => null)
  }
  if (!info) {
    // SPA fallback so deep links like /servers work on reload.
    file = path.join(DIST, 'index.html')
    info = await stat(file).catch(() => null)
  }
  if (!info) {
    return sendError(
      res,
      404,
      'UI not built',
      'Run "npm run build" first, or use "npm run dev" for the development server.',
    )
  }

  const ext = path.extname(file).toLowerCase()
  // path.normalize yields backslashes on Windows, so compare on a slash form.
  const immutable = relative.replace(/\\/g, '/').startsWith('assets/')
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
  })
  createReadStream(file).pipe(res)
}

// ---------------------------------------------------------------- server

const CONNECTION_ROUTE = /^\/api\/connections\/([^/]+)(?:\/(activate))?$/
const PROFILE_ROUTE = /^\/api\/profiles\/([^/]+)$/

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const { pathname } = url
  const { method } = req

  try {
    if (pathname === '/api/session' && method === 'GET') return handleSession(req, res)
    if (pathname === '/api/history' && method === 'GET') return handleHistory(req, res, url)
    if (pathname === '/api/connections' && method === 'POST') return await handleCreateConnection(req, res)
    if (pathname === '/api/disconnect' && method === 'POST') return handleDisconnectAll(req, res)

    const connectionMatch = pathname.match(CONNECTION_ROUTE)
    if (connectionMatch) {
      const [, id, action] = connectionMatch
      if (action === 'activate' && method === 'POST') return handleActivate(req, res, id)
      if (!action && method === 'DELETE') return handleCloseConnection(req, res, id)
    }

    const profileMatch = pathname.match(PROFILE_ROUTE)
    if (profileMatch) {
      const [, id] = profileMatch
      if (method === 'PATCH') return await handleUpdateProfile(req, res, id)
      if (method === 'DELETE') return handleDeleteProfile(req, res, id)
    }

    if (pathname.startsWith('/api/wls/')) {
      return await handleProxy(req, res, pathname.slice('/api/wls'.length) + url.search)
    }
    if (pathname.startsWith('/api/')) return sendError(res, 404, 'Unknown API endpoint', `${method} ${pathname}`)
    return await serveStatic(req, res, pathname)
  } catch (err) {
    if (res.headersSent) {
      res.destroy()
      return
    }
    sendError(res, err?.status || 500, 'Console backend error', err?.message || String(err))
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use — another wl-console may be running.`)
    console.error(`  Stop it, or start this one on another port: WLC_PORT=7102 npm start\n`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, HOST, () => {
  console.log(`\n  wl-console backend listening on http://${HOST}:${PORT}`)
  console.log(`  ${profiles.length} saved connection profile(s) in ${PROFILES_FILE}`)
  console.log(
    SAMPLE_MS
      ? `  Sampling runtime every ${SAMPLE_MS / 1000}s, keeping ${HISTORY_MINUTES} minutes of history`
      : '  Runtime sampling is off (WLC_SAMPLE_MS=0) — charts stay empty',
  )
  startSampler()
  console.log('  Open that address in a browser and connect to an AdminServer.\n')
})
