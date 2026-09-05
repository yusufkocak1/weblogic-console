/**
 * How much of everything a domain is configured to have.
 *
 * The attribute diff on the Compare page answers "what is set differently".
 * This answers the question underneath it: how much memory, how many threads
 * and how many database connections does each side actually get. Those amounts
 * are scattered — heap lives in a JVM command line, pool size in a JDBC child
 * MBean, thread counts only exist at runtime — and each is written in its own
 * units, so comparing them as text either misses a difference or invents one.
 *
 * Every amount here is normalised to a number with a kind (bytes, a count, a
 * duration), which is what lets the page say "2 GB against 4 GB, +2 GB" instead
 * of printing two command lines and leaving the arithmetic to the reader.
 */

import { bytes, items, num, targetNames } from '@/utils/format'
import { parseJvmArgs } from '@/utils/jvm'

export const GROUPS = [
  {
    key: 'domain',
    label: 'Domain totals',
    hint: 'Sums across the whole domain. These stay comparable even when the two domains name their servers differently.',
  },
  { key: 'servers', label: 'Servers', route: 'server-detail' },
  { key: 'clusters', label: 'Clusters', route: 'cluster-detail' },
  { key: 'dataSources', label: 'Data sources', route: 'data-source-detail' },
  {
    key: 'constraints',
    label: 'Work manager constraints',
    hint: 'The ceilings a work manager puts on threads and queued requests. A constraint that exists on one side only is a common reason an application is throttled in one domain and not in the other.',
  },
]

/** How a value is written, and whether subtracting two of them means anything. */
const KINDS = {
  bytes: { format: (value) => bytes(value), numeric: true },
  count: { format: (value) => num(value), numeric: true },
  seconds: { format: (value) => `${num(value)} s`, numeric: true },
  millis: { format: (value) => `${num(value)} ms`, numeric: true },
  text: { format: (value) => String(value), numeric: false },
}

export function formatAmount(kind, value) {
  if (value === null || value === undefined || value === '') return '—'
  return (KINDS[kind] || KINDS.text).format(value)
}

/**
 * The difference as it reads next to the two values: "+2 GB", "−8". Only for
 * amounts where subtracting means something — a different garbage collector has
 * no delta, it is simply a different collector.
 */
export function formatDelta(kind, left, right) {
  if (!KINDS[kind]?.numeric) return ''
  if (typeof left !== 'number' || typeof right !== 'number') return ''
  const delta = right - left
  if (delta === 0) return ''
  return `${delta > 0 ? '+' : '−'}${formatAmount(kind, Math.abs(delta))}`
}

/** Rows are collected in definition order, which is the order they render in. */
function collector() {
  const rows = []
  return {
    rows,
    add(key, label, kind, value, help) {
      if (value === null || value === undefined || value === '') return
      rows.push({ key, label, kind, value, help, order: rows.length })
    },
  }
}

const sum = (values) => {
  const known = values.filter((value) => typeof value === 'number')
  return known.length ? known.reduce((total, value) => total + value, 0) : null
}

