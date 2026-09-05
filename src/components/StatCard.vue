<script setup>
import InfoTip from '@/components/InfoTip.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  hint: { type: String, default: '' },
  /** Longer explanation behind an "i" icon, for numbers that need context. */
  info: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // default | good | warn | bad
})

const TONES = {
  default: 'text-zinc-900 dark:text-zinc-50',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
}
</script>

<template>
  <div class="card p-4">
    <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {{ label }}
      <InfoTip v-if="info" :heading="label" :text="info" :label="$t('What {label} means', { label })" />
    </p>
    <p :class="['mt-1.5 text-2xl font-semibold tabular-nums', TONES[tone]]">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ hint }}</p>
    <slot />
  </div>
</template>
