import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  healthLabel,
  n,
  nonZero,
  parseCookies,
  parseHistory,
  profileKey,
  renderMetrics,
  samplePayload,
  sanitiseHost,
  sessions,
  toSample,
} from '../../server/index.mjs'

/** One serverRuntimes entry as the AdminServer answers the sampling search. */
const runtime = (extra = {}) => ({
  name: 'ms1',
  state: 'RUNNING',
  healthState: { state: 'ok' },
  JVMRuntime: { heapSizeCurrent: 1000, heapFreeCurrent: 400, heapSizeMax: 4000 },
  threadPoolRuntime: {
    executeThreadTotalCount: 20,
    executeThreadIdleCount: 15,
    standbyThreadCount: 2,
    stuckThreadCount: 0,
    hoggingThreadCount: 0,
    queueLength: 0,
    pendingUserRequestCount: 0,
    throughput: 12.5,
  },
  ...extra
})

const payloadOf = (...runtimes) => ({ serverRuntimes: { items: runtimes } })

describe('n', () => {
  it('turns anything unanswerable into zero rather than NaN', () => {
    expect(n(undefined)).toBe(0)
    expect(n(null)).toBe(0)
    expect(n('nonsense')).toBe(0)
    expect(n(Infinity)).toBe(0)
  })

  it('keeps a real number, including a fractional one', () => {
    expect(n(12.5)).toBe(12.5)
    expect(n('42')).toBe(42)
  })
})

describe('nonZero', () => {
  it('drops the resting value of every counter', () => {
    expect(nonZero({ a: 0, b: 3, c: 0 })).toEqual({ b: 3 })
  })

  it('is an empty object when nothing was happening', () => {
    expect(nonZero({ a: 0, b: 0 })).toEqual({})
  })
})

describe('healthLabel', () => {
  it('reads both the object and the string form, without the prefix', () => {
    expect(healthLabel({ state: 'ok' })).toBe('OK')
    expect(healthLabel('HEALTH_CRITICAL')).toBe('CRITICAL')
  })

  it('is UNKNOWN when the server reported nothing', () => {
    expect(healthLabel(null)).toBe('UNKNOWN')
    expect(healthLabel({})).toBe('UNKNOWN')
  })
})

