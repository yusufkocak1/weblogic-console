import { describe, expect, it } from 'vitest'
import { compareResources, formatAmount, formatDelta, GROUPS, resourceProfile } from '@/utils/resources'

const GB = 1024 ** 3

/** A domain reduced to the shape the Compare page reads. */
const domainWith = ({ servers = [], clusters = [], dataSources = [], deployments = [] } = {}) => ({
  servers: { items: servers },
  clusters: { items: clusters },
  JDBCSystemResources: { items: dataSources },
  appDeployments: { items: deployments },
})

const server = (name, args, extra = {}) => ({ name, serverStart: { arguments: args }, ...extra })

const rowsOf = (profile, group, name) => {
  const entry = profile[group].find((object) => object.name === name)
  return Object.fromEntries((entry?.rows || []).map((row) => [row.key, row.value]))
}

describe('formatAmount', () => {
  it('writes each kind in its own units', () => {
    expect(formatAmount('bytes', 2 * GB)).toBe('2.0 GB')
    expect(formatAmount('seconds', 30)).toBe('30 s')
    expect(formatAmount('millis', 200)).toBe('200 ms')
    expect(formatAmount('text', 'G1')).toBe('G1')
  })

  it('shows an em dash for an amount that is not set', () => {
    expect(formatAmount('bytes', null)).toBe('—')
    expect(formatAmount('count', undefined)).toBe('—')
    expect(formatAmount('text', '')).toBe('—')
  })

  it('falls back to text for a kind it does not know', () => {
    expect(formatAmount('nonsense', 5)).toBe('5')
  })
})

describe('formatDelta', () => {
  it('signs the difference and writes it in the amount’s own units', () => {
    expect(formatDelta('bytes', 2 * GB, 4 * GB)).toBe('+2.0 GB')
    expect(formatDelta('count', 10, 4)).toBe('−6')
  })

  it('says nothing when the two sides are equal', () => {
    expect(formatDelta('count', 5, 5)).toBe('')
  })

  it('says nothing for an amount that cannot be subtracted', () => {
    expect(formatDelta('text', 'G1', 'Parallel')).toBe('')
  })

  it('says nothing when one side is missing, since that is not arithmetic', () => {
    expect(formatDelta('bytes', null, 4 * GB)).toBe('')
    expect(formatDelta('bytes', 4 * GB, undefined)).toBe('')
  })
})

