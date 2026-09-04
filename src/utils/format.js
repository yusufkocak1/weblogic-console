const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function bytes(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  let v = Number(n)
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`
}

export function num(n) {
  if (n === null || n === undefined || n === '') return '—'
  const v = Number(n)
  return Number.isNaN(v) ? String(n) : v.toLocaleString()
}

/** WebLogic reports uptime and activation times as epoch millis. */
export function duration(ms) {
  if (!ms && ms !== 0) return '—'
  const s = Math.floor(Number(ms) / 1000)
  if (s < 60) return `${s}s`
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

export function since(epochMs) {
  if (!epochMs) return '—'
  return duration(Date.now() - Number(epochMs))
}

export function datetime(epochMs) {
  if (!epochMs) return '—'
  const d = new Date(Number(epochMs))
  if (Number.isNaN(d.getTime())) return String(epochMs)
  return d.toLocaleString()
}

export function percent(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(digits)}%`
}

/**
 * Targets come back as [{identity: ['servers','ms1']}, ...] or as plain strings
 * depending on the MBean, so both shapes are flattened to names here.
 */
export function targetNames(targets) {
  if (!targets) return []
  const list = Array.isArray(targets) ? targets : [targets]
  return list
    .map((t) => {
      if (typeof t === 'string') return t
      if (Array.isArray(t?.identity)) return t.identity[t.identity.length - 1]
      return t?.name ?? null
    })
    .filter(Boolean)
}

/**
 * A versioned deployment is called `myapp#V1` by its configuration MBean but
 * `myapp` by ApplicationRuntime.applicationName, so names have to be compared
 * without the version before deciding an application is not running.
 */
export function baseAppName(name) {
  const value = String(name ?? '')
  const hash = value.indexOf('#')
  return hash === -1 ? value : value.slice(0, hash)
}

/** The version of a versioned deployment name, or '' when it carries none. */
export function appVersion(name) {
  const value = String(name ?? '')
  const hash = value.indexOf('#')
  return hash === -1 ? '' : value.slice(hash + 1)
}

/**
 * Whether an ApplicationRuntime belongs to the configured deployment `name`.
 *
 * Versioned deployments are why this cannot be a plain name comparison: every
 * version of `myapp` reports `applicationName: 'myapp'`, so matching on the
 * version-less name lets a retired version borrow the active version's runtimes
 * and report itself as running. A versioned deployment therefore only matches a
 * runtime carrying the same version; an unversioned one still matches loosely,
 * because an archive can pick up a version from its manifest that the
 * configuration name does not show.
 */
export function isDeploymentRuntime(name, app) {
  if (!app) return false
  const candidates = [app.name, app.applicationName].filter(Boolean)
  const version = appVersion(name)
  if (version) {
    const runtimeVersion = app.applicationVersion || appVersion(app.name)
    if (runtimeVersion !== version) return false
    return candidates.some((candidate) => baseAppName(candidate) === baseAppName(name))
  }
  return candidates.some((candidate) => candidate === name || baseAppName(candidate) === name)
}

/** ServerRuntime healthState is an object in recent releases, a string in older ones. */
export function healthOf(health) {
  if (!health) return 'UNKNOWN'
  const raw = typeof health === 'string' ? health : (health.state ?? health.symptoms?.state ?? 'UNKNOWN')
  return String(raw).replace(/^HEALTH_/, '').toUpperCase()
}

/**
 * WebLogic collections come back as {items: [...]}, singletons as bare objects.
 * Normalising here keeps every view from repeating the same guard.
 */
export function items(node) {
  if (Array.isArray(node)) return node
  if (Array.isArray(node?.items)) return node.items
  return []
}
