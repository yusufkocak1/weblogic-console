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
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORT = Number(process.env.WLC_PORT || 7101)
// Bound to loopback on purpose: this process can reach an AdminServer with
// admin credentials, so it must not be exposed on the network by default.
const HOST = process.env.WLC_HOST || '127.0.0.1'
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const HOME = process.env.WLC_HOME || path.join(os.homedir(), '.wl-console')
const PROFILES_FILE = path.join(HOME, 'profiles.json')
const HISTORY_DIR = path.join(HOME, 'history')
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
// left alone, so a console forgotten in a background tab stops polling. Set
// WLC_SAMPLE_ALWAYS=1 on a console that is meant to keep watching regardless —
// the point of that being that whoever arrives in the morning finds the night
// in the charts.
const SAMPLE_IDLE_MS = 15 * 60_000
const SAMPLE_ALWAYS = process.env.WLC_SAMPLE_ALWAYS === '1'
/**
 * The in-memory ring buffer is what the browser draws; this is how long the
 * same samples survive on disk, so a restart of this process — or of the
 * machine — does not erase last night. Set WLC_HISTORY_FILE_MINUTES=0 to keep
 * nothing on disk at all.
 */
const HISTORY_FILE_MINUTES = Number(process.env.WLC_HISTORY_FILE_MINUTES ?? 24 * 60)
/** Rewriting the file on every sample would be silly; every this-many is enough. */
const COMPACT_EVERY = 240
/**
 * Data sources, JTA and JMS cost one more subtree in the same search. On a
 * domain large enough for that to matter, WLC_SAMPLE_DEPTH=basic goes back to
 * servers, heap and threads alone.
 */
const SAMPLE_DEPTH = process.env.WLC_SAMPLE_DEPTH === 'basic' ? 'basic' : 'full'
/**
 * An OpenMetrics endpoint, so a domain this console is already sampling can be
 * scraped by whatever monitoring stack the site runs. Off unless asked for: it
 * answers without a console session, and although the process is bound to
 * loopback, exposing runtime numbers should still be a decision somebody made.
 */
const METRICS_TOKEN = process.env.WLC_METRICS_TOKEN || ''
const METRICS_ENABLED = Boolean(METRICS_TOKEN) || process.env.WLC_METRICS === '1'
/**
 * Where alerts go when nobody is looking at the browser. The rules run in the
 * browser — that is where the thresholds are set — so the console posts what
 * they raised here and this process forwards it, which is the only half of the
 * pair that can reach a chat webhook.
 */
const ALERT_WEBHOOK = process.env.WLC_ALERT_WEBHOOK || ''
/** A misbehaving rule must not turn into a thousand webhook calls. */
const WEBHOOK_MAX_PER_HOUR = Number(process.env.WLC_ALERT_WEBHOOK_MAX_PER_HOUR || 60)
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
    permissions: connection.permissions || { configure: true, known: false },
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

/**
 * What this user is allowed to change, asked once at connect.
 *
 * WebLogic does not report a user's roles over REST, but it does answer 403 to
 * whatever the role cannot reach, and every configuration change goes through
 * the edit tree. So one read of the change manager separates a Monitor from an
 * operator who can configure the domain — which lets the settings pages open
 * read-only instead of offering a Save that is refused at the end.
 *
 * An inconclusive answer leaves `configure` true with `known` false: guessing
 * "no" would lock a capable user out of their own domain, so the UI stays open
 * and the 403 message carries the explanation if it ever comes.
 */
async function probePermissions(connection) {
  try {
    const res = await callAdminServer(connection, {
      method: 'GET',
      path: REST_BASE + '/edit/changeManager?links=none',
      timeoutMs: 15_000,
    })
    if (res.status === 403) return { configure: false, known: true }
    if (res.status < 400) return { configure: true, known: true }
    return { configure: true, known: false }
  } catch {
    return { configure: true, known: false }
  }
}

// ---------------------------------------------------------------- history

/**
 * One search that returns every running server's state, heap and thread pool —
 * and, at full depth, the three subsystems a slow server is usually waiting on.
 *
 * Deliberately narrow: this runs on a timer, so it must stay one small request.
 * The thread pool answers "is this server busy"; the JDBC pool answers "is it
 * busy because it is waiting for a database", which is the next question in
 * almost every investigation and could not be answered from history before.
 */
