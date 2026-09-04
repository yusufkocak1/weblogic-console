<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as config from '@/api/config'
import { items } from '@/utils/format'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore, REFRESH_OPTIONS } from '@/stores/ui'

/**
 * Ctrl-K: one box that goes anywhere.
 *
 * A domain with forty managed servers turns "open ms23" into a page load, a
 * filter and a click. Here it is three keystrokes. The list holds every page,
 * every server, cluster, data source and application in the domain, the open
 * connections, and the handful of settings worth reaching without the mouse.
 *
 * Names are read once per domain and kept: they change far more slowly than
 * runtime numbers, and this list has to open instantly.
 */
const props = defineProps({
  /** [{name, label, hint}] — the same navigation the sidebar renders. */
  nav: { type: Array, default: () => [] },
})

const router = useRouter()
const connection = useConnectionStore()
const ui = useUiStore()

const open = ref(false)
const query = ref('')
const cursor = ref(0)
const input = ref(null)
const objects = ref([])
const loadedFor = ref(null)
const loading = ref(false)

const GROUP_ORDER = ['Page', 'Server', 'Cluster', 'Data source', 'Application', 'Connection', 'Setting']

async function loadObjects() {
  if (loadedFor.value === connection.activeId || !connection.activeId) return
  loading.value = true
  try {
    const { servers, clusters, dataSources, deployments } = await config.editTargets()
    const collect = (collection, group, route) =>
      items(collection).map((entry) => ({
        id: `${group}:${entry.name}`,
        group,
        label: entry.name,
        hint: `Open this ${group.toLowerCase()}`,
        to: { name: route, params: { name: entry.name } },
      }))
    objects.value = [
      ...collect(servers, 'Server', 'server-detail'),
      ...collect(clusters, 'Cluster', 'cluster-detail'),
      ...collect(dataSources, 'Data source', 'data-source-detail'),
      ...collect(deployments, 'Application', 'deployment-detail'),
    ]
    loadedFor.value = connection.activeId
  } catch {
    // The palette is still useful with pages and settings alone.
    objects.value = []
  } finally {
    loading.value = false
  }
}

const commands = computed(() => {
  const pages = props.nav.map((item) => ({
    id: `page:${item.name}`,
    group: 'Page',
    label: item.label,
    hint: item.hint,
    to: { name: item.name },
  }))

  const connections = connection.connections
    .filter((entry) => entry.id !== connection.activeId)
    .map((entry) => ({
      id: `connection:${entry.id}`,
      group: 'Connection',
      label: `Switch to ${entry.name}`,
      hint: `${entry.host}:${entry.port} as ${entry.username}`,
      run: () => connection.activate(entry.id),
    }))

  const settings = [
    {
      id: 'setting:theme',
      group: 'Setting',
      label: `Switch to the ${ui.theme === 'dark' ? 'light' : 'dark'} theme`,
      hint: 'Remembered in this browser',
      run: () => ui.toggleTheme(),
    },
    {
      id: 'setting:help',
      group: 'Setting',
      label: ui.helpVisible ? 'Hide help hints' : 'Show help hints',
      hint: 'The ⓘ icons and the panel at the top of each page',
      run: () => ui.toggleHelp(),
    },
    ...REFRESH_OPTIONS.map((option) => ({
      id: `setting:refresh:${option.value}`,
      group: 'Setting',
      label: `Auto-refresh: ${option.label}`,
      hint: 'How often pages re-fetch from the AdminServer',
      run: () => ui.setRefresh(option.value),
    })),
    {
      id: 'setting:connections',
      group: 'Setting',
      label: 'Manage connections',
      hint: 'Rename, close and forget saved domains',
      to: { name: 'connections' },
    },
    {
      id: 'setting:domain',
      group: 'Setting',
      label: 'Domain settings',
      hint: 'Administration port, auditing and the domain log',
      to: { name: 'domain-settings' },
    },
  ]

  return [...pages, ...objects.value, ...connections, ...settings]
})

/**
 * Substring first, then initials — "dsv" finds "Data Sources" — with the
 * earliest match winning so typing a full name lands on it.
 */
function score(entry, needle) {
  const label = entry.label.toLowerCase()
  if (!needle) return 0
  const index = label.indexOf(needle)
  if (index === 0) return 1000
  if (index > 0) return 800 - index
  const initials = label
    .split(/[\s\-_.]+/)
    .map((word) => word[0])
    .join('')
  if (initials.startsWith(needle)) return 600
  if ((entry.hint || '').toLowerCase().includes(needle)) return 200
  // Letters in order, anywhere: the last resort before giving up on the row.
  let position = -1
  for (const character of needle) {
    position = label.indexOf(character, position + 1)
    if (position === -1) return -1
  }
  return 100
}

const results = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const scored = commands.value
    .map((entry) => ({ entry, score: score(entry, needle) }))
    .filter((row) => row.score >= 0)
  scored.sort((a, b) => b.score - a.score || GROUP_ORDER.indexOf(a.entry.group) - GROUP_ORDER.indexOf(b.entry.group))
  return scored.slice(0, 40).map((row) => row.entry)
})

/** Rows are flat for the keyboard; the heading is drawn when the group changes. */
const headingFor = (index) => {
  const group = results.value[index]?.group
  return index === 0 || results.value[index - 1]?.group !== group ? group : null
}

async function show() {
  open.value = true
  query.value = ''
  cursor.value = 0
  loadObjects()
  await nextTick()
  input.value?.focus()
}

function hide() {
  open.value = false
}

async function choose(entry) {
  if (!entry) return
  hide()
  if (entry.to) await router.push(entry.to).catch(() => {})
  else await entry.run?.()
}

function move(delta) {
  if (!results.value.length) return
  cursor.value = (cursor.value + delta + results.value.length) % results.value.length
  document.getElementById(`palette-row-${cursor.value}`)?.scrollIntoView({ block: 'nearest' })
}

watch(query, () => {
  cursor.value = 0
})

const onKey = (event) => {
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault()
    open.value ? hide() : show()
    return
  }
  if (!open.value) return
  if (event.key === 'Escape') hide()
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(results.value[cursor.value])
  }
}

window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 p-4 pt-24 backdrop-blur-sm" @click.self="hide">
      <div class="card w-full max-w-xl overflow-hidden shadow-2xl">
        <div class="flex items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
          <svg class="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref="input"
            v-model="query"
            class="w-full bg-transparent py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            placeholder="Go to a page, a server, a data source…"
            aria-label="Search pages and objects"
          />
          <kbd class="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700">esc</kbd>
        </div>

        <ul v-if="results.length" class="max-h-80 overflow-y-auto py-1">
          <template v-for="(entry, index) in results" :key="entry.id">
            <li
              v-if="headingFor(index)"
              class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
            >
              {{ headingFor(index) }}
            </li>
            <li :id="`palette-row-${index}`">
              <button
                type="button"
                :class="[
                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm',
                  index === cursor
                    ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100'
                    : 'text-zinc-700 dark:text-zinc-200',
                ]"
                @mousemove="cursor = index"
                @click="choose(entry)"
              >
                <span class="truncate font-medium">{{ entry.label }}</span>
                <span class="truncate text-xs text-zinc-400 dark:text-zinc-500">{{ entry.hint }}</span>
              </button>
            </li>
          </template>
        </ul>
        <p v-else class="px-3 py-8 text-center text-sm text-zinc-400">
          {{ loading ? 'Reading the domain…' : 'Nothing matches that.' }}
        </p>

        <p class="border-t border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          ↑↓ to move · Enter to open · Ctrl-K from anywhere
        </p>
      </div>
    </div>
  </Teleport>
</template>
