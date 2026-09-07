<script setup>
import { computed, ref } from 'vue'
import { segments } from '@/utils/series'

/**
 * A number's recent history, drawn small enough to sit beside the number.
 *
 * There is no charting library behind this: a polyline over a viewBox scales to
 * whatever width it is given, reads correctly in both themes, and costs nothing
 * to render forty times on a dashboard.
 *
 * Two things it does that a plain polyline does not, both because the first
 * version quietly got them wrong:
 *
 * The x axis is time, not position. Readings arrive on a timer, but the timer
 * stops — the console is restarted, the AdminServer is unreachable, a server is
 * down — and spacing the readings evenly would draw those hours as though they
 * had been observed. A hole wider than `gapMs` breaks the line instead.
 *
 * And it can be read. A line whose only detail is a `title` attribute answers
 * "roughly what shape" and nothing else; hovering here gives the reading and
 * the moment it was taken, which is what somebody comparing a chart against a
 * log timestamp actually needs.
 */
const props = defineProps({
  /** `{t, v}` readings — the form the history store hands out. */
  points: { type: Array, default: () => [] },
  /** Bare numbers, spaced evenly. Only for a series with no timestamps. */
  values: { type: Array, default: () => [] },
  /**
   * Several series on one pair of axes: `{name, points, tone?}`. This is how
   * one cluster's servers are compared — the outlier is obvious drawn together
   * and invisible drawn as six separate cards.
   */
  series: { type: Array, default: () => [] },
  /** A second, dashed line under the main one — the heap's floor, usually. */
  baseline: { type: Array, default: () => [] },
  /** Upper bound of the scale. Omitted, the series' own maximum is used. */
  max: { type: Number, default: null },
  min: { type: Number, default: 0 },
  height: { type: Number, default: 28 },
  /** default | good | warn | bad — matched to what the number means. */
  tone: { type: String, default: 'default' },
  /** A horizontal line at the value that matters — an alert threshold. */
  threshold: { type: Number, default: null },
  /** Vertical ticks: `{t, label, tone}` for restarts and console changes. */
  markers: { type: Array, default: () => [] },
  /** Wider than this between two readings and the line breaks. 0 never breaks. */
  gapMs: { type: Number, default: 0 },
  /** Hover readout. Off for the very small ones, where there is nothing to hit. */
  interactive: { type: Boolean, default: false },
  /** Shows the scale and the ends of the time range under the chart. */
  axis: { type: Boolean, default: false },
  /** Turns a reading into the text shown for it. */
  format: { type: Function, default: null },
  unit: { type: String, default: '' },
  /** Shown when there is not enough history yet to draw anything. Empty falls
   *  back to a translated default at render time. */
  emptyText: { type: String, default: '' },
  title: { type: String, default: '' },
})

const WIDTH = 100

const TONES = {
  default: 'text-indigo-500 dark:text-indigo-400',
  good: 'text-emerald-500 dark:text-emerald-400',
  warn: 'text-amber-500 dark:text-amber-400',
  bad: 'text-red-500 dark:text-red-400',
}

/** Enough distinct hues for a cluster, in an order that stays legible. */
const OVERLAY_TONES = [
  'text-indigo-500 dark:text-indigo-400',
  'text-emerald-500 dark:text-emerald-400',
  'text-amber-500 dark:text-amber-400',
  'text-sky-500 dark:text-sky-400',
  'text-rose-500 dark:text-rose-400',
  'text-violet-500 dark:text-violet-400',
  'text-teal-500 dark:text-teal-400',
  'text-orange-500 dark:text-orange-400',
]

const hover = ref(null)

/** Every input shape becomes the same thing: named lists of `{t, v}`. */
const lines = computed(() => {
  if (props.series.length) {
    return props.series
      .filter((entry) => entry?.points?.length)
      .map((entry, index) => ({
        name: entry.name || '',
        points: entry.points,
        klass: entry.tone ? TONES[entry.tone] || TONES.default : OVERLAY_TONES[index % OVERLAY_TONES.length],
      }))
  }
  const points = props.points.length
    ? props.points.filter((point) => point && Number.isFinite(point.v))
    : // A bare array has no clock of its own, so it is given an artificial one
      // spaced at one millisecond. Nothing can gap, which is correct: without
      // timestamps there is no way to know whether it should.
      props.values.filter((value) => Number.isFinite(value)).map((value, index) => ({ t: index, v: value }))
  return points.length ? [{ name: '', points, klass: TONES[props.tone] || TONES.default }] : []
})

