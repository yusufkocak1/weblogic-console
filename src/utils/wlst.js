/**
 * The same operation, written out as WLST and as curl.
 *
 * Changing a production domain from a web page is a step some teams will not
 * take on trust, and a change made through a console leaves no script behind to
 * review or to replay on the next environment. So every operation this console
 * performs can also show what it would look like from wlst.sh or from a shell —
 * to copy into a runbook, to paste into a change record, or simply to check
 * that the console is about to do what you think it is.
 *
 * The curl form is exact: it is the request the console itself sends. The WLST
 * form is a faithful translation, but WLST names a few singleton MBeans
 * differently from the REST tree, so it carries a header saying to check the
 * paths before running it on a domain that matters.
 */

/** WLST spells collections with a capital; REST does not always agree. */
const WLST_COLLECTIONS = {
  servers: 'Servers',
  clusters: 'Clusters',
  machines: 'Machines',
  appDeployments: 'AppDeployments',
  libraries: 'Libraries',
  JDBCSystemResources: 'JDBCSystemResources',
  JMSServers: 'JMSServers',
  securityConfiguration: 'SecurityConfiguration',
}

/**
 * Singleton children are addressed in WLST by repeating their parent's name:
 * a server's SSL MBean is /Servers/ms1/SSL/ms1, not /Servers/ms1/SSL.
 */
const WLST_SINGLETONS = {
  SSL: 'SSL',
  log: 'Log',
  serverStart: 'ServerStart',
  webServer: 'WebServer',
  JDBCResource: 'JDBCResource',
}

/** Children of JDBCResource are singletons with a generated name. */
const JDBC_PARAMS = new Set([
  'JDBCConnectionPoolParams',
  'JDBCDataSourceParams',
  'JDBCDriverParams',
  'JDBCXAParams',
  'JDBCOracleParams',
])

/**
 * Converts an edit-tree REST path into the WLST path for the same MBean.
 *
 * @param {string} restPath e.g. /edit/servers/ms1/SSL
 * @param {{domain?: string}} context the domain name, needed for /edit itself
 */
export function wlstPath(restPath, { domain = 'domain' } = {}) {
  const parts = String(restPath || '')
    .replace(/^\/edit\/?/, '')
    .split('/')
    .filter(Boolean)

  if (!parts.length) return '/'

  const out = []
  let lastName = domain

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const collection = WLST_COLLECTIONS[part]
    if (collection && parts[i + 1]) {
      lastName = decodeURIComponent(parts[i + 1])
      out.push(collection, lastName)
      i++
      continue
    }
    if (WLST_SINGLETONS[part]) {
      out.push(WLST_SINGLETONS[part], lastName)
      continue
    }
    if (JDBC_PARAMS.has(part)) {
      // Generated name: WebLogic calls the first (and only) one NO_NAME_0.
      out.push(part, 'NO_NAME_0')
      continue
    }
    out.push(part.charAt(0).toUpperCase() + part.slice(1))
    // A bare singleton such as /edit/log belongs to the domain itself.
    if (i === parts.length - 1) out.push(lastName)
  }

  return '/' + out.join('/')
}

/** Python literals, since that is what WLST speaks. */
function pythonValue(value) {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "\\'")}'`
}

const setter = (attribute) => `set${attribute.charAt(0).toUpperCase()}${attribute.slice(1)}`

