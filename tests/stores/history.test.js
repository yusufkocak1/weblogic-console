import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({ history: vi.fn() }))

import * as api from '@/api/client'
import { useAlertsStore } from '@/stores/alerts'
import { EXPORT_COLUMNS, useHistoryStore, WINDOW_OPTIONS } from '@/stores/history'

const T0 = 1_700_000_000_000

const sample = (t, servers) => ({ t, servers })
const running = (extra = {}) => ({ st: 'RUNNING', he: 'OK', tt: 20, tb: 5, tp: 100, hu: 50, hm: 100, ...extra })
/** A server that is down reports its state and nothing else. */
const down = () => ({ st: 'SHUTDOWN', he: 'UNKNOWN' })

let store

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(T0 + 60_000)
  setActivePinia(createPinia())
  store = useHistoryStore()
  useAlertsStore().reset()
})

afterEach(() => vi.useRealTimers())

describe('the window', () => {
  it('defaults to an hour', () => {
    expect(store.windowMs).toBe(60 * 60_000)
  })

  it('remembers a choice, and ignores one that is not on offer', () => {
    store.setWindow(15 * 60_000)
    setActivePinia(createPinia())
    expect(useHistoryStore().windowMs).toBe(15 * 60_000)

    localStorage.setItem('wl-console.history.window', '999')
    setActivePinia(createPinia())
    expect(useHistoryStore().windowMs).toBe(60 * 60_000)
  })

  it('offers "All", which keeps every sample held', () => {
    expect(WINDOW_OPTIONS.map((option) => option.value)).toContain(0)
    store.samples = [sample(T0 - 24 * 3_600_000, { ms1: running() }), sample(T0, { ms1: running() })]
    store.setWindow(0)
    expect(store.windowed).toHaveLength(2)
  })

  it('drops samples older than the window', () => {
    store.samples = [sample(T0 - 2 * 3_600_000, { ms1: running() }), sample(T0, { ms1: running() })]
    store.setWindow(60 * 60_000)
    expect(store.windowed.map((s) => s.t)).toEqual([T0])
  })

  it('breaks a line at two and a half sampling intervals', () => {
    store.intervalMs = 15_000
    expect(store.gapMs).toBe(37_500)
  })

  it('describes itself as a sentence', () => {
    store.samples = [sample(T0 - 30 * 60_000, { ms1: running() }), sample(T0, { ms1: running() })]
    expect(store.windowLabel).toBe('last 30 min')
    store.samples = [sample(T0 - 2 * 3_600_000, { ms1: running() }), sample(T0, { ms1: running() })]
    store.setWindow(0)
    expect(store.windowLabel).toBe('last 2.0 h')
  })

  it('says it is still building up before there is a span', () => {
    expect(store.span).toBe(0)
    expect(store.windowLabel).toBe('building up')
  })
})

describe('points', () => {
  beforeEach(() => {
    store.setWindow(0)
  })

  it('is empty for a server that has never been seen', () => {
    store.samples = [sample(T0, { ms1: running() })]
    expect(store.points('ms2', 'tb')).toEqual([])
  })

  it('carries the moment each reading was taken', () => {
    store.samples = [sample(T0, { ms1: running({ tb: 5 }) }), sample(T0 + 15_000, { ms1: running({ tb: 7 }) })]
    expect(store.points('ms1', 'tb')).toEqual([
      { t: T0, v: 5 },
      { t: T0 + 15_000, v: 7 },
    ])
  })

  it('leaves a hole where a server was down, rather than drawing a zero', () => {
    store.samples = [
      sample(T0, { ms1: running({ tb: 5 }) }),
      sample(T0 + 15_000, { ms1: down() }),
      sample(T0 + 30_000, { ms1: running({ tb: 6 }) }),
    ]
    expect(store.points('ms1', 'tb').map((point) => point.t)).toEqual([T0, T0 + 30_000])
  })

  it('reads a key the backend omits because it was zero as zero', () => {
    // dsw is only stored when it is non-zero, but the server was up, so the
    // reading did happen and it was nought.
    store.samples = [sample(T0, { ms1: running() })]
    expect(store.points('ms1', 'dsw')).toEqual([{ t: T0, v: 0 }])
  })

  it('does not invent a zero for a server that was not running', () => {
    store.samples = [sample(T0, { ms1: down() })]
    expect(store.points('ms1', 'dsw')).toEqual([])
  })

  it('does not invent a zero for a key that is never omitted', () => {
    store.samples = [sample(T0, { ms1: { st: 'RUNNING', tt: 20 } })]
    expect(store.points('ms1', 'tb')).toEqual([])
  })

  it('reads the heap as a percentage of the maximum', () => {
    store.samples = [sample(T0, { ms1: running({ hu: 30, hm: 120 }) })]
    expect(store.heapPercentPoints('ms1')).toEqual([{ t: T0, v: 25 }])
  })

  it('skips a sample with no heap maximum rather than dividing by zero', () => {
    store.samples = [sample(T0, { ms1: { st: 'RUNNING', hu: 30, hm: 0 } }), sample(T0 + 1, { ms1: down() })]
    expect(store.heapPercentPoints('ms1')).toEqual([])
  })
})

