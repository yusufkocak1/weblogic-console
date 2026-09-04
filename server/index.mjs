/**
 * Local backend for wl-console.
 *
 * The browser cannot talk to a WebLogic AdminServer directly: the REST
 * management API sends no CORS headers, and we do not want Basic credentials
 * living in browser storage. So this process — which runs on the operator's own
 * machine — holds the connection and proxies /api/wls/* to whichever AdminServer
 * was entered on the login screen. The browser only ever carries an opaque,
 * httpOnly session cookie.
 *
 * It also serves the built SPA from dist/, so `npm start` is the whole app.
 */

import http from 'node:http'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORT = Number(process.env.WLC_PORT || 7101)
// Bound to loopback on purpose: this process can reach an AdminServer with
// admin credentials, so it must not be exposed on the network by default.
const HOST = process.env.WLC_HOST || '127.0.0.1'
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MAX_BODY_BYTES = 32 * 1024 * 1024
const COOKIE_NAME = 'wlc_session'
const REST_BASE = '/management/weblogic/latest'

/** token -> connection. In memory only: restarting the server drops sessions. */
const sessions = new Map()

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [token, session] of sessions) {
    if (session.lastUsed < cutoff) sessions.delete(token)
  }
}, 60_000).unref()

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
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

function publicSession(session) {
  return {
    host: session.host,
    port: session.port,
    ssl: session.ssl,
    insecure: session.insecure,
    username: session.username,
    baseUrl: session.baseUrl,
    domain: session.domain,
    connectedAt: session.createdAt,
  }
}

// ---------------------------------------------------------------- upstream

/**
 * One request to the AdminServer. Uses node:http(s) rather than fetch so that
 * self-signed certificates can be accepted per connection.
 */
function callAdminServer(session, { method, path: restPath, body, headers = {}, timeoutMs = 120_000 }) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = new URL(session.baseUrl + restPath)
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
          Authorization: session.auth,
          Accept: 'application/json',
          // WebLogic rejects state-changing REST calls without this header.
          'X-Requested-By': 'wl-console',
          ...headers,
          ...(body?.length ? { 'Content-Length': body.length } : {}),
        },
        rejectUnauthorized: !session.insecure,
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

// ---------------------------------------------------------------- routes

async function handleConnect(req, res) {
  const payload = await readJson(req)
  const host = String(payload.host || '').trim()
  const port = Number(payload.port)
  const ssl = Boolean(payload.ssl)
  const insecure = Boolean(payload.insecure)
  const username = String(payload.username || '')
  const password = String(payload.password || '')

  if (!host) return sendError(res, 400, 'Host is required')
  if (!Number.isInteger(port) || port < 1 || port > 65535) return sendError(res, 400, 'Port must be between 1 and 65535')
  if (!username) return sendError(res, 400, 'Username is required')

  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const baseUrl = `${ssl ? 'https' : 'http'}://${bracketed}:${port}`
  const session = {
    host,
    port,
    ssl,
    insecure,
    username,
    baseUrl,
    auth: 'Basic ' + Buffer.from(`${username}:${password}`, 'utf8').toString('base64'),
    domain: null,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  }

  let upstream
  try {
    upstream = await callAdminServer(session, {
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
    return sendError(res, upstream.status, 'The AdminServer refused the connection check', upstream.body.toString('utf8').slice(0, 400))
  }

  try {
    session.domain = JSON.parse(upstream.body.toString('utf8'))
  } catch {
    return sendError(
      res,
      502,
      'Unexpected response',
      'The endpoint did not return JSON. Check that the host and port belong to a WebLogic AdminServer.',
    )
  }

  const token = randomUUID()
  sessions.set(token, session)
  sendJson(res, 200, publicSession(session), { 'Set-Cookie': cookieHeader(token) })
}

function handleDisconnect(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  if (token) sessions.delete(token)
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearedCookie })
}

function handleSession(req, res) {
  const session = sessionFor(req)
  if (!session) return sendJson(res, 200, { connected: false })
  sendJson(res, 200, { connected: true, ...publicSession(session) })
}

async function handleProxy(req, res, restPath) {
  const session = sessionFor(req)
  if (!session) {
    return sendError(res, 401, 'Not connected', 'The console session expired. Connect to an AdminServer again.')
  }

  const body = ['GET', 'HEAD', 'DELETE'].includes(req.method) ? null : await readBody(req)
  let upstream
  try {
    upstream = await callAdminServer(session, {
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const { pathname } = url

  try {
    if (pathname === '/api/connect' && req.method === 'POST') return await handleConnect(req, res)
    if (pathname === '/api/disconnect' && req.method === 'POST') return handleDisconnect(req, res)
    if (pathname === '/api/session' && req.method === 'GET') return handleSession(req, res)
    if (pathname.startsWith('/api/wls/')) {
      return await handleProxy(req, res, pathname.slice('/api/wls'.length) + url.search)
    }
    if (pathname.startsWith('/api/')) return sendError(res, 404, 'Unknown API endpoint', pathname)
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
  console.log('  Open that address in a browser and enter your AdminServer details.\n')
})
