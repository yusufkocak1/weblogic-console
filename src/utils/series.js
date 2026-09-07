/**
 * The arithmetic behind the charts.
 *
 * A runtime series is a list of `{t, v}` readings, and almost every question
 * worth asking about one is a small calculation over it rather than the newest
 * value: is the heap's floor rising, how often is garbage collection running,
 * how much of the last hour did the thread pool spend full. Those calculations
 * live here, apart from the store that holds the samples and the component that
 * draws them, because they are the part with an answer that can be wrong.
 *
 * Everything here takes and returns plain arrays, and every function tolerates
 * an empty one: a console that has been open for ten seconds has no history,
 * and that is a normal state, not an error.
 */

/** Smallest and largest, the mean, and the ends. Null when there is nothing. */
export function stats(points) {
  if (!points?.length) return { min: null, max: null, avg: null, first: null, last: null, count: 0 }
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (const point of points) {
    if (point.v < min) min = point.v
    if (point.v > max) max = point.v
    sum += point.v
  }
  return {
    min,
    max,
    avg: sum / points.length,
    first: points[0].v,
    last: points[points.length - 1].v,
    count: points.length,
  }
}

/**
 * The low-water mark: the lowest reading in each trailing window.
 *
 * This is the line that actually answers "is this a leak". A live heap
 * sawtooths — it climbs as objects are allocated and drops when garbage
 * collection runs — so the raw line tells you almost nothing about the trend.
 * What matters is where it lands *after* each collection: a floor that stays
 * put is healthy, a floor that climbs is memory that is never coming back.
 */
export function rollingMin(points, windowSize = 20) {
  if (!points?.length) return []
  const size = Math.max(2, Math.min(windowSize, points.length))
  const out = []
  for (let index = 0; index < points.length; index += 1) {
    const from = Math.max(0, index - size + 1)
    let min = Infinity
    for (let scan = from; scan <= index; scan += 1) {
      if (points[scan].v < min) min = points[scan].v
    }
    out.push({ t: points[index].t, v: min })
  }
  return out
}

/**
 * Least squares over the readings, reported per hour.
 *
 * Per hour rather than per millisecond because that is the unit the answer is
 * useful in: "the floor is rising about 4% an hour" is something you can turn
 * into "so it reaches the ceiling before the weekend".
 */
export function linearTrend(points) {
  if (!points || points.length < 3) return { perHour: 0, confident: false }
  const originT = points[0].t
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (const point of points) {
    const x = point.t - originT
    sumX += x
    sumY += point.v
    sumXY += x * point.v
    sumXX += x * x
  }
  const count = points.length
  const denominator = count * sumXX - sumX * sumX
  if (!denominator) return { perHour: 0, confident: false }
  const slope = (count * sumXY - sumX * sumY) / denominator

  // A slope drawn through twenty seconds of readings is noise wearing a
  // trend's clothes. Ten minutes is the shortest span worth reporting one for.
  const span = points[points.length - 1].t - originT
  return { perHour: slope * 3_600_000, confident: span >= 10 * 60_000 }
}

/**
 * How many times the series fell by at least `minDrop` between two readings.
 *
 * For a heap that is one garbage collection each — not the JVM's own count,
 * which WebLogic does not report over REST, but the same shape of answer: a
 * server collecting twice a minute is under memory pressure whatever its
 * current reading says.
 */
export function countDrops(points, minDrop) {
  if (!points || points.length < 2) return 0
  let drops = 0
  for (let index = 1; index < points.length; index += 1) {
    if (points[index - 1].v - points[index].v >= minDrop) drops += 1
  }
  return drops
}

/** Per hour, so a count over a short window is comparable with a long one. */
export function ratePerHour(count, spanMs) {
  if (!spanMs) return 0
  return (count * 3_600_000) / spanMs
}

/** The share of readings at or above a threshold, 0 to 1. */
export function fractionAtLeast(points, threshold) {
  if (!points?.length) return 0
  const hits = points.reduce((total, point) => total + (point.v >= threshold ? 1 : 0), 0)
  return hits / points.length
}

/**
 * Splits a series wherever the clock jumped.
 *
 * Sampling stops when the console process is restarted, when the AdminServer
 * is unreachable, and when a server is down — and the readings on either side
 * of that hole are not adjacent in time. Joining them with a straight line
 * draws a stretch of history that was never observed, which is exactly the
 * kind of quiet lie a monitoring page must not tell. So the gap is found here
 * and the chart leaves it blank.
 */
export function segments(points, gapMs) {
  if (!points?.length) return []
  const out = [[points[0]]]
  for (let index = 1; index < points.length; index += 1) {
    if (gapMs && points[index].t - points[index - 1].t > gapMs) out.push([])
    out[out.length - 1].push(points[index])
  }
  return out.filter((segment) => segment.length)
}

/**
 * Differences of a monotonic counter, as a rate per minute.
 *
 * WebLogic reports transactions and JMS messages as totals since server start,
 * and a total is a chart with no shape. The rate is the interesting series —
 * and a total that went backwards means the server restarted, so that step is
 * dropped rather than drawn as a large negative rate.
 */
export function perMinute(points) {
  if (!points || points.length < 2) return []
  const out = []
  for (let index = 1; index < points.length; index += 1) {
    const elapsed = points[index].t - points[index - 1].t
    const delta = points[index].v - points[index - 1].v
    if (elapsed <= 0 || delta < 0) continue
    out.push({ t: points[index].t, v: (delta * 60_000) / elapsed })
  }
  return out
}
