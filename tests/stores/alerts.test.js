import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// The store forwards alerts to the backend; nothing here should reach the network.
vi.mock('@/api/client', () => ({ notify: vi.fn(() => Promise.resolve({ forwarded: true })) }))

// Which cluster each server sits in, in the shape WebLogic answers with.
vi.mock('@/api/weblogic', () => ({ configuredServers: vi.fn(() => Promise.resolve({ items: [] })) }))

import * as api from '@/api/client'
import * as wls from '@/api/weblogic'
import { DEFAULT_RULES, useAlertsStore } from '@/stores/alerts'

/** The domain the cluster tests run against: two members and a lone server. */
const TOPOLOGY = {
  items: [
    { name: 'AdminServer' },
    { name: 'ms1', cluster: [{ identity: ['clusters', 'payments'] }] },
    { name: 'ms2', cluster: [{ identity: ['clusters', 'reporting'] }] },
  ],
}

const T0 = 1_700_000_000_000

/** One server's entry in a sample, in the short keys the backend sends. */
const running = (extra = {}) => ({ st: 'RUNNING', he: 'OK', tt: 20, tb: 2, sk: 0, q: 0, hu: 1, hm: 100, ...extra })

const sample = (t, servers) => ({ t, servers })

/**
 * Feeds samples in, having first primed the store so the batch is treated as
 * news rather than as the baseline it finds on connect.
 */
function primed(store, servers = { ms1: running() }) {
  store.ingest([sample(T0, servers)])
  return store
}

let store

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useAlertsStore()
  // Module-level condition state outlives a pinia, so each test starts clean.
  store.reset()
})

describe('the first batch of samples', () => {
  it('is a baseline, not news', () => {
    store.ingest([sample(T0, { ms1: { st: 'SHUTDOWN', he: 'UNKNOWN' } })])
    expect(store.alerts).toEqual([])
    expect(store.primed).toBe(true)
  })

  it('does not prime on an empty batch, so the real first batch is still silent', () => {
    store.ingest([])
    expect(store.primed).toBe(false)
    store.ingest([sample(T0, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts).toEqual([])
  })

  it('lets a condition that starts after the baseline through', () => {
    primed(store)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN', he: 'UNKNOWN' } })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1'])
  })
})

describe('serverDown', () => {
  beforeEach(() => primed(store))

  it('raises an error the moment a server leaves RUNNING', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'FAILED', he: 'CRITICAL' } })])
    const [alert] = store.alerts
    expect(alert).toMatchObject({ key: 'down:ms1', severity: 'error', server: 'ms1' })
    expect(alert.title).toContain('ms1')
  })

  it('says it once, however long the server stays down', () => {
    for (let i = 1; i <= 10; i += 1) store.ingest([sample(T0 + i * 15_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts.filter((alert) => alert.key === 'down:ms1')).toHaveLength(1)
  })

  it('says so again when the server comes back', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.ingest([sample(T0 + 30_000, { ms1: running() })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1:clear', 'down:ms1'])
    expect(store.alerts[0].severity).toBe('info')
  })

  it('can fire a second time after a recovery', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.ingest([sample(T0 + 30_000, { ms1: running() })])
    store.ingest([sample(T0 + 45_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts.filter((alert) => alert.key === 'down:ms1')).toHaveLength(2)
  })

  it('stays quiet about a server whose state the AdminServer could not read', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'UNKNOWN' } })])
    expect(store.alerts).toEqual([])
  })

  it('can be turned off', () => {
    store.setRule('serverDown', false)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts).toEqual([])
  })
})

describe('a level has to hold before it is announced', () => {
  beforeEach(() => primed(store))

  it('says nothing about a heap that crosses for one sample', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) })])
    expect(store.alerts).toEqual([])
  })

  it('announces it once it has held for the sustain window', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) })])
    store.ingest([sample(T0 + 15_000 + DEFAULT_RULES.sustainMs, { ms1: running({ hu: 95, hm: 100 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['heap:ms1'])
  })

  it('judges the window on when the readings were taken, not when they were read', () => {
    // A batch of backlogged history arrives at once; the timestamps decide.
    store.ingest([
      sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) }),
      sample(T0 + 90_000, { ms1: running({ hu: 95, hm: 100 }) }),
    ])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['heap:ms1'])
  })

  it('restarts the clock when the level drops back before the window is up', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) })])
    store.ingest([sample(T0 + 30_000, { ms1: running({ hu: 10, hm: 100 }) })])
    store.ingest([sample(T0 + 45_000, { ms1: running({ hu: 95, hm: 100 }) })])
    expect(store.alerts).toEqual([])
  })

  it('does not make an event wait, because an event is already news', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ sk: 3 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['stuck:ms1'])
  })

  it('announces at once when the sustain window is set to zero', () => {
    store.setRule('sustainMs', 0)
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['heap:ms1'])
  })
})