function samplePayload(depth) {
  const serverChildren = {
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
  }

  if (depth === 'full') {
    serverChildren.JDBCServiceRuntime = {
      links: [],
      fields: [],
      children: {
        JDBCDataSourceRuntimeMBeans: {
          links: [],
          fields: [
            'name',
            'activeConnectionsCurrentCount',
            'currCapacity',
            'waitingForConnectionCurrentCount',
            'connectionDelayTime',
            'failuresToReconnectCount',
          ],
        },
      },
    }
    // No `fields` filter on JTARuntime: its attributes differ between releases
    // and naming one a release does not have fails the whole search.
    serverChildren.JTARuntime = { links: [] }
    serverChildren.JMSRuntime = {
      links: [],
      fields: [],
      children: {
        JMSServers: { links: [], fields: ['name', 'messagesCurrentCount', 'messagesPendingCount'] },
      },
    }
  }

  return JSON.stringify({
    links: [],
    fields: [],
    children: {
      serverRuntimes: {
        links: [],
        fields: ['name', 'state', 'healthState', 'activationTime', 'openSocketsCurrentCount'],
        children: serverChildren,
      },
    },
  })
}

const SAMPLE_PAYLOAD = samplePayload(SAMPLE_DEPTH)

/** healthState is an object in current releases and a HEALTH_* string in older ones. */
function healthLabel(health) {
  if (!health) return 'UNKNOWN'
  const raw = typeof health === 'string' ? health : health.state || 'UNKNOWN'
  return String(raw).replace(/^HEALTH_/, '').toUpperCase()
}

