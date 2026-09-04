<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import ErrorState from '@/components/ErrorState.vue'

const connection = useConnectionStore()
const router = useRouter()
const route = useRoute()

const last = connection.recent[0]
const form = reactive({
  host: last?.host ?? 'localhost',
  port: last?.port ?? 7001,
  ssl: last?.ssl ?? false,
  insecure: last?.insecure ?? false,
  username: last?.username ?? 'weblogic',
  password: '',
})

const error = ref(null)
const passwordVisible = ref(false)

const previewUrl = computed(() => {
  const host = form.host?.trim() || 'host'
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `${form.ssl ? 'https' : 'http'}://${bracketed}:${form.port || '?'}/management/weblogic/latest`
})

function useRecent(entry) {
  Object.assign(form, { ...entry, password: '' })
  error.value = null
}

async function submit() {
  error.value = null
  try {
    await connection.connect(form)
    form.password = ''
    router.replace(route.query.redirect || { name: 'dashboard' })
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
    <div class="w-full max-w-md">
      <div class="mb-6 flex items-center gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">W</span>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">WebLogic Console</h1>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">Connect to an AdminServer</p>
        </div>
      </div>

      <form class="card space-y-4 p-5" @submit.prevent="submit">
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="label" for="host">Host or IP</label>
            <input id="host" v-model="form.host" class="input" required autocomplete="off" placeholder="10.0.0.12" />
          </div>
          <div>
            <label class="label" for="port">Port</label>
            <input id="port" v-model.number="form.port" class="input" required type="number" min="1" max="65535" />
          </div>
        </div>

        <div>
          <label class="label" for="username">Username</label>
          <input id="username" v-model="form.username" class="input" required autocomplete="username" />
        </div>

        <div>
          <label class="label" for="password">Password</label>
          <div class="relative">
            <input
              id="password"
              v-model="form.password"
              class="input pr-16"
              :type="passwordVisible ? 'text' : 'password'"
              required
              autocomplete="current-password"
            />
            <button
              type="button"
              class="absolute right-2 top-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              @click="passwordVisible = !passwordVisible"
            >
              {{ passwordVisible ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <div class="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/60">
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input v-model="form.ssl" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900" />
            Use SSL (https)
          </label>
          <label
            v-if="form.ssl"
            class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            title="Accept self-signed or otherwise untrusted certificates"
          >
            <input v-model="form.insecure" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900" />
            Trust self-signed certificate
          </label>
          <p class="break-all font-mono text-xs text-zinc-400 dark:text-zinc-500">{{ previewUrl }}</p>
        </div>

        <ErrorState v-if="error" :error="error" @retry="submit" />

        <button class="btn btn-primary w-full py-2" type="submit" :disabled="connection.busy">
          {{ connection.busy ? 'Connecting…' : 'Connect' }}
        </button>
      </form>

      <div v-if="connection.recent.length" class="mt-4">
        <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recent</p>
        <ul class="space-y-1">
          <li
            v-for="entry in connection.recent"
            :key="`${entry.host}:${entry.port}:${entry.username}`"
            class="flex items-center gap-2"
          >
            <button
              class="min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-left text-sm text-zinc-600 transition hover:border-indigo-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-zinc-100"
              @click="useRecent(entry)"
            >
              {{ entry.username }}@{{ entry.host }}:{{ entry.port }}
              <span v-if="entry.ssl" class="ml-1 text-xs text-zinc-400">SSL</span>
            </button>
            <button
              class="px-2 text-zinc-400 transition hover:text-red-500"
              :aria-label="`Forget ${entry.host}`"
              @click="connection.forgetTarget(entry)"
            >
              &times;
            </button>
          </li>
        </ul>
      </div>

      <p class="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Credentials are held by the local console process for this session only — never stored in the browser.
      </p>
    </div>
  </div>
</template>
