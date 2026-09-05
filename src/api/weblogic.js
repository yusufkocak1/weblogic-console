import { del, get, post, postForm, search } from './client'
import { items } from '@/utils/format'

const SERVER_RUNTIME_FIELDS = [
  'name',
  'state',
  'healthState',
  'weblogicVersion',
  'listenAddress',
  'listenPort',
  'sslListenPort',
  'adminServer',
  'activationTime',
  'openSocketsCurrentCount',
]

const JVM_FIELDS = [
  'heapSizeCurrent',
  'heapFreeCurrent',
  'heapSizeMax',
  'heapFreePercent',
  'uptime',
  'javaVersion',
  'javaVendor',
  'OSName',
]

const THREAD_POOL_FIELDS = [
  'executeThreadTotalCount',
  'executeThreadIdleCount',
  'hoggingThreadCount',
  'standbyThreadCount',
  'stuckThreadCount',
  'pendingUserRequestCount',
  'queueLength',
  'throughput',
  'healthState',
]

/** Cheapest authenticated call there is — used to validate credentials at login. */
export function domainSummary(options) {
  return get(
    '/domainConfig',
    { links: 'none', fields: 'name,configurationVersion,productionModeEnabled,rootDirectory,adminServerName' },
    options,
  )
}

/**
 * Everything the dashboard and monitoring pages need, in one request:
 * servers plus their JVM and thread pool runtimes.
 */
export function runtimeSnapshot(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: SERVER_RUNTIME_FIELDS,
          children: {
            JVMRuntime: { links: [], fields: JVM_FIELDS },
            threadPoolRuntime: { links: [], fields: THREAD_POOL_FIELDS },
          },
        },
        serverLifeCycleRuntimes: { links: [], fields: ['name', 'state'] },
      },
    },
    options,
  )
}

export function configuredServers(options) {
  return get(
    '/domainConfig/servers',
    {
      links: 'none',
      fields: 'name,listenAddress,listenPort,sslListenPort,cluster,machine,listenPortEnabled',
    },
    options,
  )
}

export function serverLifeCycles(options) {
  return get('/domainRuntime/serverLifeCycleRuntimes', { links: 'none', fields: 'name,state' }, options)
}

/** action is one of: start, shutdown, forceShutdown, suspend, resume, restart. */
export function serverAction(server, action, body, options) {
  return post(`/domainRuntime/serverLifeCycleRuntimes/${encodeURIComponent(server)}/${action}`, body ?? {}, options)
}

export function clusters(options) {
  return get(
    '/domainConfig/clusters',
    { links: 'none', fields: 'name,clusterMessagingMode,clusterAddress,servers,multicastAddress,multicastPort' },
    options,
  )
}

export function clusterRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name'],
          children: {
            clusterRuntime: {
              links: [],
              fields: [
                'name',
                'aliveServerCount',
                'primaryCount',
                'secondaryCount',
                'resendRequestsCount',
                'serverNames',
              ],
            },
          },
        },
      },
    },
    options,
  )
}

export function appDeployments(options) {
  return get(
    '/domainConfig/appDeployments',
    { links: 'none', fields: 'name,sourcePath,targets,stagingMode,moduleType,deploymentOrder,absoluteSourcePath' },
    options,
  )
}

export function libraries(options) {
  return get(
    '/domainConfig/libraries',
    { links: 'none', fields: 'name,sourcePath,targets,specificationVersion,implementationVersion' },
    options,
  )
}

/** Per-server view of an application: this is where health and real state live. */
export function applicationRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name'],
          children: {
            applicationRuntimes: {
              links: [],
              fields: ['name', 'applicationName', 'healthState', 'applicationVersion'],
            },
          },
        },
      },
    },
    options,
  )
}

/**
 * The state the classic console shows for a deployment — ACTIVE, ADMIN,
 * PREPARED, NEW, FAILED, RETIRED — only exists behind actions, not attributes.
 * The one that answers without knowing a target is the domain-wide
 * AppRuntimeStateRuntime: its intended state is also the only place a retired
 * version is actually called RETIRED.
 */
export function deploymentIntendedState(app, options) {
  return post('/domainRuntime/appRuntimeStateRuntime/getIntendedState', { appid: app }, options)
}