describe('toSample', () => {
  afterEach(() => vi.useRealTimers())

  it('stamps the sample with the moment it was taken', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    expect(toSample(payloadOf(runtime())).t).toBe(1_700_000_000_000)
  })

  it('reduces heap to used and maximum', () => {
    const { servers } = toSample(payloadOf(runtime()))
    expect(servers.ms1).toMatchObject({ hu: 600, hm: 4000 })
  })

  it('falls back to the current heap size when no maximum is reported', () => {
    const jvm = { heapSizeCurrent: 1000, heapFreeCurrent: 400, heapSizeMax: 0 }
    expect(toSample(payloadOf(runtime({ JVMRuntime: jvm }))).servers.ms1.hm).toBe(1000)
  })

  it('counts busy threads as neither idle nor standing by', () => {
    expect(toSample(payloadOf(runtime())).servers.ms1.tb).toBe(3)
  })

  it('never reports a negative busy count, however the pool adds up', () => {
    const pool = { executeThreadTotalCount: 5, executeThreadIdleCount: 9, standbyThreadCount: 0 }
    expect(toSample(payloadOf(runtime({ threadPoolRuntime: pool }))).servers.ms1.tb).toBe(0)
  })

  it('stores a stopped server’s state and nothing else', () => {
    const stopped = { name: 'ms2', state: 'SHUTDOWN', JVMRuntime: null, threadPoolRuntime: null }
    const entry = toSample(payloadOf(stopped)).servers.ms2
    // Absent rather than zero: a chart given zeros draws a confident flat line
    // across an outage instead of leaving it blank.
    expect(entry).toEqual({ st: 'SHUTDOWN', he: 'UNKNOWN' })
    expect(entry.tt).toBeUndefined()
    expect(entry.hu).toBeUndefined()
  })

  it('skips a runtime with no name', () => {
    expect(Object.keys(toSample(payloadOf({ state: 'RUNNING' })).servers)).toEqual([])
  })

  it('survives an answer with no server runtimes at all', () => {
    expect(toSample({})).toMatchObject({ servers: {} })
    expect(toSample(null)).toMatchObject({ servers: {} })
  })

  it('records when the JVM came up, which is the only sign of a restart', () => {
    expect(toSample(payloadOf(runtime({ activationTime: 1234 }))).servers.ms1.ac).toBe(1234)
  })

  it('keeps an open socket count of zero, since that is a reading', () => {
    expect(toSample(payloadOf(runtime({ openSocketsCurrentCount: 0 }))).servers.ms1.so).toBe(0)
  })

  describe('data source pools', () => {
    const withPools = (...pools) =>
      runtime({ JDBCServiceRuntime: { JDBCDataSourceRuntimeMBeans: { items: pools } } })

    it('rolls the pools up and keeps each one’s detail', () => {
      const { servers } = toSample(
        payloadOf(
          withPools(
            { name: 'dsA', activeConnectionsCurrentCount: 3, currCapacity: 10, waitingForConnectionCurrentCount: 1 },
            { name: 'dsB', activeConnectionsCurrentCount: 2, currCapacity: 5 },
          ),
        ),
      )
      expect(servers.ms1).toMatchObject({ dsa: 5, dsc: 15, dsw: 1 })
      expect(servers.ms1.ds).toEqual({ dsA: { a: 3, c: 10, w: 1 }, dsB: { a: 2, c: 5 } })
    })

    it('stores an idle pool as nothing at all', () => {
      const { servers } = toSample(payloadOf(withPools({ name: 'dsA', activeConnectionsCurrentCount: 0 })))
      expect(servers.ms1.ds).toBeUndefined()
      expect(servers.ms1.dsa).toBeUndefined()
    })

    it('skips a pool with no name', () => {
      const { servers } = toSample(payloadOf(withPools({ activeConnectionsCurrentCount: 3 })))
      expect(servers.ms1.ds).toBeUndefined()
    })
  })

  describe('transactions and messages', () => {
    it('keeps the JTA counters that are moving', () => {
      const jta = { activeTransactionsTotalCount: 2, transactionCommittedTotalCount: 100, transactionRolledBackTotalCount: 0 }
      const { servers } = toSample(payloadOf(runtime({ JTARuntime: jta })))
      expect(servers.ms1).toMatchObject({ jta: 2, jtc: 100 })
      expect(servers.ms1.jtr).toBeUndefined()
    })

    it('rolls JMS servers up and keeps each one’s detail', () => {
      const jms = { JMSServers: { items: [{ name: 'jms1', messagesCurrentCount: 4, messagesPendingCount: 2 }] } }
      const { servers } = toSample(payloadOf(runtime({ JMSRuntime: jms })))
      expect(servers.ms1).toMatchObject({ jmc: 4, jmp: 2 })
      expect(servers.ms1.jm).toEqual({ jms1: { c: 4, p: 2 } })
    })
  })
})

describe('samplePayload', () => {
  it('asks for the three extra subsystems only at full depth', () => {
    const full = samplePayload('full')
    expect(full).toContain('JDBCServiceRuntime')
    expect(full).toContain('JTARuntime')
    expect(full).toContain('JMSRuntime')

    const basic = samplePayload('basic')
    expect(basic).not.toContain('JDBCServiceRuntime')
    expect(basic).toContain('threadPoolRuntime')
  })

  it('names no fields on JTARuntime, whose attributes differ between releases', () => {
    // Naming an attribute a release does not have fails the whole search.
    expect(JSON.parse(samplePayload('full')).children.serverRuntimes.children.JTARuntime).toEqual({ links: [] })
  })

  it('is valid JSON at either depth', () => {
    expect(() => JSON.parse(samplePayload('full'))).not.toThrow()
    expect(() => JSON.parse(samplePayload('basic'))).not.toThrow()
  })
})

