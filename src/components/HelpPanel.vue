<script setup>
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * Collapsible "how to use this page" note. Each panel remembers whether it was
 * opened, so the hints stay out of the way once an operator knows the page.
 */
const props = defineProps({
  id: { type: String, required: true },
  /** Empty falls back to a translated default at render time. */
  title: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: false },
})

const ui = useUiStore()
const storageKey = `wl-console.help.${props.id}`

function readOpen() {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw === null ? props.defaultOpen : raw === '1'
  } catch {
    return props.defaultOpen
  }
}

const open = ref(readOpen())

function toggle() {
  open.value = !open.value
  try {
    localStorage.setItem(storageKey, open.value ? '1' : '0')
  } catch {
    /* storage disabled — the panel just reopens in its default state */
  }
}
</script>

<template>
  <section
    v-if="ui.helpVisible"
    class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/5"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg
        class="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5v.01" />
      </svg>
      <span class="flex-1 text-sm font-medium text-indigo-900 dark:text-indigo-200">
        {{ title || $t('How this page works') }}
      </span>
      <svg
        class="h-3.5 w-3.5 shrink-0 text-indigo-500 transition-transform dark:text-indigo-400"
        :class="open && 'rotate-180'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="space-y-2 border-t border-indigo-200/70 px-3 py-3 text-sm leading-relaxed text-indigo-900/90 dark:border-indigo-500/20 dark:text-indigo-100/80"
    >
      <slot />
    </div>
  </section>
</template>