describe('resourceProfile', () => {
  it('survives a domain with nothing in it', () => {
    const profile = resourceProfile({}, null, null)
    expect(profile.servers).toEqual([])
    expect(profile.clusters).toEqual([])
    expect(profile.domain).toHaveLength(1)
  })

  it('reads a server’s heap out of its Node Manager command line', () => {
    const profile = resourceProfile(domainWith({ servers: [server('ms1', '-Xms1g -Xmx4g -XX:+UseG1GC')] }), null, null)
    expect(rowsOf(profile, 'servers', 'ms1')).toMatchObject({
      heapMin: GB,
      heapMax: 4 * GB,
      collector: 'G1',
    })
  })

  it('leaves out an amount the command line never stated', () => {
    const profile = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx4g')] }), null, null)
    expect(rowsOf(profile, 'servers', 'ms1')).not.toHaveProperty('heapMin')
  })

  it('gives every -D and every leftover option a row of its own', () => {
    const profile = resourceProfile(
      domainWith({ servers: [server('ms1', '-Dweblogic.Name=ms1 -Dquiet -server')] }),
      null,
      null,
    )
    const rows = rowsOf(profile, 'servers', 'ms1')
    expect(rows['property:weblogic.Name']).toBe('ms1')
    // A property set with no value still reads as set rather than as absent.
    expect(rows['property:quiet']).toBe('(set)')
    expect(rows['option:-server']).toBe('present')
  })

  it('reads the live JVM alongside the configured command line', () => {
    const profile = resourceProfile(
      domainWith({ servers: [server('ms1', '-Xmx4g')] }),
      { serverRuntimes: { items: [{ name: 'ms1', JVMRuntime: { heapSizeMax: 2 * GB, javaVersion: '17.0.9' } }] } },
      null,
    )
    expect(rowsOf(profile, 'servers', 'ms1')).toMatchObject({
      heapMax: 4 * GB,
      runtimeHeapMax: 2 * GB,
      javaVersion: '17.0.9',
    })
  })

  it('adds the members’ heap up for a cluster', () => {
    const profile = resourceProfile(
      domainWith({
        servers: [
          server('ms1', '-Xmx2g', { cluster: [{ identity: ['clusters', 'c1'] }] }),
          server('ms2', '-Xmx2g', { cluster: [{ identity: ['clusters', 'c1'] }] }),
        ],
        clusters: [{ name: 'c1' }],
      }),
      null,
      null,
    )
    expect(rowsOf(profile, 'clusters', 'c1')).toMatchObject({ members: 2, heapTotal: 4 * GB })
  })

  it('falls back to the cluster’s own member list when the servers name no cluster', () => {
    const profile = resourceProfile(
      domainWith({
        servers: [server('ms1', '-Xmx2g')],
        clusters: [{ name: 'c1', servers: [{ identity: ['servers', 'ms1'] }] }],
      }),
      null,
      null,
    )
    expect(rowsOf(profile, 'clusters', 'c1')).toMatchObject({ members: 1, heapTotal: 2 * GB })
  })

  it('multiplies out the cursors a data source may hold open', () => {
    const profile = resourceProfile(
      domainWith({
        dataSources: [
          {
            name: 'ds1',
            targets: [{ identity: ['servers', 'ms1'] }],
            JDBCResource: { JDBCConnectionPoolParams: { maxCapacity: 50, statementCacheSize: 10 } },
          },
        ],
      }),
      null,
      null,
    )
    expect(rowsOf(profile, 'dataSources', 'ds1')).toMatchObject({
      maxCapacity: 50,
      statementCacheSize: 10,
      cursors: 500,
      targets: 1,
    })
  })

  it('does not invent a cursor count when either factor is missing', () => {
    const profile = resourceProfile(
      domainWith({ dataSources: [{ name: 'ds1', JDBCResource: { JDBCConnectionPoolParams: { maxCapacity: 50 } } }] }),
      null,
      null,
    )
    expect(rowsOf(profile, 'dataSources', 'ds1')).not.toHaveProperty('cursors')
  })

  it('sums the domain totals across every server and pool', () => {
    const profile = resourceProfile(
      domainWith({
        servers: [server('ms1', '-Xmx2g'), server('ms2', '-Xmx3g')],
        dataSources: [
          { name: 'ds1', JDBCResource: { JDBCConnectionPoolParams: { maxCapacity: 20 } } },
          { name: 'ds2', JDBCResource: { JDBCConnectionPoolParams: { maxCapacity: 30 } } },
        ],
        deployments: [{ name: 'myapp' }],
      }),
      null,
      { JTA: { timeoutSeconds: 30, maxTransactions: 1000 } },
    )
    expect(rowsOf(profile, 'domain', '')).toMatchObject({
      servers: 2,
      dataSources: 2,
      deployments: 1,
      heapTotal: 5 * GB,
      poolTotal: 50,
      jtaTimeout: 30,
      jtaMaxTransactions: 1000,
    })
  })

  it('leaves a total out entirely when no side stated any of its parts', () => {
    const profile = resourceProfile(domainWith({ servers: [server('ms1', '-server')] }), null, null)
    expect(rowsOf(profile, 'domain', '')).not.toHaveProperty('heapTotal')
  })

  it('reads the work manager constraints out of the self-tuning snapshot', () => {
    const profile = resourceProfile({}, null, {
      selfTuning: {
        maxThreadsConstraints: { items: [{ name: 'mtc1', count: 20 }] },
        capacities: { items: [{ name: 'cap1', count: 500 }] },
      },
    })
    expect(profile.constraints.map((entry) => entry.name)).toEqual(['mtc1', 'cap1'])
    expect(rowsOf(profile, 'constraints', 'cap1')).toEqual({ capacity: 500 })
  })
})

