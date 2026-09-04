<script setup>
import { computed } from 'vue'
import InfoTip from '@/components/InfoTip.vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  // Fractions of max at which the bar turns amber and red.
  warnAt: { type: Number, default: 0.75 },
  dangerAt: { type: Number, default: 0.9 },
  label: { type: String, default: '' },
  /** Optional explanation of what the bar measures and when its colour changes. */
  tip: { type: String, default: '' },
})

const ratio = computed(() => {
  if (!props.max) return 0
  return Math.min(1, Math.max(0, props.value / props.max))
})

const color = computed(() => {
  if (ratio.value >= props.dangerAt) return 'bg-red-500'
  if (ratio.value >= props.warnAt) return 'bg-amber-500'
  return 'bg-emerald-500'
})
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-2">
      <span v-if="label" class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        {{ label }}
        <InfoTip v-if="tip" :text="tip" label="What this bar measures" />
      </span>
      <span
        class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
        :title="`${Math.round(ratio * 100)}% used — amber from ${Math.round(warnAt * 100)}%, red from ${Math.round(dangerAt * 100)}%`"
      >
        {{ Math.round(ratio * 100) }}%
      </span>
    </div>
    <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div :class="['h-full rounded-full transition-all duration-500', color]" :style="{ width: `${ratio * 100}%` }" />
    </div>
  </div>
</template>