describe('names seen in the buffer', () => {
  beforeEach(() => store.setWindow(0))

  it('lists every server ever sampled, not only the ones running now', () => {
    store.samples = [sample(T0, { ms2: running(), ms1: running() }), sample(T0 + 15_000, { ms1: running() })]
    expect(store.serverNames).toEqual(['ms1', 'ms2'])
  })

  it('lists a server’s data sources', () => {
    store.samples = [sample(T0, { ms1: running({ ds: { dsB: { a: 1 }, dsA: { a: 2 } } }) })]
    expect(store.dataSourceNames('ms1')).toEqual(['dsA', 'dsB'])
  })

  it('has no data sources for a server it has not seen', () => {
    store.samples = [sample(T0, { ms1: running() })]
    expect(store.dataSourceNames('ms2')).toEqual([])
  })

  it('reads one data source’s series, zero-filling only where the server was up', () => {
    store.samples = [
      sample(T0, { ms1: running({ ds: { dsA: { a: 3 } } }) }),
      sample(T0 + 15_000, { ms1: running() }),
      sample(T0 + 30_000, { ms1: down() }),
    ]
    expect(store.dataSourcePoints('ms1', 'dsA', 'a')).toEqual([
      { t: T0, v: 3 },
      { t: T0 + 15_000, v: 0 },
    ])
  })
})

describe('restarts', () => {
  beforeEach(() => store.setWindow(0))

  it('spots a JVM start time that moved', () => {
    store.samples = [
      sample(T0, { ms1: running({ ac: 1000 }) }),
      sample(T0 + 15_000, { ms1: running({ ac: 1000 }) }),
      sample(T0 + 30_000, { ms1: running({ ac: 2000 }) }),
    ]
    expect(store.restarts('ms1')).toEqual([{ t: T0 + 30_000, activatedAt: 2000 }])
  })

  it('does not call the first start time it sees a restart', () => {
    store.samples = [sample(T0, { ms1: running({ ac: 1000 }) })]
    expect(store.restarts('ms1')).toEqual([])
  })

  it('ignores the samples where the server was down and reported no start time', () => {
    store.samples = [
      sample(T0, { ms1: running({ ac: 1000 }) }),
      sample(T0 + 15_000, { ms1: down() }),
      sample(T0 + 30_000, { ms1: running({ ac: 1000 }) }),
    ]
    expect(store.restarts('ms1')).toEqual([])
  })
})

describe('heapAnalysis', () => {
  beforeEach(() => store.setWindow(0))

  it('counts each collection and measures the span it saw them over', () => {
    // A sawtooth: allocate to 60, collect back to 30, allocate to 70, collect.
    store.samples = [20, 60, 30, 70, 40, 80].map((v, index) =>
      sample(T0 + index * 60_000, { ms1: running({ hu: v, hm: 100 }) }),
    )
    const analysis = store.heapAnalysis('ms1')
    expect(analysis.summary).toMatchObject({ min: 20, max: 80, count: 6 })
    // Two collections in five minutes: the 60→30 and 70→40 steps.
    expect(analysis.collectionsPerHour).toBeCloseTo((2 * 3_600_000) / (5 * 60_000), 6)
    expect(analysis.spanMs).toBe(5 * 60_000)
  })

  it('finds the rising floor underneath a sawtooth that never reaches a ceiling', () => {
    // Forty minutes of collect-and-climb: the peak never passes 70%, so no
    // level threshold would ever fire, but the floor moves from 20 to 40.
    store.samples = Array.from({ length: 40 }, (_, index) => {
      const floor = 20 + Math.floor(index / 2) / 2
      return sample(T0 + index * 60_000, {
        ms1: running({ hu: index % 2 ? floor + 30 : floor, hm: 100 }),
      })
    })
    const analysis = store.heapAnalysis('ms1')
    expect(analysis.perHour).toBeGreaterThan(0)
    expect(analysis.confident).toBe(true)
    // The floor is well below the readings it is drawn under.
    expect(analysis.floor.max).toBeLessThan(analysis.summary.max)
  })

  it('is not confident about a slope drawn through a couple of minutes', () => {
    store.samples = [20, 60, 30, 70].map((v, index) =>
      sample(T0 + index * 30_000, { ms1: running({ hu: v, hm: 100 }) }),
    )
    expect(store.heapAnalysis('ms1').confident).toBe(false)
  })

  it('answers with nothing rather than failing on an empty buffer', () => {
    const analysis = store.heapAnalysis('ms1')
    expect(analysis.points).toEqual([])
    expect(analysis.summary.count).toBe(0)
    expect(analysis.spanMs).toBe(0)
    expect(analysis.collectionsPerHour).toBe(0)
  })
})

