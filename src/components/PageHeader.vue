<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  lastUpdated: { type: Number, default: null },
  refreshing: { type: Boolean, default: false },
})
defineEmits(['refresh'])
</script>

<template>
  <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-3">
      <slot name="actions" />
      <span v-if="lastUpdated" class="hidden text-xs text-zinc-400 sm:inline dark:text-zinc-500">
        Updated {{ new Date(lastUpdated).toLocaleTimeString() }}
      </span>
      <button class="btn btn-ghost" :disabled="refreshing" @click="$emit('refresh')">
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