const hasData = computed(() => lines.value.some((line) => line.points.length >= 1))

/**
 * Whether the x axis is a clock. A caller that passed bare numbers has no
 * timestamps, so times must not be shown for it — a readout saying 03:00 in
 * 1970 is worse than no readout.
 */
const timed = computed(() => Boolean(props.series.length || props.points.length))

/** The time range every series is drawn against. */
const domain = computed(() => {
  let from = Infinity
  let to = -Infinity
  for (const line of lines.value) {
    if (line.points[0].t < from) from = line.points[0].t
    const last = line.points[line.points.length - 1].t
    if (last > to) to = last
  }
  for (const point of props.baseline) {
    if (point.t < from) from = point.t
    if (point.t > to) to = point.t
  }
  // A single reading, or several taken in the same millisecond, would divide by
  // zero; give it a span so it lands in the middle.
  return { from, to, span: to - from || 1 }
})

const scale = computed(() => {
  let high = props.max
  let low = props.min
  if (high === null) {
    high = 1
    for (const line of lines.value) for (const point of line.points) if (point.v > high) high = point.v
    if (props.threshold !== null && props.threshold > high) high = props.threshold
  }
  for (const line of lines.value) for (const point of line.points) if (point.v < low) low = point.v
  return { high, low, span: high - low || Math.abs(high) || 1 }
})

const x = (t) => ((t - domain.value.from) / domain.value.span) * WIDTH
const y = (v) => {
  const raw = props.height - ((v - scale.value.low) / scale.value.span) * props.height
  return Math.max(0, Math.min(props.height, raw))
}

const path = (points) => points.map((point) => `${x(point.t).toFixed(2)},${y(point.v).toFixed(2)}`).join(' ')

/**
 * Each series as one or more unbroken stretches, plus the same stretches
 * closed against the baseline so the area under them can be shaded.
 */
const drawn = computed(() =>
  lines.value.map((line) => {
    const parts = segments(line.points, props.gapMs)
    return {
      ...line,
      // A stretch of one reading has no line to draw, only a point.
      strokes: parts.filter((part) => part.length > 1).map(path),
      dots: parts.filter((part) => part.length === 1).map((part) => ({ x: x(part[0].t), y: y(part[0].v) })),
      areas:
        lines.value.length > 1
          ? []
          : parts
              .filter((part) => part.length > 1)
              .map(
                (part) =>
                  `${x(part[0].t).toFixed(2)},${props.height} ${path(part)} ` +
                  `${x(part[part.length - 1].t).toFixed(2)},${props.height}`,
              ),
    }
  }),
)

const baselinePath = computed(() =>
  props.baseline.length > 1 ? segments(props.baseline, props.gapMs).filter((part) => part.length > 1).map(path) : [],
)

const thresholdY = computed(() => {
  if (props.threshold === null || !hasData.value) return null
  const value = y(props.threshold)
  // Off the top or bottom of the scale it would sit on the frame and read as
  // decoration, so it is left out.
  return value <= 0.5 || value >= props.height - 0.5 ? null : value
})

const markerLines = computed(() =>
  hasData.value
    ? props.markers
        .filter((marker) => marker?.t >= domain.value.from && marker.t <= domain.value.to)
        .map((marker) => ({ ...marker, x: x(marker.t) }))
    : [],
)

const MARKER_TONES = {
  restart: 'text-red-400 dark:text-red-500',
  change: 'text-indigo-400 dark:text-indigo-500',
  default: 'text-zinc-400 dark:text-zinc-600',
}

const formatValue = (value) => {
  if (props.format) return props.format(value)
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(1))
  return props.unit ? `${rounded} ${props.unit}` : String(rounded)
}

const formatTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour12: false })

/** The reading nearest a moment, in one series. */
function nearest(points, at) {
  let best = points[0]
  let distance = Math.abs(best.t - at)
  for (const point of points) {
    const gap = Math.abs(point.t - at)
    if (gap < distance) {
      best = point
      distance = gap
    }
  }
  return best
}