/** Anything WebLogic did not answer with becomes 0 rather than NaN or null. */
function n(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * Copies only the values worth storing. Zero is the resting value of nearly
 * every counter added below — no connection waiting, no message pending — and
 * a buffer that stores it thousands of times is mostly the digit 0. The browser
 * reads a missing key as zero, which is what it means.
 */
function nonZero(values) {
  const out = {}
  for (const [key, value] of Object.entries(values)) if (value) out[key] = value
  return out
}

/**
 * Keys are short on purpose: one entry is stored per server per interval, and
 * the whole buffer goes to the browser on its first poll.
 */
function toSample(payload) {
  const servers = {}
  for (const runtime of payload?.serverRuntimes?.items ?? []) {
    if (!runtime?.name) continue
    const jvm = runtime.JVMRuntime
    const pool = runtime.threadPoolRuntime

    const entry = {
      st: runtime.state || 'UNKNOWN',
      he: healthLabel(runtime.healthState),
    }

    // A server that is not running has no runtime subtrees at all, and its
    // numbers are stored as absent rather than as zero. Zero is a reading —
    // "this pool had no busy threads" — and a chart given zeros draws a
    // confident flat line across an outage instead of leaving it blank.
    if (jvm) {
      entry.hu = n(jvm.heapSizeCurrent) - n(jvm.heapFreeCurrent)
      entry.hm = n(jvm.heapSizeMax) || n(jvm.heapSizeCurrent)
    }
    if (pool) {
      const total = n(pool.executeThreadTotalCount)
      entry.tt = total
      entry.tb = Math.max(0, total - n(pool.executeThreadIdleCount) - n(pool.standbyThreadCount))
      entry.sk = n(pool.stuckThreadCount)
      entry.hg = n(pool.hoggingThreadCount)
      entry.q = n(pool.queueLength)
      entry.pr = n(pool.pendingUserRequestCount)
      entry.tp = n(pool.throughput)
    }
    // When this JVM came up. A value that changes between two samples is a
    // restart, which no other number here reveals.
    if (runtime.activationTime) entry.ac = n(runtime.activationTime)
    if (runtime.openSocketsCurrentCount !== undefined) entry.so = n(runtime.openSocketsCurrentCount)

    // Per-pool detail, plus the rollups the monitoring page charts. The rollups
    // are stored rather than summed in the browser so that a chart of the whole
    // server costs nothing even when a pool has come or gone in between.
    const pools = runtime.JDBCServiceRuntime?.JDBCDataSourceRuntimeMBeans?.items ?? []
    if (pools.length) {
      const detail = {}
      let active = 0
      let capacity = 0
      let waiting = 0
      let failures = 0
      for (const ds of pools) {
        if (!ds?.name) continue
        const values = {
          a: n(ds.activeConnectionsCurrentCount),
          c: n(ds.currCapacity),
          w: n(ds.waitingForConnectionCurrentCount),
          d: n(ds.connectionDelayTime),
          f: n(ds.failuresToReconnectCount),
        }
        active += values.a
        capacity += values.c
        waiting += values.w
        failures += values.f
        const kept = nonZero(values)
        // An idle pool is stored as nothing at all; the server entry being
        // present is what says the reading happened.
        if (Object.keys(kept).length) detail[ds.name] = kept
      }
      Object.assign(entry, nonZero({ dsa: active, dsc: capacity, dsw: waiting, dsf: failures }))
      if (Object.keys(detail).length) entry.ds = detail
    }

    const jta = runtime.JTARuntime
    if (jta) {
      Object.assign(
        entry,
        nonZero({
          jta: n(jta.activeTransactionsTotalCount),
          jtc: n(jta.transactionCommittedTotalCount),
          jtr: n(jta.transactionRolledBackTotalCount),
        }),
      )
    }

    const jmsServers = runtime.JMSRuntime?.JMSServers?.items ?? []
    if (jmsServers.length) {
      const detail = {}
      let current = 0
      let pending = 0
      for (const jms of jmsServers) {
        if (!jms?.name) continue
        const values = { c: n(jms.messagesCurrentCount), p: n(jms.messagesPendingCount) }
        current += values.c
        pending += values.p
        const kept = nonZero(values)
        if (Object.keys(kept).length) detail[jms.name] = kept
      }
      Object.assign(entry, nonZero({ jmc: current, jmp: pending }))
      if (Object.keys(detail).length) entry.jm = detail
    }

    servers[runtime.name] = entry
  }
  return { t: Date.now(), servers }
}

// ------------------------------------------------------- history on disk

/**
 * History outlives this process.
 *
 * The ring buffer above is gone the moment the console is restarted, and a
 * restart is exactly when the last hour matters — "it fell over, I restarted
 * the console, now show me what led up to it". So every sample is also
 * appended to one line-delimited JSON file per AdminServer identity, and a
 * connection to that identity reads the file back on the way up.
 *
 * The file is keyed by host, port and user rather than by connection id, since
 * a connection id is new on every login and the history is not.
 */
function historyFileFor(connection) {
  const digest = createHash('sha1').update(profileKey(connection)).digest('hex').slice(0, 16)
  return path.join(HISTORY_DIR, `${digest}.ndjson`)
}

/** Parses an NDJSON history file, dropping anything older than the cutoff. */
function parseHistory(raw, cutoff) {
  const samples = []
  for (const line of raw.split('\n')) {
    if (!line) continue
    try {
      const sample = JSON.parse(line)
      if (sample?.t > cutoff && sample.servers) samples.push(sample)
    } catch {
      // A line half-written when the process died. Tolerating that is the whole
      // reason this format is one sample per line.
    }
  }
  // Two consoles pointed at the same domain interleave their appends, so the
  // file is not necessarily in order.
  return samples.sort((a, b) => a.t - b.t)
}

async function loadHistory(connection) {
  if (!MAX_SAMPLES || !HISTORY_FILE_MINUTES) return
  try {
    const raw = await readFile(connection.historyFile, 'utf8')
    connection.history = parseHistory(raw, Date.now() - HISTORY_MINUTES * 60_000).slice(-MAX_SAMPLES)
  } catch {
    // No file yet, or an unreadable one: the buffer simply starts empty.
  }
}

/** Drops what the disk window no longer covers, write-then-rename. */
async function compactHistoryFile(connection) {
  try {
    const raw = await readFile(connection.historyFile, 'utf8')
    const kept = parseHistory(raw, Date.now() - HISTORY_FILE_MINUTES * 60_000)
    const tmp = `${connection.historyFile}.tmp`
    await writeFile(tmp, kept.map((sample) => JSON.stringify(sample)).join('\n') + '\n', { mode: 0o600 })
    await rename(tmp, connection.historyFile)
  } catch {
    // Compaction is housekeeping; failing it must not stop sampling.
  }
}

async function persistSample(connection, sample) {
  if (!HISTORY_FILE_MINUTES) return
  try {
    await mkdir(HISTORY_DIR, { recursive: true })
    await appendFile(connection.historyFile, JSON.stringify(sample) + '\n', { mode: 0o600 })
    connection.historyAppends = (connection.historyAppends || 0) + 1
    if (connection.historyAppends % COMPACT_EVERY === 0) await compactHistoryFile(connection)
  } catch (err) {
    // Said once per connection: a full or read-only disk must not write one
    // console line every fifteen seconds.
    if (!connection.historyDiskWarned) {
      connection.historyDiskWarned = true
      console.error(`  Could not write history to ${connection.historyFile}: ${err.message}`)
    }
  }
}

// ------------------------------------------------------------- sampling

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
    const sample = toSample(JSON.parse(upstream.body.toString('utf8')))
    connection.history.push(sample)
    if (connection.history.length > MAX_SAMPLES) {
      connection.history.splice(0, connection.history.length - MAX_SAMPLES)
    }
    connection.historyError = null
    await persistSample(connection, sample)
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
    if (!SAMPLE_ALWAYS && session.lastUsed < cutoff) continue
    for (const connection of session.connections.values()) {
      if (seen.has(connection.id)) continue
      seen.add(connection.id)
      out.push(connection)
    }
  }
  return out
}