describe('poolAnalysis', () => {
  beforeEach(() => store.setWindow(0))

  it('reports the share of the window the pool spent full', () => {
    store.samples = [
      sample(T0, { ms1: running({ tt: 10, tb: 10 }) }),
      sample(T0 + 15_000, { ms1: running({ tt: 10, tb: 1 }) }),
    ]
    expect(store.poolAnalysis('ms1').saturated).toBe(0.5)
  })

  it('divides throughput by the threads that did it', () => {
    store.samples = [sample(T0, { ms1: running({ tt: 10, tb: 4, tp: 40 }) })]
    expect(store.poolAnalysis('ms1').perThread).toBe(10)
  })

  it('ignores a sample where nothing was busy, rather than dividing by zero', () => {
    store.samples = [
      sample(T0, { ms1: running({ tt: 10, tb: 0, tp: 0 }) }),
      sample(T0 + 15_000, { ms1: running({ tt: 10, tb: 4, tp: 40 }) }),
    ]
    expect(store.poolAnalysis('ms1').perThread).toBe(10)
  })

  it('matches throughput to the busy count from the same moment', () => {
    // A buffer where one series has a reading the other lacks — history
    // written by an older console, or a release that reports no throughput.
    // Pairing the two by position would divide the second throughput by the
    // first busy count and report a figure that was never measured.
    store.samples = [
      sample(T0, { ms1: { st: 'RUNNING', tt: 10, tb: 1 } }),
      sample(T0 + 15_000, { ms1: { st: 'RUNNING', tt: 10, tb: 4, tp: 40 } }),
    ]
    expect(store.poolAnalysis('ms1').perThread).toBe(10)
  })

  it('has nothing to divide when no sample carried both', () => {
    store.samples = [sample(T0, { ms1: { st: 'RUNNING', tt: 10, tb: 4 } })]
    expect(store.poolAnalysis('ms1').perThread).toBeNull()
  })
})

describe('ratePoints', () => {
  beforeEach(() => store.setWindow(0))

  it('turns a total since server start into a rate per minute', () => {
    store.samples = [
      sample(T0, { ms1: running({ jtr: 10 }) }),
      sample(T0 + 60_000, { ms1: running({ jtr: 40 }) }),
    ]
    expect(store.ratePoints('ms1', 'jtr')).toEqual([{ t: T0 + 60_000, v: 30 }])
  })
})