/**
 * Per-target state from the deployment runtime. The REST action rejects a call
 * without a target, so one has to be supplied from the deployment's
 * configuration — asking with an empty body only ever produces a 400.
 */
export function deploymentState(app, target, options) {
  return post(
    `/domainRuntime/deploymentManager/appDeploymentRuntimes/${encodeURIComponent(app)}/getState`,
    target ? { target } : {},
    options,
  )
}

/**
 * The runtime side answers with the AppRuntimeStateRuntime constants —
 * `STATE_ACTIVE`, `STATE_RETIRED`, `STATE_PREPARED` and so on — while the rest
 * of the console works in the bare names the console shows. Stripping the
 * prefix is what makes a retired deployment read as RETIRED instead of falling
 * through as a state nothing recognises.
 */
export function normaliseDeploymentState(value) {
  if (typeof value !== 'string') return null
  return value.trim().toUpperCase().replace(/^STATE_/, '') || null
}

/**
 * Resolves the state of many applications, a few requests at a time.
 *
 * Takes `[{name, targets}]` (bare names work too) and probes per application,
 * first answer wins:
 *  1. getIntendedState — needs no target and knows about retirement;
 *  2. the deployment runtime's getState, once per configured target, because
 *     that action does not answer without one.
 */
export async function deploymentStates(apps, options) {
  const queue = apps.map((app) => (typeof app === 'string' ? { name: app, targets: [] } : app))
  const states = new Map()
  // A release too old to expose appRuntimeStateRuntime is too old for every
  // application at once — remembered so it is not rediscovered N times.
  let hasIntendedState = true

  const stateFrom = (response) => normaliseDeploymentState(response?.return ?? response)
  // An abort or a dead session concerns every call, not just the current one.
  const rethrowFatal = (err) => {
    if (err?.name === 'AbortError' || err?.isAuthError) throw err
  }

  async function resolve({ name, targets }) {
    if (hasIntendedState) {
      try {
        const state = stateFrom(await deploymentIntendedState(name, options))
        if (state) return state
      } catch (err) {
        rethrowFatal(err)
        if (err?.status === 404) hasIntendedState = false
      }
    }
    for (const target of targets?.length ? targets : [undefined]) {
      try {
        const state = stateFrom(await deploymentState(name, target, options))
        if (state) return state
      } catch (err) {
        rethrowFatal(err)
      }
    }
    // No answer at all: the caller falls back to the per-server application
    // runtimes it already has.
    return null
  }

  async function worker() {
    while (queue.length) {
      const app = queue.shift()
      if (!app?.name) continue
      const state = await resolve(app)
      if (state) states.set(app.name, state)
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker))
  return states
}

/**
 * action is 'start' or 'stop'; targets restricts the operation to given servers.
 * The overload that takes targets also declares deploymentOptions, and the REST
 * layer matches an action by its full parameter set, so both have to be sent.
 */
export function deploymentAction(app, action, targets, options) {
  const body = targets?.length ? { targets, deploymentOptions: {} } : {}
  return post(
    `/domainRuntime/deploymentManager/appDeploymentRuntimes/${encodeURIComponent(app)}/${action}`,
    body,
    options,
  )
}

export function dataSourceConfigs(options) {
  return search(
    'domainConfig',
    {
      links: [],
      fields: [],
      children: {
        JDBCSystemResources: {
          links: [],
          fields: ['name', 'targets'],
          children: {
            JDBCResource: {
              links: [],
              fields: ['name'],
              children: {
                JDBCDriverParams: { links: [], fields: ['url', 'driverName'] },
                JDBCDataSourceParams: { links: [], fields: ['JNDINames', 'globalTransactionsProtocol'] },
                JDBCConnectionPoolParams: {
                  links: [],
                  fields: ['initialCapacity', 'maxCapacity', 'minCapacity', 'testTableName', 'testConnectionsOnReserve'],
                },
              },
            },
          },
        },
      },
    },
    options,
  )
}

export function dataSourceRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name'],
          children: {
            JDBCServiceRuntime: {
              links: [],
              fields: [],
              children: {
                JDBCDataSourceRuntimeMBeans: {
                  links: [],
                  fields: [
                    'name',
                    'state',
                    'enabled',
                    'activeConnectionsCurrentCount',
                    'activeConnectionsHighCount',
                    'currCapacity',
                    'waitingForConnectionCurrentCount',
                    'waitingForConnectionTotal',
                    'connectionsTotalCount',
                    'failuresToReconnectCount',
                    'connectionDelayTime',
                  ],
                },
              },
            },
          },
        },
      },
    },
    options,
  )
}

