<script setup>
import { computed, ref } from 'vue'
import { request } from '@/api/client'
import PageHeader from '@/components/PageHeader.vue'
import ErrorState from '@/components/ErrorState.vue'

/**
 * A direct window on the REST management API for anything this console does not
 * have a dedicated page for. Reads are one click; writes require the method to
 * be changed deliberately, which is the confirmation step.
 */
const BOOKMARKS = [
  { label: 'Domain config', path: '/domainConfig?links=none' },
  { label: 'Servers (config)', path: '/domainConfig/servers?links=none&fields=name,listenPort,cluster' },
  { label: 'Server runtimes', path: '/domainRuntime/serverRuntimes?links=none&fields=name,state,healthState' },
  { label: 'Lifecycle states', path: '/domainRuntime/serverLifeCycleRuntimes?links=none&fields=name,state' },
  { label: 'Deployments', path: '/domainConfig/appDeployments?links=none' },
  { label: 'JDBC resources', path: '/domainConfig/JDBCSystemResources?links=none&fields=name' },
  { label: 'Machines', path: '/domainConfig/machines?links=none&fields=name,machineType' },
  { label: 'Security realms', path: '/domainConfig/securityConfiguration/realms?links=none&fields=name' },
]

const path = ref('/domainRuntime/serverRuntimes?links=none&fields=name,state')
const method = ref('GET')
const body = ref('{}')
const result = ref(null)
const error = ref(null)
const loading = ref(false)
const elapsed = ref(null)

const isWrite = computed(() => method.value !== 'GET')

async function send() {
  loading.value = true
  error.value = null
  const started = performance.now()
  try {
    let parsed
    if (isWrite.value && body.value.trim()) {
      try {
        parsed = JSON.parse(body.value)
      } catch {
        throw Object.assign(new Error('Request body is not valid JSON'), { status: 0 })
      }
    }
    result.value = await request(path.value.trim(), { method: method.value, body: parsed })
    elapsed.value = Math.round(performance.now() - started)
  } catch (err) {
    error.value = err
    result.value = null
  } finally {
    loading.value = false
  }
}

function load(bookmark) {
  path.value = bookmark.path
  method.value = 'GET'
  send()
}

const pretty = computed(() => (result.value === null ? '' : JSON.stringify(result.value, null, 2)))

async function copy() {
  await navigator.clipboard?.writeText(pretty.value)
}
</script>

<template>
  <div>
    <PageHeader title="REST Explorer" subtitle="Call any endpoint of the management API directly" @refresh="send" />

    <div class="card mb-4 p-3">
      <div class="flex flex-wrap gap-2">
        <select
          v-model="method"
          class="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
        <div class="flex min-w-0 flex-1 items-center gap-0">
          <span class="hidden rounded-l-lg border border-r-0 border-zinc-300 bg-zinc-100 px-2 py-1.5 font-mono text-xs text-zinc-500 sm:block dark:border-zinc-700 dark:bg-zinc-800">
            /management/weblogic/latest
          </span>
          <input
            v-model="path"
            class="input rounded-l-none font-mono text-xs"
            placeholder="/domainRuntime/serverRuntimes?links=none"
            @keyup.enter="send"
          />
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="send">
          {{ loading ? 'Sending…' : 'Send' }}
        </button>
      </div>

      <div v-if="isWrite" class="mt-3">
        <label class="label" for="explorer-body">Request body (JSON)</label>
        <textarea id="explorer-body" v-model="body" class="input h-28 font-mono text-xs" spellcheck="false" />
        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {{ method }} changes domain state. Configuration edits normally need an edit session under /edit.
        </p>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        <button
          v-for="bookmark in BOOKMARKS"
          :key="bookmark.path"
          class="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
          @click="load(bookmark)"
        >
          {{ bookmark.label }}
        </button>
      </div>
    </div>

    <ErrorState v-if="error" :error="error" @retry="send" />

    <div v-else-if="result !== null" class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ pretty.split('\n').length }} lines<template v-if="elapsed"> · {{ elapsed }} ms</template>
        </span>
        <button class="btn btn-ghost px-2 py-1 text-xs" @click="copy">Copy</button>
      </div>
      <pre class="max-h-[60vh] overflow-auto p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{{ pretty }}</pre>
    </div>
  </div>
</template>