describe('refresh', () => {
  const payload = (extra = {}) => ({
    sampling: true,
    intervalMs: 15000,
    retentionMs: 7_200_000,
    fileRetentionMs: 86_400_000,
    depth: 'full',
    webhook: false,
    error: null,
    samples: [],
    ...extra,
  })

  it('asks for everything the first time', async () => {
    api.history.mockResolvedValue(payload())
    await store.refresh()
    expect(api.history).toHaveBeenCalledWith(0)
  })

  it('asks only for what is newer than the newest sample it holds', async () => {
    api.history.mockResolvedValue(payload({ samples: [sample(T0, { ms1: running() })] }))
    await store.refresh()
    await store.refresh()
    expect(api.history).toHaveBeenLastCalledWith(T0)
  })

  it('appends what arrives rather than replacing what it has', async () => {
    api.history.mockResolvedValueOnce(payload({ samples: [sample(T0, { ms1: running() })] }))
    await store.refresh()
    api.history.mockResolvedValueOnce(payload({ samples: [sample(T0 + 15_000, { ms1: running() })] }))
    await store.refresh()
    expect(store.samples.map((s) => s.t)).toEqual([T0, T0 + 15_000])
  })

  it('takes the backend’s settings from the same answer', async () => {
    api.history.mockResolvedValue(payload({ sampling: false, depth: 'basic', webhook: true, intervalMs: 30000 }))
    await store.refresh()
    expect(store).toMatchObject({ sampling: false, depth: 'basic', webhook: true, intervalMs: 30000 })
  })

  it('keeps the interval it had when the backend reports none', async () => {
    api.history.mockResolvedValue(payload({ intervalMs: 0 }))
    await store.refresh()
    expect(store.intervalMs).toBe(15000)
  })

  it('hands new samples to the alert watcher', async () => {
    const alerts = useAlertsStore()
    const spy = vi.spyOn(alerts, 'ingest')
    api.history.mockResolvedValue(payload({ samples: [sample(T0, { ms1: running() })], webhook: true }))
    await store.refresh()
    expect(spy).toHaveBeenCalledWith([sample(T0, { ms1: running() })], { intervalMs: 15000, webhook: true })
  })

  it('does not wake the alert watcher when nothing new arrived', async () => {
    const spy = vi.spyOn(useAlertsStore(), 'ingest')
    api.history.mockResolvedValue(payload())
    await store.refresh()
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports a failure instead of throwing at whichever page is open', async () => {
    api.history.mockRejectedValue(Object.assign(new Error('boom'), { fullText: 'boom — detail' }))
    await expect(store.refresh()).resolves.toBeUndefined()
    expect(store.error).toBe('boom — detail')
  })

  it('passes on what the backend says went wrong at its end', async () => {
    api.history.mockResolvedValue(payload({ error: 'The AdminServer answered 503.' }))
    await store.refresh()
    expect(store.error).toBe('The AdminServer answered 503.')
  })
})

describe('start and stop', () => {
  it('empties the buffer when the domain changes, and not when it does not', async () => {
    api.history.mockResolvedValue({ samples: [] })
    store.samples = [sample(T0, { ms1: running() })]
    store.start('conn-1')
    expect(store.samples).toEqual([])

    store.samples = [sample(T0, { ms1: running() })]
    store.start('conn-1')
    expect(store.samples).toHaveLength(1)
    store.stop()
  })

  it('does not poll without a connection', () => {
    store.start(null)
    expect(store.polling).toBe(false)
  })

  it('stops polling on request', () => {
    api.history.mockResolvedValue({ samples: [] })
    store.start('conn-1')
    expect(store.polling).toBe(true)
    store.stop()
    expect(store.polling).toBe(false)
  })
})

describe('exportRows', () => {
  beforeEach(() => store.setWindow(0))

  it('writes one row per server per sample', () => {
    store.samples = [sample(T0, { ms1: running(), ms2: running() }), sample(T0 + 15_000, { ms1: running() })]
    expect(store.exportRows()).toHaveLength(3)
  })

  it('keeps only the servers asked for', () => {
    store.samples = [sample(T0, { ms1: running(), ms2: running() })]
    expect(store.exportRows(['ms2']).map((row) => row.server)).toEqual(['ms2'])
  })

  it('writes the time as an ISO timestamp a spreadsheet can sort', () => {
    store.samples = [sample(T0, { ms1: running() })]
    expect(store.exportRows()[0].time).toBe(new Date(T0).toISOString())
  })

  it('writes a heap percentage alongside the raw bytes', () => {
    store.samples = [sample(T0, { ms1: running({ hu: 30, hm: 120 }) })]
    expect(store.exportRows()[0]).toMatchObject({ heapUsedBytes: 30, heapMaxBytes: 120, heapPercent: '25.0' })
  })

  it('leaves a reading blank where a server was down, but a counter zero', () => {
    store.samples = [sample(T0, { ms1: down() })]
    const [row] = store.exportRows()
    expect(row).toMatchObject({ state: 'SHUTDOWN', threadsBusy: '', heapUsedBytes: '', heapPercent: '' })
    expect(row.jdbcWaiting).toBe(0)
  })

  it('has a column defined for every field it writes', () => {
    store.samples = [sample(T0, { ms1: running() })]
    const columns = EXPORT_COLUMNS.map((column) => column.key)
    expect(Object.keys(store.exportRows()[0]).sort()).toEqual([...columns].sort())
  })

  it('names every column, since the labels are read at export time', () => {
    expect(EXPORT_COLUMNS.every((column) => typeof column.label() === 'string' && column.label())).toBe(true)
  })
})
