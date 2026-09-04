<script setup>
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * "Show me what this does" — the same operation as a WLST script and as a curl
 * command, ready to copy into a runbook or a change record.
 *
 * Opened imperatively, the way ConfirmDialog is: `snippet.value.show({...})`.
 */
const ui = useUiStore()

const open = ref(false)
const tab = ref('wlst')
const content = ref({ title: '', subtitle: '', wlst: '', curl: '' })

function show(options) {
  content.value = { title: 'Equivalent script', subtitle: '', wlst: '', curl: '', ...options }
  tab.value = content.value.wlst ? 'wlst' : 'curl'
  open.value = true
}

const current = computed(() => (tab.value === 'wlst' ? content.value.wlst : content.value.curl))

async function copy() {
  try {
    await navigator.clipboard.writeText(current.value)
    ui.success('Copied', `The ${tab.value === 'wlst' ? 'WLST script' : 'curl command'} is on the clipboard.`)
  } catch {
    // Clipboard access is refused outside a secure context in some browsers;
    // selecting the text by hand still works, so say so rather than failing.
    ui.info('Could not copy automatically', 'Select the text and copy it with Ctrl-C.')
  }
}

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
      @click.self="open = false"
      @keydown.esc="open = false"
    >
      <div class="card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden" role="dialog" aria-modal="true">
        <div class="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">{{ content.title }}</h2>
          <p v-if="content.subtitle" class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{{ content.subtitle }}</p>
        </div>

        <div class="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <button
            v-if="content.wlst"
            :class="[
              'rounded-lg px-2.5 py-1 text-sm font-medium',
              tab === 'wlst'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
            ]"
            title="The same operation as a WLST script"
            @click="tab = 'wlst'"
          >
            WLST
          </button>
          <button
            v-if="content.curl"
            :class="[
              'rounded-lg px-2.5 py-1 text-sm font-medium',
              tab === 'curl'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
            ]"
            title="The REST request the console itself sends"
            @click="tab = 'curl'"
          >
            curl
          </button>
          <button class="btn btn-ghost ml-auto" title="Copy this to the clipboard" @click="copy">Copy</button>
          <button class="btn btn-ghost" @click="open = false">Close</button>
        </div>

        <pre
          class="flex-1 overflow-auto bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
        >{{ current }}</pre>

        <p class="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          The curl form is exactly what the console sends. The WLST form is a translation — check the MBean paths
          before running it against a domain that matters, and never leave a real password in a script.
        </p>
      </div>
    </div>
  </Teleport>
</template>
