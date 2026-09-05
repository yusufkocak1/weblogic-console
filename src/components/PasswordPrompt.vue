<script setup>
import { nextTick, ref } from 'vue'
import ErrorState from '@/components/ErrorState.vue'

/**
 * Reconnecting a saved profile needs only the password back — everything else
 * is already on file. Passwords are never persisted, so this appears once per
 * profile per console restart.
 */
const open = ref(false)
const profile = ref(null)
const password = ref('')
const error = ref(null)
const busy = ref(false)
const input = ref(null)
let resolver = null

function ask(target) {
  profile.value = target
  password.value = ''
  error.value = null
  busy.value = false
  open.value = true
  nextTick(() => input.value?.focus())
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function cancel() {
  open.value = false
  resolver?.(null)
  resolver = null
}

/** The caller does the connecting; failures come back here to be shown. */
function submit() {
  if (!password.value) return
  busy.value = true
  error.value = null
  resolver?.({
    password: password.value,
    done: () => {
      open.value = false
      resolver = null
    },
    fail: (err) => {
      busy.value = false
      error.value = err
      nextTick(() => input.value?.select())
    },
  })
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
        @click.self="cancel"
      >
        <form class="card w-full max-w-sm p-5" @submit.prevent="submit" @keydown.esc="cancel">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {{ $t('Connect to {name}', { name: profile?.name }) }}
          </h2>
          <p class="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {{ profile?.username }}@{{ profile?.host }}:{{ profile?.port }}
          </p>

          <div class="mt-4">
            <label class="label" for="prompt-password">{{ $t('Password') }}</label>
            <input
              id="prompt-password"
              ref="input"
              v-model="password"
              class="input"
              type="password"
              required
              autocomplete="current-password"
            />
          </div>

          <ErrorState v-if="error" :error="error" class="mt-3" @retry="submit" />

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" :disabled="busy" @click="cancel">{{ $t('Cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || !password">
              {{ busy ? $t('Connecting…') : $t('Connect') }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>
