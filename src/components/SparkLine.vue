<script setup>
import { computed } from 'vue'

/**
 * A number's recent history, drawn small enough to sit beside the number.
 *
 * There is no charting library behind this: a polyline over a viewBox scales to
 * whatever width it is given, reads correctly in both themes, and costs nothing
 * to render forty times on a dashboard.
 */
const props = defineProps({
  values: { type: Array, default: () => [] },
  /** Upper bound of the scale. Omitted, the series' own maximum is used. */
  max: { type: Number, default: null },
  min: { type: Number, default: 0 },
  height: { type: Number, default: 28 },
  /** default | good | warn | bad — matched to what the number means. */
  tone: { type: String, default: 'default' },
  /** Shown when there is not enough history yet to draw anything. */
  emptyText: { type: String, default: 'no history yet' },
  title: { type: String, default: '' },
})

const WIDTH = 100

const TONES = {
  default: 'text-indigo-500 dark:text-indigo-400',
  good: 'text-emerald-500 dark:text-emerald-400',
  warn: 'text-amber-500 dark:text-amber-400',
  bad: 'text-red-500 dark:text-red-400',
}

const clean = computed(() => props.values.filter((value) => typeof value === 'number' && Number.isFinite(value)))

const scale = computed(() => {
  const values = clean.value
  const high = props.max ?? Math.max(...values, 1)
  const low = Math.min(props.min, ...values)
  // A flat series would divide by zero; give it a band to sit in the middle of.
  const span = high - low || Math.abs(high) || 1
  return { high, low, span }
})

const points = computed(() => {
  const values = clean.value
  if (values.length < 2) return ''
  const { low, span } = scale.value
  const step = WIDTH / (values.length - 1)
  return values
    .map((value, index) => {
      const x = index * step
      const y = props.height - ((value - low) / span) * props.height
      return `${x.toFixed(2)},${Math.max(0, Math.min(props.height, y)).toFixed(2)}`
    })
    .join(' ')
})

/** The line closed against the baseline, so the area under it can be shaded. */
const area = computed(() => (points.value ? `0,${props.height} ${points.value} ${WIDTH},${props.height}` : ''))
</script>

<template>
  <div :title="title">
    <svg
      v-if="points"
      class="w-full"
      :class="TONES[tone] || TONES.default"
      :height="height"
      :viewBox="`0 0 ${WIDTH} ${height}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="title || 'Recent history'"
    >
      <polygon :points="area" fill="currentColor" opacity="0.12" />
      <polyline
        :points="points"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <p v-else class="text-[11px] text-zinc-400 dark:text-zinc-600" :style="{ lineHeight: `${height}px` }">
      {{ emptyText }}
    </p>
  </div>
</template>