const connectLine = ({ username = 'weblogic', baseUrl = 'http://localhost:7001' } = {}) => {
  // WLST connects over t3, and t3 shares the listen port with HTTP.
  const address = String(baseUrl).replace(/^https:\/\//, 't3s://').replace(/^http:\/\//, 't3://')
  return `connect('${username}', '<password>', '${address}')`
}

const HEADER = [
  '# Equivalent WLST for what this screen is about to do.',
  '# Check the MBean paths against your domain before running it on anything',
  '# that matters: WLST names a few singleton MBeans differently from REST.',
]

/**
 * A staged configuration change: lock, write, activate — the same three steps
 * the console performs.
 *
 * @param {{path: string, attributes: object}[]} edits
 */
export function wlstForEdits(edits, context = {}) {
  const lines = [...HEADER, '', connectLine(context), 'edit()', 'startEdit()', '']
  for (const edit of edits) {
    lines.push(`cd('${wlstPath(edit.path, context)}')`)
    for (const [attribute, value] of Object.entries(edit.attributes || {})) {
      lines.push(`cmo.${setter(attribute)}(${pythonValue(value)})`)
    }
    lines.push('')
  }
  lines.push('activate()')
  return lines.join('\n')
}

/** start / shutdown / suspend / resume of one server. */
export function wlstForServerAction(server, action, context = {}) {
  const lines = [...HEADER, '', connectLine(context), '']
  switch (action) {
    case 'start':
      lines.push(`start('${server}', 'Server')`)
      break
    case 'shutdown':
      lines.push(`shutdown('${server}', 'Server', ignoreSessions='false')`)
      break
    case 'forceShutdown':
      lines.push(`shutdown('${server}', 'Server', force='true', ignoreSessions='true')`)
      break
    case 'suspend':
      lines.push(`suspend('${server}', 'Server')`)
      break
    case 'resume':
      lines.push(`resume('${server}', 'Server')`)
      break
    default:
      lines.push(`# ${action} has no direct WLST equivalent; use the REST call below.`)
  }
  return lines.join('\n')
}

export function wlstForDeploymentAction(app, action, targets = [], context = {}) {
  const list = targets.length ? `, targets='${targets.join(',')}'` : ''
  const command = action === 'start' ? 'startApplication' : 'stopApplication'
  return [...HEADER, '', connectLine(context), '', `${command}('${app}'${list})`].join('\n')
}

export function wlstForDeploy({ name, path, targets = [], stagingMode, plan }, context = {}) {
  const args = [`'${name}'`, `'${path || '/path/to/archive'}'`]
  if (targets.length) args.push(`targets='${targets.join(',')}'`)
  if (stagingMode) args.push(`stageMode='${stagingMode}'`)
  if (plan) args.push(`planPath='${plan}'`)
  return [...HEADER, '', connectLine(context), '', `deploy(${args.join(', ')})`].join('\n')
}

export function wlstForUndeploy(name, targets = [], context = {}) {
  const list = targets.length ? `, targets='${targets.join(',')}'` : ''
  return [...HEADER, '', connectLine(context), '', `undeploy('${name}'${list})`].join('\n')
}

/**
 * Re-targeting. WLST has no "replace the target list" call, so this is written
 * as the assignment the operator would actually run.
 *
 * @param {string} type e.g. 'AppDeployment', 'JDBCSystemResource'
 */
export function wlstForTargets(type, name, targets, context = {}) {
  const lines = [...HEADER, '', connectLine(context), 'edit()', 'startEdit()', '']
  if (!targets.length) lines.push(`# No targets selected — the resource would be deployed nowhere.`)
  for (const target of targets) {
    lines.push(`assign('${type}', '${name}', 'Target', '${target}')`)
  }
  lines.push('', 'activate()')
  return lines.join('\n')
}

// ------------------------------------------------------------------------ curl

const REST_BASE = '/management/weblogic/latest'

function curlCommand({ method = 'GET', path, body, baseUrl = 'http://localhost:7001', username = 'weblogic' }) {
  const lines = [
    `curl -u ${username}:'<password>' \\`,
    `  -H 'X-Requested-By: wl-console' \\`,
    ...(body === undefined ? [] : [`  -H 'Content-Type: application/json' \\`]),
    `  -X ${method} '${baseUrl}${REST_BASE}${path}'${body === undefined ? '' : ' \\'}`,
  ]
  if (body !== undefined) lines.push(`  -d '${JSON.stringify(body)}'`)
  return lines.join('\n')
}

/** The staged-change protocol, as three shell commands. */
export function curlForEdits(edits, context = {}) {
  const calls = [
    curlCommand({ ...context, method: 'POST', path: '/edit/changeManager/startEdit', body: {} }),
    ...edits.map((edit) => curlCommand({ ...context, method: 'POST', path: edit.path, body: edit.attributes })),
    curlCommand({ ...context, method: 'POST', path: '/edit/changeManager/activateChanges', body: {} }),
  ]
  return ['# The request the console sends, step by step.', '', calls.join('\n\n')].join('\n')
}

export function curlFor(method, path, body, context = {}) {
  return curlCommand({ ...context, method, path, body })
}

export function curlForServerAction(server, action, context = {}) {
  return curlFor('POST', `/domainRuntime/serverLifeCycleRuntimes/${encodeURIComponent(server)}/${action}`, {}, context)
}

export function curlForDeploymentAction(app, action, targets = [], context = {}) {
  return curlFor(
    'POST',
    `/domainRuntime/deploymentManager/appDeploymentRuntimes/${encodeURIComponent(app)}/${action}`,
    targets.length ? { targets } : {},
    context,
  )
}

/** Multipart is awkward to show as a body, so the parts are spelled out. */
export function curlForDeploy({ name, path, targets = [], stagingMode }, context = {}) {
  const model = { name, targets: targets.map((target) => ({ identity: target.split('/') })), stagingMode }
  return [
    '# Deploying uploads the archive as multipart form data.',
    `curl -u ${context.username || 'weblogic'}:'<password>' \\`,
    `  -H 'X-Requested-By: wl-console' \\`,
    `  -F "model=${JSON.stringify(model)};type=application/json" \\`,
    `  -F "deployment=@${path || '/path/to/archive.war'}" \\`,
    `  -X POST '${context.baseUrl || 'http://localhost:7001'}${REST_BASE}/edit/appDeployments'`,
  ].join('\n')
}