describe('the individual rules', () => {
  beforeEach(() => {
    store.setRule('sustainMs', 0)
    primed(store)
  })

  it('counts one stuck thread as one, in its own words', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ sk: 1 }) })])
    expect(store.alerts[0].title).toContain('1 stuck thread')
  })

  it('reports a queue only when the rule is above zero', () => {
    store.setRule('queueLength', 0)
    store.ingest([sample(T0 + 15_000, { ms1: running({ q: 500 }) })])
    expect(store.alerts).toEqual([])
  })

  it('reports a queue past the threshold', () => {
    store.setRule('queueLength', 50)
    store.ingest([sample(T0 + 15_000, { ms1: running({ q: 50 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['queue:ms1'])
  })

  it('reports threads queuing for a database connection', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ dsw: 4 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['jdbc:ms1'])
    expect(store.alerts[0].detail).toContain('4')
  })

  it('leaves JMS alone by default, since a pending message is normal', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ jmp: 900 }) })])
    expect(store.alerts).toEqual([])
  })

  it('reports pending JMS messages once a threshold is set', () => {
    store.setRule('jmsPending', 100)
    store.ingest([sample(T0 + 15_000, { ms1: running({ jmp: 900 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['jms:ms1'])
  })

  it('reports a running server that does not consider itself healthy', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ he: 'WARN' }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['health:ms1'])
  })

  it('does not call an unreadable health state unhealthy', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ he: 'UNKNOWN' }) })])
    expect(store.alerts).toEqual([])
  })

  it('says nothing about the thread pool of a server that is not running', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN', sk: 5, q: 900 } })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1'])
  })

  it('does not congratulate a server on recovering when it has actually died', () => {
    // A server alerting on heap and stuck threads that then crashes must
    // report the crash and nothing else: "heap is back under 90% — garbage
    // collection recovered the memory" is false, and it lands in the log at
    // the exact moment somebody is reading it to find out what happened.
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100, sk: 3, he: 'CRITICAL' }) })])
    expect(store.alerts.map((alert) => alert.key).sort()).toEqual(['health:ms1', 'heap:ms1', 'stuck:ms1'])

    store.clear()
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'FAILED', he: 'UNKNOWN' } })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1'])
  })

  it('still reports a real recovery, where the server stayed up', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ hu: 95, hm: 100 }) })])
    store.clear()
    store.ingest([sample(T0 + 30_000, { ms1: running({ hu: 10, hm: 100 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['heap:ms1:clear'])
  })

  it('does not re-announce a condition that was still true when the server died', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ sk: 3 }) })])
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'FAILED' } })])
    store.clear()
    store.ingest([sample(T0 + 45_000, { ms1: running({ sk: 3 }) })])
    // The server came back still stuck: that is news again, and it is the
    // stuck alert rather than a recovery.
    expect(store.alerts.map((alert) => alert.key)).toEqual(['stuck:ms1', 'down:ms1:clear'])
  })
})

