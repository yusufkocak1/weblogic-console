/**
 * Turns whatever an operator has to hand into host / port / SSL.
 *
 * WebLogic addresses are usually copied from a WLST script or a JNDI provider
 * URL, so they arrive as `t3://host:7001` rather than a bare hostname. T3 and
 * HTTP are multiplexed on the same listen port, so the port carries straight
 * over to REST — only the scheme has to go.
 */

const SECURE_SCHEMES = new Set(['t3s', 'https', 'iiops', 'ldaps', 'wss'])
const KNOWN_SCHEMES = new Set([...SECURE_SCHEMES, 't3', 'http', 'iiop', 'ldap', 'ws'])

/**
 * @returns {{host: string, port?: number, ssl?: boolean} | null}
 *   `port` and `ssl` are only present when the input actually stated them, so
 *   callers can leave their current values alone otherwise.
 */
export function parseTarget(input) {
  let rest = String(input ?? '').trim()
  if (!rest) return null

  const result = {}

  // Hand-written notes sometimes put the user before the scheme; the scheme has
  // to be found first, so drop that here rather than with the in-URL form below.
  rest = rest.replace(/^[^@/:]+@(?=[a-z][a-z0-9+.-]*:\/\/)/i, '')

  const scheme = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i)
  if (scheme) {
    const name = scheme[1].toLowerCase()
    // Only infer SSL from a scheme we recognise; anything else is left alone.
    if (KNOWN_SCHEMES.has(name)) result.ssl = SECURE_SCHEMES.has(name)
    rest = rest.slice(scheme[0].length)
  }

  // A t3 URL may list every cluster member: t3://ms1:7001,ms2:7001
  rest = rest.split(',')[0]
  // Drop any path, query or fragment.
  rest = rest.split(/[/?#]/)[0]
  // Drop credentials if the URL carried them.
  const at = rest.lastIndexOf('@')
  if (at >= 0) rest = rest.slice(at + 1)
  if (!rest) return null

  const bracketed = rest.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (bracketed) {
    result.host = bracketed[1]
    if (bracketed[2]) result.port = Number(bracketed[2])
    return result
  }

  const parts = rest.split(':')
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    result.host = parts[0]
    result.port = Number(parts[1])
  } else if (parts.length > 2) {
    // Bare IPv6 with no brackets — there is no port to separate out.
    result.host = rest
  } else {
    result.host = parts[0]
  }

  return result.host ? result : null
}
