<script setup>
import InfoTip from '@/components/InfoTip.vue'

/**
 * The "what is this thing doing right now" strip at the top of a detail page:
 * live runtime facts, next to the settings that produced them.
 */
defineProps({
  // [{ label, value, hint, mono }]
  facts: { type: Array, default: () => [] },
})
</script>

<template>
  <dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
    <div v-for="fact in facts" :key="fact.label" class="min-w-0">
      <dt class="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {{ fact.label }}
        <InfoTip v-if="fact.hint" :heading="fact.label" :text="fact.hint" :label="$t('What {label} means', { label: fact.label })" />
      </dt>
      <dd
        :class="[
          'mt-0.5 truncate text-sm text-zinc-900 dark:text-zinc-50',
          fact.mono && 'font-mono text-xs',
        ]"
        :title="String(fact.value ?? '')"
      >
        {{ fact.value === null || fact.value === undefined || fact.value === '' ? '—' : fact.value }}
      </dd>
    </div>
  </dl>
</template>
