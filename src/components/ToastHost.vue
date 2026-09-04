<script setup>
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const tones = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/70 dark:text-red-100',
  info: 'border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in absolute"
      leave-to-class="translate-x-4 opacity-0"
    >
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        :class="['pointer-events-auto rounded-xl border p-3 shadow-lg', tones[toast.tone] || tones.info]"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ toast.title }}</p>
            <p v-if="toast.detail" class="mt-0.5 break-words text-xs opacity-80">{{ toast.detail }}</p>
          </div>
          <button
            class="rounded p-1 text-lg leading-none opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
            @click="ui.dismiss(toast.id)"
          >
            &times;
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