export function testDataSource(server, dataSource, options) {
  const path =
    `/domainRuntime/serverRuntimes/${encodeURIComponent(server)}` +
    `/JDBCServiceRuntime/JDBCDataSourceRuntimeMBeans/${encodeURIComponent(dataSource)}/testPool`
  return post(path, {}, options)
}

export function jmsRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name'],
          children: {
            JMSRuntime: {
              links: [],
              fields: ['health'],
              children: {
                JMSServers: {
                  links: [],
                  fields: [
                    'name',
                    'healthState',
                    'messagesCurrentCount',
                    'messagesPendingCount',
                    'messagesHighCount',
                    'messagesReceivedCount',
                    'bytesCurrentCount',
                    'destinationsCurrentCount',
                  ],
                  children: {
                    destinations: {
                      links: [],
                      fields: [
                        'name',
                        'messagesCurrentCount',
                        'messagesPendingCount',
                        'messagesHighCount',
                        'consumersCurrentCount',
                        'bytesCurrentCount',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    options,
  )
}

const logBase = (server, log) =>
  `/domainRuntime/serverRuntimes/${encodeURIComponent(server)}` +
  `/WLDFRuntime/WLDFAccessRuntime/WLDFDataAccessRuntimes/${encodeURIComponent(log)}`

/**
 * Log retrieval goes through the WLDF data accessor. Recent releases expose a
 * one-shot `search` action; older ones only have the cursor protocol, so we fall
 * back to openCursor/fetch/closeCursor when `search` is not available.
 *
 * Pass an absolute window as `startTime`/`endTime`, or a relative one as
 * `sinceMs`. Whatever the accessor does with the bounds, the rows that come
 * back are trimmed to the window here, so the window on screen is the window
 * in the results.
 */
export async function fetchLog(server, options = {}, requestOptions) {
  const { log = 'ServerLog', query = '', limit = 200, sinceMs = 3600000 } = options
  const endTime = Number(options.endTime) || Date.now()
  const startTime = Number(options.startTime) || endTime - sinceMs
  const wanted = Math.max(1, Math.min(Number(limit) || 200, 2000))

  let rows
  try {
    const res = await post(
      `${logBase(server, log)}/search`,
      // beginTimestamp/endTimestamp are the accessor operation's own parameter
      // names; startTime/endTime are what the newer search action documents.
      // Sending both means the window is applied whichever pair the release
      // reads, and a release strict enough to reject the extras answers 400 -
      // which drops us onto the cursor protocol below, where the names are not
      // in doubt.
      {
        query,
        startTime,
        endTime,
        beginTimestamp: startTime,
        endTimestamp: endTime,
        limit: wanted,
      },
      requestOptions,
    )
    rows = normalizeLogRows(res?.return ?? res?.records ?? res)
  } catch (err) {
    if (![400, 404, 405, 500].includes(err?.status)) throw err
    rows = await fetchLogViaCursor(server, { log, query, limit: wanted, startTime, endTime }, requestOptions)
  }
  return clampLogRows(rows, { startTime, endTime, limit: wanted })
}

/** A cursor can hand back far more than was asked for; this is the stop. */
const CURSOR_CHUNK_LIMIT = 50
const CURSOR_ROW_LIMIT = 10_000

async function fetchLogViaCursor(server, { log, query, limit, startTime, endTime }, requestOptions) {
  const base = logBase(server, log)
  const opened = await post(
    `${base}/openCursor`,
    { beginTimestamp: startTime, endTimestamp: endTime, query },
    requestOptions,
  )
  const cursor = opened?.return ?? opened
  if (!cursor || typeof cursor !== 'string') return []
  const rows = []
  const ceiling = Math.min(Math.max(limit * 5, limit), CURSOR_ROW_LIMIT)
  try {
    // fetch() streams one chunk per call and returns an empty array once
    // drained. The cursor runs oldest-first, so stopping at `limit` would keep
    // the oldest records and throw away the newest - the opposite of what the
    // limit is for. Drain further and let clampLogRows keep the newest.
    for (let i = 0; i < CURSOR_CHUNK_LIMIT && rows.length < ceiling; i++) {
      const chunk = await post(`${base}/fetch`, { cursor }, requestOptions)
      const items = chunk?.return ?? []
      if (!items.length) break
      rows.push(...items)
    }
  } finally {
    await post(`${base}/closeCursor`, { cursor }, requestOptions).catch(() => {})
  }
  return normalizeLogRows(rows)
}

/**
 * Trims a result set to the window that was asked for and to the newest
 * `limit` records, in chronological order.
 *
 * Records whose timestamp could not be read are kept: a timestamp this code
 * cannot parse is a reason to show the line, not to hide it.
 */
function clampLogRows(rows, { startTime, endTime, limit }) {
  const inWindow = rows.filter(
    (row) => row.timestamp === null || (row.timestamp >= startTime && row.timestamp <= endTime),
  )
  inWindow.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  return inWindow.length > limit ? inWindow.slice(inWindow.length - limit) : inWindow
}

/**
 * TIMESTAMP is epoch milliseconds on most releases, but the REST layer can hand
 * it back as a string of digits, as seconds, or as an ISO-8601 date. Number()
 * turns the ISO form into NaN, which is how a record ends up shown as "Invalid
 * Date" and sorted as though it happened in 1970, so every shape is read here.
 *
 * @returns {number|null} epoch milliseconds, or null if it cannot be read
 */
function toEpochMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+$/.test(text)) {
    // Ten digits or fewer is a seconds-since-epoch stamp, not milliseconds.
    const n = Number(text)
    return Number.isFinite(n) ? (text.length <= 10 ? n * 1000 : n) : null
  }
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

/** WLDF returns upper-case column names; older builds use camelCase. */
function normalizeLogRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row, index) => {
    if (typeof row === 'string') return { id: index, timestamp: null, message: row, raw: row }
    return {
      id: row.RECORDID ?? row.recordId ?? index,
      timestamp: toEpochMs(row.TIMESTAMP ?? row.timestamp ?? null),
      severity: String(row.SEVERITY ?? row.severity ?? '').toUpperCase(),
      subsystem: row.SUBSYSTEM ?? row.subsystem ?? '',
      machine: row.MACHINE ?? row.machine ?? '',
      server: row.SERVER ?? row.server ?? '',
      messageId: row.MSGID ?? row.messageId ?? '',
      message: row.MESSAGE ?? row.message ?? '',
      raw: row,
    }
  })
}

export function availableLogs(server, requestOptions) {
  const path =
    `/domainRuntime/serverRuntimes/${encodeURIComponent(server)}` +
    `/WLDFRuntime/WLDFAccessRuntime/WLDFDataAccessRuntimes`
  return get(path, { links: 'none', fields: 'name' }, requestOptions)
}

// --- transactions and work managers -----------------------------------------

/**
 * JTA and work manager runtime for every running server.
 *
 * No `fields` filter here: these MBeans gained and lost attributes between
 * releases, and naming one a release does not have fails the whole search.
 * They are small, so fetching them whole is the safe trade.
 */
export function transactionRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name', 'state'],
          children: {
            JTARuntime: { links: [] },
            workManagerRuntimes: { links: [] },
          },
        },
      },
    },
    options,
  )
}

