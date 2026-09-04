<script setup>
import { computed, ref } from 'vue'
import { request } from '@/api/client'
import PageHeader from '@/components/PageHeader.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'

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
    <PageHeader
      title="REST Explorer"
      subtitle="Call any endpoint of the management API directly"
      help="An escape hatch onto the WebLogic management REST API for anything the other pages do not cover. GET requests are safe to explore with; anything else changes the domain."
      @refresh="send"
    />

    <HelpPanel id="explorer" title="How to explore the management API">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          Press one of the buttons at the bottom of the box. They are working examples - the fastest way to see the
          shape of a response.
        </li>
        <li>
          Edit the path and press Enter. Everything hangs off two trees:
          <code class="font-mono">/domainConfig/...</code> for configuration and
          <code class="font-mono">/domainRuntime/...</code> for live state.
        </li>
        <li>
          Trim the output with query parameters: <code class="font-mono">?links=none</code> drops the navigation
          links, <code class="font-mono">&amp;fields=name,state</code> keeps only the fields you name.
        </li>
      </ol>
      <p>
        Walk down a tree by appending the name of a child: <code class="font-mono">/domainConfig/servers</code> lists
        the servers, <code class="font-mono">/domainConfig/servers/ms1</code> is one of them. Use
        <strong>Copy</strong> to take a response into a ticket or a script.
      </p>
    </HelpPanel>

    <div class="card mb-4 p-3">
      <div class="flex flex-wrap gap-2">
        <select
          v-model="method"
          title="GET only reads and is safe. POST, PUT and DELETE change the domain — most configuration edits also need an edit session under /edit."
          class="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
        <div class="flex min-w-0 flex-1 items-center gap-0">
          <span
            class="hidden rounded-l-lg border border-r-0 border-zinc-300 bg-zinc-100 px-2 py-1.5 font-mono text-xs text-zinc-500 sm:block dark:border-zinc-700 dark:bg-zinc-800"
            title="Fixed base of every management URL — type only the part after it"
          >
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
        <label class="label-row" for="explorer-body">
          Request body (JSON)
          <InfoTip
            heading="Request body"
            text="Sent as the JSON payload of the request. Actions usually take {} or a small object of arguments; a configuration change takes the attributes you want to set. Invalid JSON is rejected before anything is sent."
          />
        </label>
        <textarea id="explorer-body" v-model="body" class="input h-28 font-mono text-xs" spellcheck="false" />
        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {{ method }} changes domain state. Configuration edits normally need an edit session under /edit.
        </p>
      </div>

      <p v-if="!isWrite" class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Examples — click one to run it, then edit the path and press Enter:
      </p>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
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
        <button
          class="btn btn-ghost px-2 py-1 text-xs"
          title="Copy the whole JSON response to the clipboard"
          @click="copy"
        >
          Copy
        </button>
      </div>
      <pre class="max-h-[60vh] overflow-auto p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{{ pretty }}</pre>
    </div>
  </div>
</template>
