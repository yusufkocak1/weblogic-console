<script setup>
import { computed } from 'vue'
import { healthOf } from '@/utils/format'

const props = defineProps({
  state: { type: String, default: '' },
  health: { type: [String, Object], default: null },
  kind: { type: String, default: 'state' }, // 'state' | 'health'
})

const STATE_TONES = {
  RUNNING: 'emerald',
  ACTIVE: 'emerald',
  ADMIN: 'amber',
  STANDBY: 'amber',
  STARTING: 'sky',
  RESUMING: 'sky',
  SUSPENDING: 'amber',
  SHUTTING_DOWN: 'amber',
  SHUTDOWN: 'zinc',
  UNKNOWN: 'zinc',
  FAILED: 'red',
  FAILED_NOT_RESTARTABLE: 'red',
  FORCE_SUSPENDING: 'amber',
}

const HEALTH_TONES = {
  OK: 'emerald',
  WARN: 'amber',
  CRITICAL: 'red',
  FAILED: 'red',
  OVERLOADED: 'red',
  UNKNOWN: 'zinc',
}

const TONE_CLASSES = {
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber: 'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  sky: 'bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  red: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-400 dark:ring-zinc-500/30',
}

const label = computed(() => {
  if (props.kind === 'health') return healthOf(props.health)
  return (props.state || 'UNKNOWN').toUpperCase()
})

const tone = computed(() => {
  const table = props.kind === 'health' ? HEALTH_TONES : STATE_TONES
  return TONE_CLASSES[table[label.value] || 'zinc']
})

const pulsing = computed(() => ['STARTING', 'RESUMING', 'SHUTTING_DOWN', 'SUSPENDING'].includes(label.value))
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tone]"
  >
    <span :class="['h-1.5 w-1.5 rounded-full bg-current', pulsing && 'animate-pulse']" />
    {{ label.replaceAll('_', ' ') }}
  </span>
</template>
