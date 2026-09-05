<script setup>
import { ref } from 'vue'
import SnippetDialog from '@/components/SnippetDialog.vue'
import { t } from '@/i18n'

const open = ref(false)
const pending = ref(false)
const config = ref({ title: '', body: '', confirmLabel: '', danger: false, changes: null, script: null })
const snippet = ref(null)
let resolver = null

/**
 * Imperative confirm: `await dialog.value.ask({...})` resolves true/false.
 * Exposed via defineExpose so views can trigger it from an event handler
 * without threading extra state through the template.
 *
 * `changes: [{label, from, to, note}]` spells the edits out one per line,
 * before and after, so what is being confirmed is the actual values rather
 * than a count of fields.
 *
 * `script: {wlst, curl}` adds a button showing the same operation as a script,
 * so "what exactly is this about to run?" can be answered before confirming
 * rather than afterwards.
 */
function ask(options) {
  config.value = {
    title: t('Are you sure?'),
    body: '',
    confirmLabel: t('Confirm'),
    danger: false,
    changes: null,
    script: null,
    ...options,
  }
  open.value = true
  pending.value = false
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function showScript() {
  snippet.value?.show({ title: config.value.title, ...config.value.script })
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

          <!-- What is about to change, value by value: the point of asking. -->
          <ul
            v-if="config.changes?.length"
            class="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <li v-for="(change, index) in config.changes" :key="index">
              <p class="flex flex-wrap items-center gap-x-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                {{ change.label }}
                <span v-if="change.note" class="font-normal text-zinc-400 dark:text-zinc-500">{{ change.note }}</span>
              </p>
              <p class="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span class="line-through">{{ change.from }}</span>
                <span class="mx-1.5">&rarr;</span>
                <span class="font-semibold text-zinc-900 dark:text-zinc-50">{{ change.to }}</span>
              </p>
            </li>
          </ul>

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <button
              v-if="config.script"
              class="btn btn-ghost mr-auto"
              :title="$t('Show this operation as a WLST script and as the REST call the console makes')"
              @click="showScript"
            >
              {{ $t('Show script') }}
            </button>
            <button class="btn btn-ghost" :disabled="pending" @click="settle(false)">{{ $t('Cancel') }}</button>
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

    <SnippetDialog ref="snippet" />
  </Teleport>
</template>