// --- messaging infrastructure ------------------------------------------------

/**
 * What JMS runs on: the stores that hold persistent messages, the SAF agents
 * that forward them between domains, and the bridges that link them to other
 * providers. Fetched separately from the JMS counters so an older release that
 * lacks one of these trees still renders the rest of the page.
 */
export function messagingRuntimes(options) {
  return search(
    'domainRuntime',
    {
      links: [],
      fields: [],
      children: {
        serverRuntimes: {
          links: [],
          fields: ['name'],
          children: {
            persistentStoreRuntimes: { links: [] },
            SAFRuntime: { links: [], children: { agents: { links: [] } } },
            messagingBridgeRuntimes: { links: [] },
          },
        },
      },
    },
    options,
  )
}

// --- deployment --------------------------------------------------------------

/**
 * Installs a new application. WebLogic takes the archive as multipart form
 * data: a `model` part naming and targeting the deployment, a `deployment`
 * part holding the file, and optionally a `plan` part.
 *
 * The upload lands in the pending configuration like any other edit, so the
 * caller still has to activate it.
 */
export function deployApplication(formData, options) {
  return postForm('/edit/appDeployments', formData, options)
}

/** Replaces the archive of a deployment that already exists. */
export function redeployApplication(name, formData, options) {
  return postForm(`/edit/appDeployments/${encodeURIComponent(name)}`, formData, options)
}