describe('restarts', () => {
  it('spots a JVM whose start time moved', () => {
    primed(store, { ms1: running({ ac: 1000 }) })
    store.ingest([sample(T0 + 15_000, { ms1: running({ ac: 2000 }) })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['restart:ms1:2000'])
  })

  it('says nothing while the start time holds still', () => {
    primed(store, { ms1: running({ ac: 1000 }) })
    store.ingest([sample(T0 + 15_000, { ms1: running({ ac: 1000 }) })])
    expect(store.alerts).toEqual([])
  })

  it('says nothing on the first start time it ever sees', () => {
    primed(store, { ms1: running() })
    store.ingest([sample(T0 + 15_000, { ms1: running({ ac: 2000 }) })])
    expect(store.alerts).toEqual([])
  })

  it('can be turned off', () => {
    store.setRule('restart', false)
    primed(store, { ms1: running({ ac: 1000 }) })
    store.ingest([sample(T0 + 15_000, { ms1: running({ ac: 2000 }) })])
    expect(store.alerts).toEqual([])
  })
})

describe('a heap that climbs', () => {
  it('is reported on shape rather than on level', () => {
    store.setRule('heapRisePercent', 20)
    store.setRule('heapRiseMinutes', 10)
    // Ten minutes of readings climbing from 10% to 60%: never near any ceiling.
    for (let minute = 0; minute <= 10; minute += 1) {
      store.ingest([sample(T0 + minute * 60_000, { ms1: running({ hu: 10 + minute * 5, hm: 100 }) })])
    }
    expect(store.alerts.map((alert) => alert.key)).toContain('heaprise:ms1')
  })

  it('says nothing about a tail that does not yet cover its window', () => {
    store.setRule('heapRisePercent', 20)
    primed(store, { ms1: running({ hu: 10, hm: 100 }) })
    store.ingest([sample(T0 + 60_000, { ms1: running({ hu: 90, hm: 100 }) })])
    expect(store.heapRise('ms1')).toBeNull()
  })

  it('can be turned off with a threshold of zero', () => {
    store.setRule('heapRisePercent', 0)
    for (let minute = 0; minute <= 10; minute += 1) {
      store.ingest([sample(T0 + minute * 60_000, { ms1: running({ hu: 10 + minute * 5, hm: 100 }) })])
    }
    expect(store.alerts.map((alert) => alert.key)).not.toContain('heaprise:ms1')
  })
})

describe('per-server thresholds', () => {
  it('falls back to the domain rule when a server has none', () => {
    expect(store.ruleFor('ms1', 'heapPercent')).toBe(DEFAULT_RULES.heapPercent)
  })

  it('uses a server’s own threshold instead', () => {
    store.setOverride('AdminServer', 'heapPercent', 98)
    expect(store.ruleFor('AdminServer', 'heapPercent')).toBe(98)
    expect(store.ruleFor('ms1', 'heapPercent')).toBe(DEFAULT_RULES.heapPercent)
  })

  it('lets an AdminServer idle high while a managed server does not', () => {
    store.setRule('sustainMs', 0)
    store.setOverride('AdminServer', 'heapPercent', 98)
    primed(store, { AdminServer: running(), ms1: running() })
    store.ingest([
      sample(T0 + 15_000, {
        AdminServer: running({ hu: 92, hm: 100 }),
        ms1: running({ hu: 92, hm: 100 }),
      }),
    ])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['heap:ms1'])
  })

  it('drops an override back to the default when it is cleared', () => {
    store.setOverride('ms1', 'heapPercent', 98)
    store.setOverride('ms1', 'heapPercent', '')
    expect(store.overrides).toEqual({})
    expect(store.overriddenServers).toEqual([])
  })

  it('forgets one server’s overrides, or everyone’s', () => {
    store.setOverride('ms1', 'heapPercent', 98)
    store.setOverride('ms2', 'heapPercent', 70)
    store.clearOverrides('ms1')
    expect(store.overriddenServers).toEqual(['ms2'])
    store.clearOverrides()
    expect(store.overrides).toEqual({})
  })

  it('survives a reload', () => {
    store.setOverride('ms1', 'heapPercent', 98)
    setActivePinia(createPinia())
    expect(useAlertsStore().ruleFor('ms1', 'heapPercent')).toBe(98)
  })
})

describe('snoozing a server', () => {
  beforeEach(() => {
    store.setRule('sustainMs', 0)
    primed(store, { ms1: running(), ms2: running() })
  })

  it('silences that server and no other', () => {
    store.snooze('ms1', 60_000)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' }, ms2: { st: 'SHUTDOWN' } })])
    expect(store.alerts.map((alert) => alert.server)).toEqual(['ms2'])
  })

  it('reports how long is left, and forgets a snooze that has expired', () => {
    store.snooze('ms1', 60_000)
    expect(store.snoozedUntil('ms1')).toBeGreaterThan(Date.now())
    expect(store.anySnoozed).toBe(true)
    store.snoozed = { ms1: Date.now() - 1 }
    expect(store.snoozedUntil('ms1')).toBeNull()
    expect(store.anySnoozed).toBe(false)
  })

  it('is lifted by snoozing for nothing', () => {
    store.snooze('ms1', 60_000)
    store.snooze('ms1', 0)
    expect(store.snoozed).toEqual({})
  })

  it('keeps the bookkeeping running underneath, so nothing double-fires', () => {
    store.snooze('ms1', 60_000)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.snooze('ms1', 0)
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'SHUTDOWN' } })])
    // The condition already rose while snoozed; it is not re-announced.
    expect(store.alerts.filter((alert) => alert.server === 'ms1')).toEqual([])
  })
})