function onMove(event) {
  if (!props.interactive || !hasData.value || !timed.value) return
  const box = event.currentTarget.getBoundingClientRect()
  if (!box.width) return
  const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  const at = domain.value.from + fraction * domain.value.span
  const readings = lines.value
    .map((line, index) => ({ name: line.name, klass: drawn.value[index].klass, point: nearest(line.points, at) }))
    // Past the end of a series that stopped early there is nothing to report,
    // and reporting its last reading as though it were current would mislead.
    .filter((reading) => !props.gapMs || Math.abs(reading.point.t - at) <= props.gapMs * 2)
  if (!readings.length) {
    hover.value = null
    return
  }
  hover.value = {
    at: readings[0].point.t,
    x: x(readings[0].point.t),
    readings,
    // Kept on the left until the pointer passes halfway, so the readout never
    // runs off the edge of a narrow card.
    flip: fraction > 0.6,
  }
}

const axisLabels = computed(() => {
  if (!hasData.value) return null
  return {
    high: formatValue(scale.value.high),
    low: formatValue(scale.value.low),
    from: timed.value ? formatTime(domain.value.from) : '',
    to: timed.value ? formatTime(domain.value.to) : '',
  }
})
</script>

<template>
  <div class="relative" :title="interactive ? '' : title">
    <svg
      v-if="hasData"
      class="w-full touch-none"
      :height="height"
      :viewBox="`0 0 ${WIDTH} ${height}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="title || $t('Recent history')"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <!-- Behind everything: what happened, then where the limit is. -->
      <line
        v-for="(marker, index) in markerLines"
        :key="`marker-${index}`"
        :class="MARKER_TONES[marker.tone] || MARKER_TONES.default"
        :x1="marker.x"
        :x2="marker.x"
        y1="0"
        :y2="height"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="2 2"
        opacity="0.7"
        vector-effect="non-scaling-stroke"
      />
      <line
        v-if="thresholdY !== null"
        class="text-amber-500 dark:text-amber-400"
        x1="0"
        :x2="WIDTH"
        :y1="thresholdY"
        :y2="thresholdY"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="4 3"
        opacity="0.65"
        vector-effect="non-scaling-stroke"
      />

      <g v-for="(line, index) in drawn" :key="`line-${index}`" :class="line.klass">
        <polygon v-for="(area, i) in line.areas" :key="`a${i}`" :points="area" fill="currentColor" opacity="0.12" />
        <polyline
          v-for="(stroke, i) in line.strokes"
          :key="`s${i}`"
          :points="stroke"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- A lone reading either side of a gap still deserves to be visible. -->
        <circle v-for="(dot, i) in line.dots" :key="`d${i}`" :cx="dot.x" :cy="dot.y" r="1.5" fill="currentColor" />
      </g>

      <polyline
        v-for="(stroke, index) in baselinePath"
        :key="`base-${index}`"
        class="text-zinc-500 dark:text-zinc-400"
        :points="stroke"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3 2"
        opacity="0.8"
        vector-effect="non-scaling-stroke"
      />

      <line
        v-if="hover"
        class="text-zinc-500 dark:text-zinc-400"
        :x1="hover.x"
        :x2="hover.x"
        y1="0"
        :y2="height"
        stroke="currentColor"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <p v-else class="text-[11px] text-zinc-400 dark:text-zinc-600" :style="{ lineHeight: `${height}px` }">
      {{ emptyText || $t('no history yet') }}
    </p>

    <!-- The readout is HTML rather than SVG text: the viewBox is stretched to
         the card's width, and text inside it would be stretched with it. -->
    <div
      v-if="hover"
      class="pointer-events-none absolute top-0 z-10 min-w-max rounded border border-zinc-200 bg-white/95 px-1.5 py-1 text-[11px] leading-tight shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95"
      :style="hover.flip ? { right: `${100 - hover.x}%` } : { left: `${hover.x}%` }"
    >
      <p class="tabular-nums text-zinc-400 dark:text-zinc-500">{{ formatTime(hover.at) }}</p>
      <p v-for="(reading, index) in hover.readings" :key="index" :class="['tabular-nums', reading.klass]">
        <span v-if="reading.name" class="text-zinc-600 dark:text-zinc-300">{{ reading.name }} </span>
        {{ formatValue(reading.point.v) }}
      </p>
    </div>

    <div
      v-if="axis && axisLabels"
      class="mt-0.5 flex justify-between text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600"
    >
      <span>{{ axisLabels.from }}</span>
      <span :title="$t('The range this chart is drawn against')">
        {{ axisLabels.low }} – {{ axisLabels.high }}
      </span>
      <span>{{ axisLabels.to }}</span>
    </div>
  </div>
</template>
