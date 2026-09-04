<script setup>
import InfoTip from '@/components/InfoTip.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  lastUpdated: { type: Number, default: null },
  refreshing: { type: Boolean, default: false },
  /** One-line explanation of what the page is for, shown next to the title. */
  help: { type: String, default: '' },
  /** Route to go back to, for a page that belongs under a list. */
  back: { type: Object, default: null },
  backLabel: { type: String, default: 'Back' },
})
defineEmits(['refresh'])
</script>

<template>
  <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <RouterLink
        v-if="back"
        :to="back"
        class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {{ backLabel }}
      </RouterLink>
      <h1 class="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {{ title }}
        <InfoTip v-if="help" :heading="title" :text="help" :label="`What the ${title} page shows`" tone="accent" />
      </h1>
      <p v-if="subtitle" class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-3">
      <slot name="actions" />
      <span
        v-if="lastUpdated"
        class="hidden text-xs text-zinc-400 sm:inline dark:text-zinc-500"
        title="When this page last received data from the AdminServer"
      >
        Updated {{ new Date(lastUpdated).toLocaleTimeString() }}
      </span>
      <button
        class="btn btn-ghost"
        :disabled="refreshing"
        title="Fetch the data on this page again now (auto-refresh is set in the top bar)"
        @click="$emit('refresh')"
      >
        <svg
          class="h-3.5 w-3.5"
          :class="refreshing && 'animate-spin'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        Refresh
      </button>
    </div>
  </header>
</template>