/** Removes the deployment from the domain configuration entirely. */
export function undeployApplication(name, options) {
  return del(`/edit/appDeployments/${encodeURIComponent(name)}`, options)
}

/** The same three operations for a shared library. */
export function deployLibrary(formData, options) {
  return postForm('/edit/libraries', formData, options)
}

export function undeployLibrary(name, options) {
  return del(`/edit/libraries/${encodeURIComponent(name)}`, options)
}

/**
 * Builds the multipart body WebLogic expects.
 *
 * @param {{file: File, model: object, plan?: File}} parts
 */
export function deploymentForm({ file, model, plan }) {
  const form = new FormData()
  // The model part must be typed as JSON or WebLogic reads it as a plain file.
  form.append('model', new Blob([JSON.stringify(model)], { type: 'application/json' }))
  if (file) form.append('deployment', file, file.name)
  if (plan) form.append('plan', plan, plan.name)
  return form
}

// --- targeting ---------------------------------------------------------------

/** The servers and clusters a resource can be targeted to. */
export function targetChoices(options) {
  return Promise.all([
    get('/domainConfig/servers', { links: 'none', fields: 'name,cluster' }, options),
    get('/domainConfig/clusters', { links: 'none', fields: 'name' }, options),
  ]).then(([servers, clusters]) => ({ servers, clusters }))
}

// --- security realm ----------------------------------------------------------

/** The realm in force, and the providers it authenticates against. */
export async function securityRealm(options) {
  const configuration = await get('/edit/securityConfiguration', { links: 'none' }, options)
  const identity = configuration?.defaultRealm?.identity || configuration?.defaultRealm
  const realm = Array.isArray(identity) ? identity[identity.length - 1] : String(identity || 'myrealm')
  const providers = await get(
    `/edit/securityConfiguration/realms/${encodeURIComponent(realm)}/authenticationProviders`,
    { links: 'none', fields: 'name,description,controlFlag,type' },
    options,
  ).catch(() => null)
  return { realm, configuration, providers }
}

/**
 * Users or groups from one authentication provider.
 *
 * Releases disagree about how these are exposed: newer ones have them as a
 * collection, older ones only as a `listUsers` / `listGroups` action. Both are
 * tried, and `null` means this release exposes neither — which the page says
 * plainly rather than showing an empty table that looks like "no users".
 */
export async function realmPrincipals(realm, provider, kind, options) {
  const base =
    `/edit/securityConfiguration/realms/${encodeURIComponent(realm)}` +
    `/authenticationProviders/${encodeURIComponent(provider)}`
  const collection = kind === 'users' ? 'users' : 'groups'

  try {
    const result = await get(`${base}/${collection}`, { links: 'none' }, options)
    return normalisePrincipals(result)
  } catch (err) {
    if (err?.name === 'AbortError' || err?.isAuthError) throw err
  }

  try {
    const action = kind === 'users' ? 'listUsers' : 'listGroups'
    const result = await post(`${base}/${action}`, { filter: '*', maxToReturn: 1000 }, options)
    return normalisePrincipals(result?.return ?? result)
  } catch (err) {
    if (err?.name === 'AbortError' || err?.isAuthError) throw err
    return null
  }
}

/** Both shapes reduce to [{name, description}]. */
function normalisePrincipals(result) {
  const list = items(result).length ? items(result) : Array.isArray(result) ? result : []
  return list
    .map((entry) => (typeof entry === 'string' ? { name: entry, description: '' } : entry))
    .filter((entry) => entry?.name)
    .map((entry) => ({ name: entry.name, description: entry.description || '' }))
}

// --- domain comparison -------------------------------------------------------

/**
 * Everything the Compare page reads from one domain, in a single request.
 * Attributes are named explicitly so the two sides are always compared on the
 * same set, whatever else a release happens to expose.
 *
 * The list is long on purpose. A domain that "works in test" usually differs in
 * exactly one of these, and an attribute left out of this request is an
 * attribute the page can never report — so the sizing, timeout and start-up
 * settings that actually drift are all here, including the child MBeans that
 * hold them: `serverStart` for the JVM command line where heap size lives, SSL
 * for the second listen port, `log` for rotation.
 */
