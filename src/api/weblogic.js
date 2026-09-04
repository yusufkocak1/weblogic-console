import { get, post, search } from './client'

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
 * PREPARED, NEW, FAILED, RETIRED. It is an action on the deployment runtime
 * rather than a readable attribute, so there is no way to ask for the whole
 * table at once; `deploymentStates` batches the calls instead.
 */
export function deploymentState(app, target, options) {
  return post(
    `/domainRuntime/deploymentManager/appDeploymentRuntimes/${encodeURIComponent(app)}/getState`,
    target ? { target } : {},
    options,
  )
}

/** Resolves the state of many applications, a few requests at a time. */
export async function deploymentStates(names, options) {
  const queue = [...names]
  const states = new Map()

  async function worker() {
    while (queue.length) {
      const name = queue.shift()
      try {
        const response = await deploymentState(name, undefined, options)
        const state = response?.return ?? response
        if (typeof state === 'string' && state) states.set(name, state.toUpperCase())
      } catch (err) {
        // An abort or a dead session concerns every call, not just this one.
        if (err?.name === 'AbortError' || err?.isAuthError) throw err
        // Anything else means this deployment has no runtime to ask, which the
        // caller renders from the per-server application runtimes instead.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker))
  return states
}

/** action is 'start' or 'stop'; targets restricts the operation to given servers. */
export function deploymentAction(app, action, targets, options) {
  const body = targets?.length ? { targets } : {}
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
 */
export async function fetchLog(server, options = {}, requestOptions) {
  const { log = 'ServerLog', query = '', limit = 200, sinceMs = 3600000 } = options
  const endTime = Date.now()
  const startTime = endTime - sinceMs
  try {
    const res = await post(`${logBase(server, log)}/search`, { query, startTime, endTime, limit }, requestOptions)
    return normalizeLogRows(res?.return ?? res?.records ?? res)
  } catch (err) {
    if (![400, 404, 405, 500].includes(err?.status)) throw err
    return fetchLogViaCursor(server, { log, query, limit, startTime, endTime }, requestOptions)
  }
}

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
  try {
    // fetch() streams one chunk per call and returns an empty array once drained.
    for (let i = 0; i < 50 && rows.length < limit; i++) {
      const chunk = await post(`${base}/fetch`, { cursor }, requestOptions)
      const items = chunk?.return ?? []
      if (!items.length) break
      rows.push(...items)
    }
  } finally {
    await post(`${base}/closeCursor`, { cursor }, requestOptions).catch(() => {})
  }
  return normalizeLogRows(rows).slice(0, limit)
}

/** WLDF returns upper-case column names; older builds use camelCase. */
function normalizeLogRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row, index) => {
    if (typeof row === 'string') return { id: index, message: row, raw: row }
    return {
      id: row.RECORDID ?? row.recordId ?? index,
      timestamp: row.TIMESTAMP ?? row.timestamp ?? null,
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