describe('the clusters the bell speaks for', () => {
  beforeEach(async () => {
    wls.configuredServers.mockResolvedValue(TOPOLOGY)
    store.setRule('sustainMs', 0)
    await store.readTopology()
    primed(store, { AdminServer: running(), ms1: running(), ms2: running() })
  })

  it('reads which cluster each server is configured into, standalone included', () => {
    expect(store.membership).toEqual({ AdminServer: '', ms1: 'payments', ms2: 'reporting' })
    expect(store.clusterOf('ms1')).toBe('payments')
  })

  it('reads the domain once, however many batches of samples arrive', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running() })])
    store.ingest([sample(T0 + 30_000, { ms1: running() })])
    expect(wls.configuredServers).toHaveBeenCalledTimes(1)
  })

  it('says nothing about a cluster nobody is watching', () => {
    store.watchCluster('reporting', false)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' }, ms2: { st: 'SHUTDOWN' } })])
    expect(store.alerts.map((alert) => alert.server)).toEqual(['ms1'])
  })

  it('can leave out the servers that are in no cluster', () => {
    store.watchCluster('', false)
    store.ingest([sample(T0 + 15_000, { AdminServer: { st: 'SHUTDOWN' }, ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts.map((alert) => alert.server)).toEqual(['ms1'])
  })

  it('watches a server it cannot place, rather than silencing the domain by accident', () => {
    store.watchCluster('', false)
    store.ingest([sample(T0 + 15_000, { ms9: { st: 'SHUTDOWN' } })])
    expect(store.alerts.map((alert) => alert.server)).toEqual(['ms9'])
    expect(store.unwatchedServer('ms9')).toBe(false)
  })

  it('keeps the bookkeeping running underneath, the way a snooze does', () => {
    store.watchCluster('payments', false)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.watchCluster('payments', true)
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts).toEqual([])
    // The recovery is news again, because the watch is back on by then.
    store.ingest([sample(T0 + 45_000, { ms1: running() })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1:clear'])
  })

  it('remembers the choice, and admits to it on the bell', () => {
    store.watchCluster('reporting', false)
    expect(store.unwatchedClusters).toEqual(['reporting'])
    expect(store.anyMuted).toBe(true)
    setActivePinia(createPinia())
    expect(useAlertsStore().unwatched).toEqual({ reporting: true })
  })

  it('offers every cluster back, listing the standalone servers last', () => {
    store.watchCluster('reporting', false)
    expect(store.watchGroups).toEqual([
      { cluster: 'payments', servers: ['ms1'], watched: true },
      { cluster: 'reporting', servers: ['ms2'], watched: false },
      { cluster: '', servers: ['AdminServer'], watched: true },
    ])
    store.watchEverything()
    expect(store.unwatchedClusters).toEqual([])
    expect(store.anyMuted).toBe(false)
  })

  it('still lists a cluster that is not in this domain, so it can be taken back', () => {
    store.watchCluster('elsewhere', false)
    store.reset()
    expect(store.membership).toEqual({})
    expect(store.watchGroups).toEqual([{ cluster: 'elsewhere', servers: [], watched: false }])
  })

  it('leaves the domain unfiltered when its configuration cannot be read', async () => {
    store.reset()
    wls.configuredServers.mockRejectedValue(new Error('403'))
    await store.readTopology()
    expect(store.membership).toEqual({})
    // And does not ask again on every sample that arrives afterwards.
    store.ingest([sample(T0 + 15_000, { ms1: running() })])
    expect(wls.configuredServers).toHaveBeenCalledTimes(2)
  })
})

describe('the alert log', () => {
  beforeEach(() => {
    store.setRule('sustainMs', 0)
    primed(store)
  })

  it('puts the newest alert first', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ sk: 1 }) })])
    store.ingest([sample(T0 + 30_000, { ms1: running({ sk: 0 }) })])
    expect(store.alerts[0].key).toBe('stuck:ms1:clear')
    expect(store.alerts[1].key).toBe('stuck:ms1')
  })

  it('counts unread alerts and reports the worst of them', () => {
    store.ingest([sample(T0 + 15_000, { ms1: running({ he: 'WARN' }) })])
    expect(store.unread).toBe(1)
    expect(store.worst).toBe('warn')
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.worst).toBe('error')
  })

  it('marks nothing unread while the panel is open', () => {
    store.open = true
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.unread).toBe(0)
    expect(store.worst).toBe('none')
  })

  it('puts the unread count in the tab title', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(document.title).toMatch(/^\(1\) /)
    store.markAllRead()
    expect(document.title).not.toMatch(/^\(/)
  })

  it('keeps at most two hundred alerts', () => {
    for (let i = 0; i < 250; i += 1) store.raise({ key: `k${i}`, title: `alert ${i}` })
    expect(store.alerts).toHaveLength(200)
    expect(store.alerts[0].title).toBe('alert 249')
  })

  it('survives a reload, still unread', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    setActivePinia(createPinia())
    const reloaded = useAlertsStore()
    expect(reloaded.alerts).toHaveLength(1)
    expect(reloaded.unread).toBe(1)
  })

  it('does not read back alerts older than a day', () => {
    store.raise({ key: 'old', title: 'yesterday' })
    const stored = JSON.parse(localStorage.getItem('wl-console.alerts.log'))
    stored[0].at = Date.now() - 25 * 60 * 60 * 1000
    localStorage.setItem('wl-console.alerts.log', JSON.stringify(stored))
    setActivePinia(createPinia())
    expect(useAlertsStore().alerts).toEqual([])
  })

  it('is emptied by clear, badge and all', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.clear()
    expect(store.alerts).toEqual([])
    expect(store.unread).toBe(0)
    expect(document.title).not.toMatch(/^\(/)
  })

  it('starts over when the domain is switched', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    store.reset()
    expect(store.alerts).toEqual([])
    expect(store.primed).toBe(false)
    // The conditions went with it, so the same state is news again.
    primed(store)
    store.ingest([sample(T0 + 30_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(store.alerts.map((alert) => alert.key)).toEqual(['down:ms1'])
  })
})

