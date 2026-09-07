import { describe, expect, it } from 'vitest'
import {
  countDrops,
  fractionAtLeast,
  linearTrend,
  perMinute,
  ratePerHour,
  rollingMin,
  segments,
  stats,
} from '@/utils/series'

/** `{t, v}` readings a minute apart, which is the shape the store hands out. */
const at = (values, stepMs = 60_000, start = 1_700_000_000_000) =>
  values.map((v, index) => ({ t: start + index * stepMs, v }))

describe('stats', () => {
  it('reports nothing for an empty series', () => {
    expect(stats([])).toEqual({ min: null, max: null, avg: null, first: null, last: null, count: 0 })
    expect(stats(undefined)).toEqual({ min: null, max: null, avg: null, first: null, last: null, count: 0 })
  })

  it('summarises the readings, keeping the ends in time order', () => {
    expect(stats(at([10, 4, 7]))).toEqual({ min: 4, max: 10, avg: 7, first: 10, last: 7, count: 3 })
  })

  it('handles a single reading', () => {
    expect(stats(at([5]))).toMatchObject({ min: 5, max: 5, avg: 5, first: 5, last: 5, count: 1 })
  })

  it('keeps negative readings', () => {
    expect(stats(at([-3, 1]))).toMatchObject({ min: -3, max: 1, avg: -1 })
  })
})

describe('rollingMin', () => {
  it('is empty for an empty series', () => {
    expect(rollingMin([])).toEqual([])
  })

  it('reports the lowest reading in each trailing window', () => {
    const out = rollingMin(at([5, 3, 4, 9, 8]), 3)
    expect(out.map((point) => point.v)).toEqual([5, 3, 3, 3, 4])
  })

  it('keeps the timestamp of the reading the window ends on', () => {
    const points = at([5, 3, 4])
    expect(rollingMin(points, 2).map((point) => point.t)).toEqual(points.map((point) => point.t))
  })

  it('never uses a window narrower than two readings', () => {
    // A window of one would just echo the series back and hide every floor.
    expect(rollingMin(at([5, 3, 4]), 1).map((point) => point.v)).toEqual([5, 3, 3])
  })

  it('clamps a window wider than the series', () => {
    expect(rollingMin(at([5, 3, 4]), 999).map((point) => point.v)).toEqual([5, 3, 3])
  })
})

describe('linearTrend', () => {
  it('will not draw a slope through fewer than three readings', () => {
    expect(linearTrend(at([1, 2]))).toEqual({ perHour: 0, confident: false })
  })

  it('reports the slope per hour', () => {
    // One point per minute for an hour: sixty points an hour apart in slope.
    const trend = linearTrend(at([...Array(61).keys()]))
    expect(trend.perHour).toBeCloseTo(60, 6)
    expect(trend.confident).toBe(true)
  })

  it('is not confident about a slope drawn through under ten minutes', () => {
    const trend = linearTrend(at([1, 2, 3, 4], 60_000))
    expect(trend.perHour).toBeCloseTo(60, 6)
    expect(trend.confident).toBe(false)
  })

  it('reports a falling series as a negative slope', () => {
    expect(linearTrend(at([10, 8, 6, 4, 2, 0], 2 * 60_000)).perHour).toBeCloseTo(-60, 6)
  })

  it('reports no slope when every reading was taken at the same moment', () => {
    const same = [1, 2, 3].map((v) => ({ t: 5, v }))
    expect(linearTrend(same)).toEqual({ perHour: 0, confident: false })
  })
})

describe('countDrops', () => {
  it('counts only falls of at least the given size', () => {
    expect(countDrops(at([10, 4, 9, 8, 2]), 5)).toBe(2)
    expect(countDrops(at([10, 4, 9, 8, 2]), 7)).toBe(0)
    expect(countDrops(at([10, 4, 9, 8, 2]), 1)).toBe(3)
  })

  it('is zero for a series too short to have a step', () => {
    expect(countDrops(at([10]), 1)).toBe(0)
    expect(countDrops(undefined, 1)).toBe(0)
  })

  it('does not count a rise', () => {
    expect(countDrops(at([1, 2, 3]), 0.5)).toBe(0)
  })
})

describe('ratePerHour', () => {
  it('scales a count over a span to an hour', () => {
    expect(ratePerHour(3, 30 * 60_000)).toBe(6)
  })

  it('is zero rather than infinite when nothing was observed', () => {
    expect(ratePerHour(5, 0)).toBe(0)
  })
})

describe('fractionAtLeast', () => {
  it('is the share of readings at or above the threshold', () => {
    expect(fractionAtLeast(at([10, 90, 95, 20]), 90)).toBe(0.5)
  })

  it('is zero for an empty series rather than NaN', () => {
    expect(fractionAtLeast([], 90)).toBe(0)
  })
})

describe('segments', () => {
  it('is empty for an empty series', () => {
    expect(segments([], 1000)).toEqual([])
  })

  it('keeps one unbroken stretch when every reading is close enough', () => {
    const points = at([1, 2, 3], 10_000)
    expect(segments(points, 30_000)).toEqual([points])
  })

  it('breaks where the clock jumped', () => {
    const points = [
      { t: 0, v: 1 },
      { t: 10_000, v: 2 },
      { t: 600_000, v: 3 },
      { t: 610_000, v: 4 },
    ]
    const out = segments(points, 30_000)
    expect(out).toHaveLength(2)
    expect(out[0].map((p) => p.v)).toEqual([1, 2])
    expect(out[1].map((p) => p.v)).toEqual([3, 4])
  })

  it('never breaks when no gap is given', () => {
    const points = at([1, 2, 3], 24 * 3_600_000)
    expect(segments(points, 0)).toHaveLength(1)
  })
})

describe('perMinute', () => {
  it('turns a rising total into a rate', () => {
    // 60 more over one minute is 60 a minute.
    expect(perMinute(at([0, 60, 120])).map((point) => point.v)).toEqual([60, 60])
  })

  it('drops the step where a counter went backwards, which means a restart', () => {
    const out = perMinute(at([100, 160, 5, 65]))
    expect(out.map((point) => point.v)).toEqual([60, 60])
    // The surviving steps are the two that actually rose.
    expect(out).toHaveLength(2)
  })

  it('drops a step with no elapsed time rather than dividing by zero', () => {
    const points = [
      { t: 1000, v: 0 },
      { t: 1000, v: 10 },
    ]
    expect(perMinute(points)).toEqual([])
  })

  it('needs two readings', () => {
    expect(perMinute(at([5]))).toEqual([])
    expect(perMinute(null)).toEqual([])
  })

  it('stamps each rate with the moment the later reading was taken', () => {
    const points = at([0, 60])
    expect(perMinute(points)[0].t).toBe(points[1].t)
  })
})