describe('parseHistory', () => {
  const line = (t, servers = { ms1: { st: 'RUNNING' } }) => JSON.stringify({ t, servers })

  it('reads one sample per line', () => {
    expect(parseHistory([line(2000), line(3000)].join('\n'), 0).map((s) => s.t)).toEqual([2000, 3000])
  })

  it('drops what is older than the cutoff', () => {
    expect(parseHistory([line(1000), line(5000)].join('\n'), 2000).map((s) => s.t)).toEqual([5000])
  })

  it('tolerates a line half-written when the process died', () => {
    const raw = [line(1000), '{"t":2000,"serv', line(3000)].join('\n')
    expect(parseHistory(raw, 0).map((s) => s.t)).toEqual([1000, 3000])
  })

  it('ignores a well-formed line that is not a sample', () => {
    expect(parseHistory([line(1000), '{"t":2000}', 'null'].join('\n'), 0).map((s) => s.t)).toEqual([1000])
  })

  it('sorts, because two consoles on one domain interleave their appends', () => {
    expect(parseHistory([line(3000), line(1000), line(2000)].join('\n'), 0).map((s) => s.t)).toEqual([1000, 2000, 3000])
  })

  it('is empty for an empty file', () => {
    expect(parseHistory('', 0)).toEqual([])
    expect(parseHistory('\n\n', 0)).toEqual([])
  })
})

describe('sanitiseHost', () => {
  it('keeps a plain hostname or address', () => {
    expect(sanitiseHost('adminhost')).toBe('adminhost')
    expect(sanitiseHost('10.0.0.12')).toBe('10.0.0.12')
  })

  it('strips the scheme people already have in their WLST scripts', () => {
    expect(sanitiseHost('t3://adminhost:7001')).toBe('adminhost')
    expect(sanitiseHost('https://adminhost')).toBe('adminhost')
  })

  it('takes the first member of a cluster address', () => {
    expect(sanitiseHost('t3://ms1:7001,ms2:7001')).toBe('ms1')
  })

  it('drops a path and any credentials', () => {
    expect(sanitiseHost('http://weblogic:secret@adminhost:7001/console')).toBe('adminhost')
  })

  it('leaves an IPv6 address whole, since the port field is authoritative', () => {
    expect(sanitiseHost('2001:db8::1')).toBe('2001:db8::1')
  })

  it('is empty for nothing at all', () => {
    expect(sanitiseHost('')).toBe('')
    expect(sanitiseHost(null)).toBe('')
    expect(sanitiseHost(undefined)).toBe('')
  })
})

describe('profileKey', () => {
  it('identifies a target by scheme, user, host and port', () => {
    expect(profileKey({ ssl: true, username: 'weblogic', host: 'adminhost', port: 7002 })).toBe(
      'https://weblogic@adminhost:7002',
    )
  })

  it('separates two users on the same AdminServer', () => {
    const base = { ssl: false, host: 'adminhost', port: 7001 }
    expect(profileKey({ ...base, username: 'a' })).not.toBe(profileKey({ ...base, username: 'b' }))
  })

  it('separates the same host reached over SSL and not', () => {
    const base = { username: 'weblogic', host: 'adminhost', port: 7001 }
    expect(profileKey({ ...base, ssl: true })).not.toBe(profileKey({ ...base, ssl: false }))
  })
})

describe('parseCookies', () => {
  it('reads a name and value', () => {
    expect(parseCookies('wlc_session=abc123')).toMatchObject({ wlc_session: 'abc123' })
  })

  it('reads several, ignoring the spacing', () => {
    expect(parseCookies('a=1;  b=2')).toMatchObject({ a: '1', b: '2' })
  })

  it('decodes a percent-escaped value', () => {
    expect(parseCookies('a=one%20two').a).toBe('one two')
  })

  it('skips a fragment with no value', () => {
    expect(Object.keys(parseCookies('a=1; broken; b=2'))).toEqual(['a', 'b'])
  })

  it('is empty for no header at all', () => {
    expect(parseCookies()).toEqual({})
    expect(parseCookies('')).toEqual({})
  })

  it('cannot be poisoned by a cookie named after an Object member', () => {
    // The map has a null prototype, so a cookie called __proto__ is data.
    const out = parseCookies('__proto__=polluted')
    expect(out.__proto__).toBe('polluted')
    expect({}.polluted).toBeUndefined()
  })
})