/** Every live connection, whether or not its session is still being used. */
function allConnections() {
  const seen = new Map()
  for (const session of sessions.values()) {
    for (const connection of session.connections.values()) seen.set(connection.id, connection)
  }
  return [...seen.values()]
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
    fileRetentionMs: HISTORY_FILE_MINUTES * 60_000,
    depth: SAMPLE_DEPTH,
    /** Whether raising an alert can also reach somebody who is not looking. */
    webhook: Boolean(ALERT_WEBHOOK),
    error: connection.historyError || null,
    samples: connection.history.filter((sample) => sample.t > since),
  })
}

// ------------------------------------------------------------- metrics

/** Prometheus wants label values escaped. */
const escapeLabel = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')

/**
 * The newest sample of every live connection, in Prometheus text format.
 *
 * This console is already asking each AdminServer the one question a scraper
 * would ask, on an interval a scraper would use. Publishing the answer costs
 * one endpoint and saves the site from running a second collector — and it
 * makes the history keepable for far longer than a browser tab, in whatever
 * the site already uses for that.
 */
function renderMetrics() {
  const gauges = {
    wlc_server_up: { help: '1 when the server is RUNNING.', rows: [] },
    wlc_server_healthy: { help: '1 when the server reports health OK.', rows: [] },
    wlc_heap_used_bytes: { help: 'Java heap in use.', rows: [] },
    wlc_heap_max_bytes: { help: 'Java heap maximum (-Xmx).', rows: [] },
    wlc_threads_total: { help: 'Execute threads in the self-tuning pool.', rows: [] },
    wlc_threads_busy: { help: 'Execute threads currently running a request.', rows: [] },
    wlc_threads_stuck: { help: 'Threads past the stuck-thread timeout.', rows: [] },
    wlc_threads_hogging: { help: 'Threads holding on much longer than normal.', rows: [] },
    wlc_queue_length: { help: 'Requests waiting for an execute thread.', rows: [] },
    wlc_pending_requests: { help: 'User requests not yet handed to a thread.', rows: [] },
    wlc_throughput_requests: { help: 'Requests completed per second.', rows: [] },
    wlc_open_sockets: { help: 'Sockets the server currently holds open.', rows: [] },
    wlc_jdbc_active_connections: { help: 'JDBC connections in use.', rows: [] },
    wlc_jdbc_capacity: { help: 'Connections the JDBC pool currently holds.', rows: [] },
    wlc_jdbc_waiting: { help: 'Threads waiting for a JDBC connection.', rows: [] },
    wlc_jta_active_transactions: { help: 'Transactions in flight.', rows: [] },
    wlc_jms_messages_pending: { help: 'JMS messages not yet acknowledged.', rows: [] },
  }
  const counters = {
    wlc_jta_transactions_committed_total: { help: 'Transactions committed since server start.', rows: [] },
    wlc_jta_transactions_rolled_back_total: { help: 'Transactions rolled back since server start.', rows: [] },
    wlc_jdbc_reconnect_failures_total: { help: 'Failures to reconnect since server start.', rows: [] },
  }

  for (const connection of allConnections()) {
    const sample = connection.history[connection.history.length - 1]
    if (!sample) continue
    const domain = escapeLabel(connection.domain?.name || connection.name || connection.host)
    for (const [server, entry] of Object.entries(sample.servers)) {
      const labels = `{domain="${domain}",server="${escapeLabel(server)}"}`
      const push = (bucket, value) => bucket.rows.push(`${labels} ${value}`)
      push(gauges.wlc_server_up, entry.st === 'RUNNING' ? 1 : 0)
      // A server that is down reports that it is down and nothing else. A
      // scraper stores an absent series as a gap and a zero as a measurement,
      // so publishing zeros here would put "heap fell to 0" in somebody's
      // dashboard every time a server was stopped.
      if (entry.tt === undefined && entry.hu === undefined) continue
      push(gauges.wlc_server_healthy, entry.he === 'OK' ? 1 : 0)
      push(gauges.wlc_heap_used_bytes, entry.hu || 0)
      push(gauges.wlc_heap_max_bytes, entry.hm || 0)
      push(gauges.wlc_threads_total, entry.tt || 0)
      push(gauges.wlc_threads_busy, entry.tb || 0)
      push(gauges.wlc_threads_stuck, entry.sk || 0)
      push(gauges.wlc_threads_hogging, entry.hg || 0)
      push(gauges.wlc_queue_length, entry.q || 0)
      push(gauges.wlc_pending_requests, entry.pr || 0)
      push(gauges.wlc_throughput_requests, entry.tp || 0)
      push(gauges.wlc_open_sockets, entry.so || 0)
      push(gauges.wlc_jta_active_transactions, entry.jta || 0)
      push(gauges.wlc_jms_messages_pending, entry.jmp || 0)
      push(counters.wlc_jta_transactions_committed_total, entry.jtc || 0)
      push(counters.wlc_jta_transactions_rolled_back_total, entry.jtr || 0)

      // Per-pool rather than per-server: "which database" is the question a
      // waiting connection raises, and a rollup cannot answer it.
      for (const [name, pool] of Object.entries(entry.ds || {})) {
        const poolLabels = `{domain="${domain}",server="${escapeLabel(server)}",data_source="${escapeLabel(name)}"}`
        gauges.wlc_jdbc_active_connections.rows.push(`${poolLabels} ${pool.a || 0}`)
        gauges.wlc_jdbc_capacity.rows.push(`${poolLabels} ${pool.c || 0}`)
        gauges.wlc_jdbc_waiting.rows.push(`${poolLabels} ${pool.w || 0}`)
        counters.wlc_jdbc_reconnect_failures_total.rows.push(`${poolLabels} ${pool.f || 0}`)
      }
    }
  }

  const lines = []
  for (const [type, bucket] of [
    ['gauge', gauges],
    ['counter', counters],
  ]) {
    for (const [name, metric] of Object.entries(bucket)) {
      if (!metric.rows.length) continue
      lines.push(`# HELP ${name} ${metric.help}`, `# TYPE ${name} ${type}`)
      for (const row of metric.rows) lines.push(name + row)
    }
  }
  return lines.join('\n') + '\n'
}