function serverRows(server, jvm, runtime) {
  const out = collector()

  // Configured: what Node Manager passes to java when it starts this server.
  out.add(
    'heapMax',
    'Maximum heap (-Xmx)',
    'bytes',
    jvm.heapMax,
    'The ceiling on this server’s Java heap. The single number behind most "it only runs out of memory in production" reports.',
  )
  out.add(
    'heapMin',
    'Initial heap (-Xms)',
    'bytes',
    jvm.heapMin,
    'The heap the JVM takes at start-up. Setting it equal to the maximum avoids the pauses that come from growing the heap under load.',
  )
  out.add('youngMax', 'Maximum young generation', 'bytes', jvm.youngMax)
  out.add('youngMin', 'Young generation', 'bytes', jvm.youngMin)
  out.add(
    'metaspaceMax',
    'Maximum metaspace',
    'bytes',
    jvm.metaspaceMax,
    'Where class metadata lives on Java 8 and later. Too small, and the server dies with OutOfMemoryError: Metaspace after enough redeploys.',
  )
  out.add('metaspaceMin', 'Initial metaspace', 'bytes', jvm.metaspaceMin)
  out.add(
    'permMax',
    'Maximum PermGen',
    'bytes',
    jvm.permMax,
    'The Java 7 equivalent of metaspace. Set on one side only, it usually means the two domains run different JDKs.',
  )
  out.add('codeCache', 'Reserved code cache', 'bytes', jvm.codeCache)
  out.add(
    'directMemory',
    'Maximum direct memory',
    'bytes',
    jvm.directMemory,
    'Off-heap buffers, used by NIO and by some JDBC drivers. It sits outside the heap, so heap sizing alone never accounts for it.',
  )
  out.add(
    'threadStack',
    'Thread stack size (-Xss)',
    'bytes',
    jvm.threadStack,
    'Multiplied by the number of threads, this is memory the process needs on top of the heap.',
  )
  out.add(
    'collector',
    'Garbage collector',
    'text',
    jvm.collector,
    'Which collector the JVM was started with. Different collectors on the two sides make their pause behaviour incomparable.',
  )
  out.add('gcThreads', 'GC threads', 'count', jvm.gcThreads)
  out.add('maxGcPause', 'GC pause target', 'millis', jvm.maxGcPause)
  out.add('javaHome', 'Java home', 'text', server?.serverStart?.javaHome)
  out.add(
    'maxMessageSize',
    'Largest accepted message',
    'bytes',
    server?.maxMessageSize,
    'The biggest single request this server accepts over HTTP and t3.',
  )

  // Live: read from the running JVM, so absent for a server that is down —
  // which is itself worth seeing side by side.
  out.add(
    'runtimeHeapMax',
    'Maximum heap, running JVM',
    'bytes',
    runtime?.JVMRuntime?.heapSizeMax,
    'What the JVM reports it may grow to. It differs from -Xmx when the server was started by a shell script rather than by Node Manager — and then the command line above is not the whole story.',
  )
  out.add(
    'runtimeThreads',
    'Threads in the pool now',
    'count',
    runtime?.threadPoolRuntime?.executeThreadTotalCount,
    'WebLogic sizes this pool itself, so some difference is normal. A large gap under comparable load is not.',
  )
  out.add('javaVersion', 'Java version', 'text', runtime?.JVMRuntime?.javaVersion)
  out.add('javaVendor', 'Java vendor', 'text', runtime?.JVMRuntime?.javaVendor)

  // Every -D and every remaining option gets its own row, so one present on a
  // single side reads as exactly that instead of hiding inside a long string.
  for (const [name, value] of Object.entries(jvm.properties).sort(([a], [b]) => a.localeCompare(b))) {
    out.add(`property:${name}`, `-D${name}`, 'text', value === '' ? '(set)' : value)
  }
  for (const option of jvm.options) out.add(`option:${option}`, option, 'text', 'present')

  return out.rows
}

function clusterRows(cluster, members, heapByServer) {
  const out = collector()
  out.add('members', 'Configured members', 'count', members.length)
  out.add(
    'heapTotal',
    'Maximum heap across the members',
    'bytes',
    sum(members.map((name) => heapByServer.get(name) ?? null)),
    'The members’ -Xmx added up: what this cluster may take from its machines.',
  )
  return out.rows
}

function dataSourceRows(dataSource) {
  const pool = dataSource?.JDBCResource?.JDBCConnectionPoolParams || {}
  const out = collector()
  out.add(
    'maxCapacity',
    'Maximum connections',
    'count',
    pool.maxCapacity,
    'The ceiling on each server this data source is targeted to — so the load the database sees is this multiplied by the number of targets.',
  )
  out.add('minCapacity', 'Connections kept when idle', 'count', pool.minCapacity)
  out.add('initialCapacity', 'Connections created at start-up', 'count', pool.initialCapacity)
  out.add('capacityIncrement', 'Connections added at a time', 'count', pool.capacityIncrement)
  out.add('statementCacheSize', 'Statements cached per connection', 'count', pool.statementCacheSize)
  if (typeof pool.maxCapacity === 'number' && typeof pool.statementCacheSize === 'number') {
    out.add(
      'cursors',
      'Cursors it may hold open',
      'count',
      pool.maxCapacity * pool.statementCacheSize,
      'Maximum connections multiplied by the statement cache. On Oracle, that product running past open_cursors is the classic ORA-01000.',
    )
  }
  out.add('targets', 'Servers it is targeted to', 'count', (dataSource?.targets || []).length || null)
  return out.rows
}

/**
 * One domain, reduced to named amounts.
 *
 * @param {object} config  the configuration snapshot
 * @param {object} runtime the runtime snapshot, or null when it could not be read
 * @param {object} tuning  the self-tuning and JTA snapshot, or null
 */
