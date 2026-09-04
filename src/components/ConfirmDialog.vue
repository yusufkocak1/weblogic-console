<script setup>
import { ref } from 'vue'

const open = ref(false)
const pending = ref(false)
const config = ref({ title: '', body: '', confirmLabel: 'Confirm', danger: false })
let resolver = null

/**
 * Imperative confirm: `await dialog.value.ask({...})` resolves true/false.
 * Exposed via defineExpose so views can trigger it from an event handler
 * without threading extra state through the template.
 */
function ask(options) {
  config.value = { title: 'Are you sure?', body: '', confirmLabel: 'Confirm', danger: false, ...options }
  open.value = true
  pending.value = false
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function settle(result) {
  open.value = false
  resolver?.(result)
  resolver = null
}

defineExpose({ ask })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
        @click.self="settle(false)"
        @keydown.esc="settle(false)"
      >
        <div class="card w-full max-w-md p-5" role="dialog" aria-modal="true">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">{{ config.title }}</h2>
          <p v-if="config.body" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ config.body }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button class="btn btn-ghost" :disabled="pending" @click="settle(false)">Cancel</button>
            <button
              :class="['btn', config.danger ? 'btn-danger' : 'btn-primary']"
              :disabled="pending"
              autofocus
              @click="settle(true)"
            >
              {{ config.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