function handleMetrics(req, res, url) {
  if (!METRICS_ENABLED) {
    return sendError(
      res,
      404,
      'Metrics are not enabled',
      'Start the console with WLC_METRICS=1, or with WLC_METRICS_TOKEN set, to publish them.',
    )
  }
  if (METRICS_TOKEN) {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const given = bearer || url.searchParams.get('token') || ''
    if (given !== METRICS_TOKEN) return sendError(res, 401, 'Invalid metrics token')
  }
  const body = renderMetrics()
  res.writeHead(200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

// ------------------------------------------------------------- webhook

/** When recent forwards happened, so a rule stuck on can be capped. */
let webhookSent = []

/**
 * Alerts reach somebody who is not looking at the browser.
 *
 * The rules themselves stay in the browser — that is where their thresholds
 * are set and where the samples are already being read — so the console posts
 * what they raised here, and this process, which is the half that can reach a
 * chat webhook, forwards it.
 */
async function handleNotify(req, res) {
  const session = sessionFor(req)
  if (!session) return sendError(res, 401, 'Not connected')
  const payload = await readJson(req)
  if (!ALERT_WEBHOOK) return sendJson(res, 200, { forwarded: false, reason: 'not-configured' })

  const now = Date.now()
  webhookSent = webhookSent.filter((at) => at > now - 3_600_000)
  if (webhookSent.length >= WEBHOOK_MAX_PER_HOUR) {
    return sendJson(res, 200, { forwarded: false, reason: 'rate-limited' })
  }
  webhookSent.push(now)

  const title = String(payload.title || '').slice(0, 500)
  const detail = String(payload.detail || '').slice(0, 2000)
  const body = {
    source: 'wl-console',
    severity: String(payload.severity || 'warn'),
    title,
    detail,
    server: String(payload.server || '').slice(0, 200),
    domain: String(payload.domain || '').slice(0, 200),
    at: now,
    // A chat webhook that reads nothing else almost always reads `text`.
    text: [title, detail].filter(Boolean).join(' — ').slice(0, 2000),
  }

  try {
    const upstream = await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    return sendJson(res, 200, { forwarded: upstream.ok, status: upstream.status })
  } catch (err) {
    // The alert is already on screen; the forward failing is worth reporting
    // but not worth failing the request over.
    return sendJson(res, 200, { forwarded: false, reason: err?.message || 'unreachable' })
  }
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
  connection.historyFile = historyFileFor(connection)

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

  connection.permissions = await probePermissions(connection)

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

  // Whatever this console already recorded about this AdminServer, from before
  // the last restart. Awaited rather than left running: the browser polls for
  // history immediately after connecting, and an empty first answer would tell
  // it there is none.
  await loadHistory(connection)

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

  if (upstream.status === 403) {
    // The probe at connect can go out of date — a role can change, and some
    // MBeans are protected on their own — so a refusal here updates what the
    // console believes about this user.
    if (restPath.startsWith('/edit')) connection.permissions = { configure: false, known: true }
    // WebLogic answers 403 with an HTML page as often as with JSON, and an HTML
    // body reaches the browser as an unreadable error. Anything that is not
    // JSON is rewritten as the console's own error shape.
    const text = upstream.body.toString('utf8').trim()
    if (!text.startsWith('{')) {
      const detail = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
      return sendError(
        res,
        403,
        'Not authorized for this operation',
        detail || `The AdminServer refused this request for ${connection.username}.`,
      )
    }
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
    if (pathname === '/api/notify' && method === 'POST') return await handleNotify(req, res)
    if (pathname === '/metrics' && method === 'GET') return handleMetrics(req, res, url)
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
      ? `  Sampling runtime every ${SAMPLE_MS / 1000}s (${SAMPLE_DEPTH}), keeping ${HISTORY_MINUTES} minutes in memory` +
          (HISTORY_FILE_MINUTES ? ` and ${HISTORY_FILE_MINUTES} minutes in ${HISTORY_DIR}` : ', nothing on disk')
      : '  Runtime sampling is off (WLC_SAMPLE_MS=0) — charts stay empty',
  )
  if (SAMPLE_MS && SAMPLE_ALWAYS) console.log('  Sampling continues even when no browser is using the session')
  if (METRICS_ENABLED) {
    console.log(`  Publishing Prometheus metrics on http://${HOST}:${PORT}/metrics${METRICS_TOKEN ? ' (token required)' : ''}`)
  }
  if (ALERT_WEBHOOK) console.log(`  Forwarding alerts to ${ALERT_WEBHOOK} (max ${WEBHOOK_MAX_PER_HOUR}/hour)`)
  startSampler()
  console.log('  Open that address in a browser and connect to an AdminServer.\n')
})