export function resourceProfile(config, runtime, tuning) {
  const runtimeByServer = new Map(items(runtime?.serverRuntimes).map((entry) => [entry.name, entry]))
  const heapByServer = new Map()
  const membersByCluster = new Map()

  const servers = items(config?.servers).map((server) => {
    const jvm = parseJvmArgs(server?.serverStart?.arguments)
    if (typeof jvm.heapMax === 'number') heapByServer.set(server.name, jvm.heapMax)
    // Membership is held on the server, as a reference to its cluster. The
    // cluster's own list says the same thing, but only one of the two is filled
    // in on some releases, so both are used.
    const [cluster] = targetNames(server?.cluster)
    if (cluster) membersByCluster.set(cluster, [...(membersByCluster.get(cluster) || []), server.name])
    return { name: server.name, rows: serverRows(server, jvm, runtimeByServer.get(server.name)) }
  })

  const clusters = items(config?.clusters).map((cluster) => {
    const listed = targetNames(cluster?.servers)
    const members = listed.length ? listed : membersByCluster.get(cluster.name) || []
    return { name: cluster.name, rows: clusterRows(cluster, members, heapByServer) }
  })

  const dataSources = items(config?.JDBCSystemResources).map((dataSource) => ({
    name: dataSource.name,
    rows: dataSourceRows(dataSource),
  }))

  const constraints = []
  const CONSTRAINT_KINDS = [
    ['maxThreadsConstraints', 'maxThreads', 'Maximum threads'],
    ['minThreadsConstraints', 'minThreads', 'Threads always available'],
    ['capacities', 'capacity', 'Requests it will queue'],
  ]
  for (const [collection, key, label] of CONSTRAINT_KINDS) {
    for (const constraint of items(tuning?.selfTuning?.[collection])) {
      const out = collector()
      out.add(key, label, 'count', constraint.count)
      if (out.rows.length) constraints.push({ name: constraint.name, rows: out.rows })
    }
  }

  const domain = collector()
  domain.add('servers', 'Servers', 'count', items(config?.servers).length)
  domain.add('clusters', 'Clusters', 'count', items(config?.clusters).length)
  domain.add('dataSources', 'Data sources', 'count', items(config?.JDBCSystemResources).length)
  domain.add('deployments', 'Applications', 'count', items(config?.appDeployments).length)
  domain.add(
    'heapTotal',
    'Maximum heap across all servers',
    'bytes',
    sum([...heapByServer.values()]),
    'Every server’s -Xmx added up. The first number to look at when one domain is sized differently from the other.',
  )
  domain.add(
    'poolTotal',
    'Maximum database connections',
    'count',
    sum(
      items(config?.JDBCSystemResources).map(
        (entry) => entry?.JDBCResource?.JDBCConnectionPoolParams?.maxCapacity ?? null,
      ),
    ),
    'Every pool’s maximum added up, per server the pools are targeted to.',
  )
  domain.add('jtaTimeout', 'JTA transaction timeout', 'seconds', tuning?.JTA?.timeoutSeconds)
  domain.add('jtaMaxTransactions', 'Concurrent transactions allowed', 'count', tuning?.JTA?.maxTransactions)

  return { domain: [{ name: '', rows: domain.rows }], servers, clusters, dataSources, constraints }
}

const sameValue = (a, b) => String(a ?? '') === String(b ?? '')

/**
 * Two profiles, subtracted. Objects and rows are unioned rather than
 * intersected: an amount set on one side only is a difference, not something to
 * leave out because the other side has nothing to compare it with.
 */
export function compareResources(left, right) {
  let differing = 0

  const groups = GROUPS.map((group) => {
    const leftObjects = new Map((left[group.key] || []).map((entry) => [entry.name, entry.rows]))
    const rightObjects = new Map((right[group.key] || []).map((entry) => [entry.name, entry.rows]))
    const names = [...new Set([...leftObjects.keys(), ...rightObjects.keys()])].sort((a, b) => a.localeCompare(b))

    const objects = names.map((name) => {
      const a = new Map((leftObjects.get(name) || []).map((row) => [row.key, row]))
      const b = new Map((rightObjects.get(name) || []).map((row) => [row.key, row]))

      const rows = [...new Set([...a.keys(), ...b.keys()])]
        .map((key) => {
          const meta = a.get(key) || b.get(key)
          const leftValue = a.get(key)?.value ?? null
          const rightValue = b.get(key)?.value ?? null
          const same = sameValue(leftValue, rightValue)
          if (!same) differing += 1
          return {
            key,
            label: meta.label,
            kind: meta.kind,
            help: meta.help || '',
            order: a.get(key)?.order ?? b.get(key)?.order ?? 0,
            left: leftValue,
            right: rightValue,
            same,
            delta: same ? '' : formatDelta(meta.kind, leftValue, rightValue),
          }
        })
        .sort((x, y) => x.order - y.order || x.label.localeCompare(y.label))

      return {
        name,
        rows,
        onlyLeft: !rightObjects.has(name),
        onlyRight: !leftObjects.has(name),
        differing: rows.filter((row) => !row.same).length,
      }
    })

    return { ...group, objects }
  })

  return { groups, differing }
}