describe('compareResources', () => {
  const left = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx2g -XX:+UseG1GC')] }), null, null)
  const right = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx4g -XX:+UseParallelGC')] }), null, null)

  it('keeps every group, in the order the page renders them', () => {
    expect(compareResources(left, right).groups.map((group) => group.key)).toEqual(GROUPS.map((group) => group.key))
  })

  it('counts what differs across the whole comparison', () => {
    const { differing } = compareResources(left, right)
    // Heap and collector on ms1, plus the domain's heap total.
    expect(differing).toBe(3)
  })

  it('puts both sides and the delta on the differing row', () => {
    const servers = compareResources(left, right).groups.find((group) => group.key === 'servers')
    const heap = servers.objects[0].rows.find((row) => row.key === 'heapMax')
    expect(heap).toMatchObject({ left: 2 * GB, right: 4 * GB, same: false, delta: '+2.0 GB' })
  })

  it('marks a row that matches as the same, with no delta', () => {
    const same = compareResources(left, left).groups.find((group) => group.key === 'servers')
    expect(same.objects[0].rows.every((row) => row.same)).toBe(true)
    expect(compareResources(left, left).differing).toBe(0)
  })

  it('unions objects rather than intersecting them, so one-sided ones still show', () => {
    const onlyLeft = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx2g'), server('ms2', '-Xmx2g')] }), null, null)
    const onlyRight = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx2g')] }), null, null)
    const servers = compareResources(onlyLeft, onlyRight).groups.find((group) => group.key === 'servers')
    expect(servers.objects.map((object) => object.name)).toEqual(['ms1', 'ms2'])
    expect(servers.objects.find((object) => object.name === 'ms2')).toMatchObject({ onlyLeft: true, onlyRight: false })
  })

  it('treats an amount set on one side only as a difference', () => {
    const withMeta = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx2g -XX:MaxMetaspaceSize=512m')] }), null, null)
    const without = resourceProfile(domainWith({ servers: [server('ms1', '-Xmx2g')] }), null, null)
    const servers = compareResources(withMeta, without).groups.find((group) => group.key === 'servers')
    const row = servers.objects[0].rows.find((r) => r.key === 'metaspaceMax')
    expect(row).toMatchObject({ same: false, right: null })
    // Nothing to subtract, so no delta is invented.
    expect(row.delta).toBe('')
  })

  it('carries the label and help of a row that exists on one side only', () => {
    const withMeta = resourceProfile(domainWith({ servers: [server('ms1', '-XX:MaxMetaspaceSize=512m')] }), null, null)
    const empty = resourceProfile(domainWith({ servers: [server('ms1', '')] }), null, null)
    const servers = compareResources(empty, withMeta).groups.find((group) => group.key === 'servers')
    const row = servers.objects[0].rows.find((r) => r.key === 'metaspaceMax')
    expect(row.label).toBe('Maximum metaspace')
    expect(row.kind).toBe('bytes')
  })

  it('counts the differing rows per object', () => {
    const servers = compareResources(left, right).groups.find((group) => group.key === 'servers')
    expect(servers.objects[0].differing).toBe(2)
  })

  it('sorts objects by name so the two sides line up', () => {
    const a = resourceProfile(domainWith({ servers: [server('zeta', '-Xmx1g'), server('alpha', '-Xmx1g')] }), null, null)
    const servers = compareResources(a, a).groups.find((group) => group.key === 'servers')
    expect(servers.objects.map((object) => object.name)).toEqual(['alpha', 'zeta'])
  })
})
