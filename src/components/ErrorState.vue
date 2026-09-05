<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  error: { type: [Object, String], default: null },
  title: { type: String, default: '' },
})
defineEmits(['retry'])

const heading = computed(() => props.title || props.error?.message || t('Something went wrong'))
const detail = computed(() => {
  if (typeof props.error === 'string') return props.error
  const parts = [props.error?.detail, ...(props.error?.messages || [])].filter(Boolean)
  return [...new Set(parts)].join(' ')
})
</script>

<template>
  <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
    <div class="flex items-start gap-3">
      <svg
        class="mt-0.5 h-5 w-5 shrink-0 text-red-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-red-800 dark:text-red-200">{{ heading }}</p>
        <p v-if="detail" class="mt-1 break-words text-sm text-red-700/90 dark:text-red-300/90">{{ detail }}</p>
        <p v-if="error?.status" class="mt-1 font-mono text-xs text-red-600/70 dark:text-red-400/70">
          HTTP {{ error.status }}
        </p>
        <button class="btn btn-ghost mt-3" @click="$emit('retry')">{{ $t('Try again') }}</button>
      </div>
    </div>
  </div>
</template>