export function configSnapshot(options) {
  return search(
    'domainConfig',
    {
      links: [],
      fields: [
        'name',
        'productionModeEnabled',
        'configurationVersion',
        'administrationPort',
        'administrationPortEnabled',
        'adminServerName',
        'configurationAuditType',
        'consoleEnabled',
      ],
      children: {
        servers: {
          links: [],
          fields: [
            'name',
            'listenAddress',
            'listenPort',
            'listenPortEnabled',
            'sslListenPort',
            'cluster',
            'machine',
            'startupMode',
            'autoRestart',
            'restartMax',
            'restartIntervalSeconds',
            'gracefulShutdownTimeout',
            'ignoreSessionsDuringShutdown',
            'stuckThreadMaxTime',
            'stuckThreadTimerInterval',
            'maxMessageSize',
            'acceptBacklog',
            'tunnelingEnabled',
          ],
          children: {
            // Where heap size actually lives: Node Manager passes these to java.
            serverStart: { links: [], fields: ['arguments', 'javaHome', 'classPath'] },
            SSL: { links: [], fields: ['enabled', 'listenPort', 'hostnameVerificationIgnored'] },
            log: {
              links: [],
              fields: ['fileName', 'rotationType', 'fileMinSize', 'fileCount', 'numberOfFilesLimited', 'loggerSeverity'],
            },
          },
        },
        clusters: {
          links: [],
          fields: [
            'name',
            'clusterMessagingMode',
            'clusterAddress',
            'servers',
            'multicastAddress',
            'multicastPort',
            'numberOfServersInClusterAddress',
            'defaultLoadAlgorithm',
            'frontendHost',
            'frontendHTTPPort',
            'frontendHTTPSPort',
          ],
        },
        appDeployments: {
          links: [],
          fields: ['name', 'sourcePath', 'planPath', 'targets', 'stagingMode', 'moduleType', 'deploymentOrder', 'securityDDModel'],
        },
        libraries: { links: [], fields: ['name', 'sourcePath', 'targets'] },
        machines: { links: [], fields: ['name'] },
        JDBCSystemResources: {
          links: [],
          fields: ['name', 'targets'],
          children: {
            JDBCResource: {
              links: [],
              fields: ['name'],
              children: {
                JDBCDriverParams: { links: [], fields: ['url', 'driverName'] },
                JDBCDataSourceParams: { links: [], fields: ['JNDINames', 'globalTransactionsProtocol'] },
                JDBCConnectionPoolParams: {
                  links: [],
                  fields: [
                    'initialCapacity',
                    'maxCapacity',
                    'minCapacity',
                    'capacityIncrement',
                    'shrinkFrequencySeconds',
                    'connectionReserveTimeoutSeconds',
                    'inactiveConnectionTimeoutSeconds',
                    'testTableName',
                    'testConnectionsOnReserve',
                    'testFrequencySeconds',
                    'secondsToTrustAnIdlePoolConnection',
                    'connectionCreationRetryFrequencySeconds',
                    'statementCacheSize',
                    'statementCacheType',
                  ],
                },
              },
            },
          },
        },
      },
    },
    options,
  )
}

/**
 * The domain-wide amounts: JTA limits and the work manager constraints that cap
 * how many threads an application may take.
 *
 * Read separately from the snapshot above, and allowed to fail: `selfTuning` is
 * not exposed by every release, and losing the whole comparison over a subtree
 * one domain happens to lack would be a poor trade.
 */
export function tuningSnapshot(options) {
  return search(
    'domainConfig',
    {
      links: [],
      fields: [],
      children: {
        JTA: {
          links: [],
          fields: ['timeoutSeconds', 'abandonTimeoutSeconds', 'maxTransactions', 'checkpointIntervalSeconds'],
        },
        selfTuning: {
          links: [],
          fields: [],
          children: {
            workManagers: { links: [], fields: ['name', 'targets'] },
            maxThreadsConstraints: { links: [], fields: ['name', 'count', 'targets'] },
            minThreadsConstraints: { links: [], fields: ['name', 'count', 'targets'] },
            capacities: { links: [], fields: ['name', 'count', 'targets'] },
          },
        },
      },
    },
    options,
  )
}