describe('forwarding to the backend webhook', () => {
  beforeEach(() => {
    store.setRule('sustainMs', 0)
    primed(store)
  })

  it('stays in the browser unless forwarding is on and a webhook exists', () => {
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })])
    expect(api.notify).not.toHaveBeenCalled()
  })

  it('forwards once both are true', () => {
    store.setForward(true)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })], { webhook: true })
    expect(api.notify).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', server: 'ms1' }))
  })

  it('does not forward a recovery, which is only worth reading in the console', () => {
    store.setForward(true)
    store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })], { webhook: true })
    api.notify.mockClear()
    store.ingest([sample(T0 + 30_000, { ms1: running() })])
    expect(api.notify).not.toHaveBeenCalled()
  })

  it('does not fail an alert when the forward does', () => {
    api.notify.mockRejectedValueOnce(new Error('unreachable'))
    store.setForward(true)
    expect(() => store.ingest([sample(T0 + 15_000, { ms1: { st: 'SHUTDOWN' } })], { webhook: true })).not.toThrow()
    expect(store.alerts).toHaveLength(1)
  })
})

describe('rules', () => {
  it('starts from the defaults and remembers a change', () => {
    expect(store.rules).toEqual(DEFAULT_RULES)
    store.setRule('heapPercent', 75)
    setActivePinia(createPinia())
    expect(useAlertsStore().rules.heapPercent).toBe(75)
  })

  it('picks up a rule added since the saved copy was written', () => {
    localStorage.setItem('wl-console.alerts.rules', JSON.stringify({ heapPercent: 75 }))
    setActivePinia(createPinia())
    const reloaded = useAlertsStore()
    expect(reloaded.rules.heapPercent).toBe(75)
    expect(reloaded.rules.sustainMs).toBe(DEFAULT_RULES.sustainMs)
  })

  it('ignores a saved copy that is not usable', () => {
    localStorage.setItem('wl-console.alerts.rules', 'not json')
    setActivePinia(createPinia())
    expect(useAlertsStore().rules).toEqual(DEFAULT_RULES)
  })

  it('goes back to the defaults on request', () => {
    store.setRule('heapPercent', 75)
    store.resetRules()
    expect(store.rules).toEqual(DEFAULT_RULES)
    expect(localStorage.getItem('wl-console.alerts.rules')).toBeNull()
  })
})