describe('renderMetrics', () => {
  const withConnection = (history) => {
    sessions.clear()
    sessions.set('token', {
      lastUsed: Date.now(),
      activeId: 'c1',
      connections: new Map([['c1', { id: 'c1', name: 'dev', domain: { name: 'base_domain' }, history }]]),
    })
  }

  beforeEach(() => sessions.clear())
  afterEach(() => sessions.clear())

  it('is empty when nothing has been sampled', () => {
    expect(renderMetrics().trim()).toBe('')
  })

  it('publishes the newest sample of each server, labelled by domain', () => {
    withConnection([{ t: 1, servers: { ms1: { st: 'RUNNING', he: 'OK', tt: 20, tb: 3, hu: 600, hm: 4000 } } }])
    const out = renderMetrics()
    expect(out).toContain('# TYPE wlc_server_up gauge')
    expect(out).toContain('wlc_server_up{domain="base_domain",server="ms1"} 1')
    expect(out).toContain('wlc_heap_used_bytes{domain="base_domain",server="ms1"} 600')
    expect(out).toContain('wlc_threads_busy{domain="base_domain",server="ms1"} 3')
  })

  it('publishes only the newest sample, not the whole buffer', () => {
    withConnection([
      { t: 1, servers: { ms1: { st: 'RUNNING', tt: 20, tb: 1 } } },
      { t: 2, servers: { ms1: { st: 'RUNNING', tt: 20, tb: 9 } } },
    ])
    const out = renderMetrics()
    expect(out).toContain('wlc_threads_busy{domain="base_domain",server="ms1"} 9')
    expect(out).not.toContain('wlc_threads_busy{domain="base_domain",server="ms1"} 1\n')
  })

  it('says a stopped server is down and publishes no readings for it', () => {
    withConnection([{ t: 1, servers: { ms1: { st: 'SHUTDOWN', he: 'UNKNOWN' } } }])
    const out = renderMetrics()
    // A scraper stores an absent series as a gap and a zero as a measurement,
    // so a zero here would put "heap fell to 0" in somebody's dashboard.
    expect(out).toContain('wlc_server_up{domain="base_domain",server="ms1"} 0')
    expect(out).not.toContain('wlc_heap_used_bytes')
  })

  it('labels JDBC series per pool, since a rollup cannot say which database', () => {
    withConnection([{ t: 1, servers: { ms1: { st: 'RUNNING', tt: 20, ds: { dsA: { a: 3, c: 10, w: 2 } } } } }])
    const out = renderMetrics()
    expect(out).toContain('wlc_jdbc_waiting{domain="base_domain",server="ms1",data_source="dsA"} 2')
  })

  it('marks the totals as counters and the rest as gauges', () => {
    withConnection([{ t: 1, servers: { ms1: { st: 'RUNNING', tt: 20, jtc: 500 } } }])
    const out = renderMetrics()
    expect(out).toContain('# TYPE wlc_jta_transactions_committed_total counter')
    expect(out).toContain('# TYPE wlc_threads_total gauge')
  })

  it('escapes a label value rather than emitting an unparseable line', () => {
    sessions.clear()
    sessions.set('token', {
      lastUsed: Date.now(),
      activeId: 'c1',
      connections: new Map([
        [
          'c1',
          {
            id: 'c1',
            domain: { name: 'a"b\\c' },
            history: [{ t: 1, servers: { 'ms\n1': { st: 'RUNNING', tt: 20 } } }],
          },
        ],
      ]),
    })
    const out = renderMetrics()
    expect(out).toContain('domain="a\\"b\\\\c"')
    expect(out).toContain('server="ms 1"')
  })

  it('falls back to the connection name when the domain went unread', () => {
    sessions.clear()
    sessions.set('token', {
      lastUsed: Date.now(),
      activeId: 'c1',
      connections: new Map([
        ['c1', { id: 'c1', name: 'dev', host: 'h', history: [{ t: 1, servers: { ms1: { st: 'RUNNING', tt: 1 } } }] }],
      ]),
    })
    expect(renderMetrics()).toContain('domain="dev"')
  })

  it('publishes one connection once, however many sessions hold it', () => {
    const connection = { id: 'c1', domain: { name: 'd' }, history: [{ t: 1, servers: { ms1: { st: 'RUNNING' } } }] }
    sessions.clear()
    sessions.set('a', { lastUsed: Date.now(), activeId: 'c1', connections: new Map([['c1', connection]]) })
    sessions.set('b', { lastUsed: Date.now(), activeId: 'c1', connections: new Map([['c1', connection]]) })
    const lines = renderMetrics().split('\n').filter((l) => l.startsWith('wlc_server_up{'))
    expect(lines).toHaveLength(1)
  })
})
