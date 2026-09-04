<script setup>
import { computed, ref, watch } from 'vue'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { items, targetNames } from '@/utils/format'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { curlFor, wlstForTargets } from '@/utils/wlst'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SnippetDialog from '@/components/SnippetDialog.vue'
import InfoTip from '@/components/InfoTip.vue'

/**
 * Where a resource is deployed.
 *
 * Moving a data source or an application between servers and clusters used to
 * mean leaving for WLST. It is one attribute — a list of identities on the
 * resource's own MBean — so it belongs on the resource's own page, next to
 * everything else about it.
 *
 * WebLogic replaces the whole list rather than adding to it, which is why this
 * always sends every target the resource should end up with, and why removing
 * the last one is called out as clearly as it is.
 */
const props = defineProps({
  /** The edit-tree MBean that owns the targets. */
  path: { type: String, required: true },
  name: { type: String, required: true },
  /** Target names the resource currently has. */
  current: { type: Array, default: () => [] },
  /** WLST's name for this kind of resource, used only in the script preview. */
  wlstType: { type: String, default: 'AppDeployment' },
  description: { type: String, default: '' },
})

const emit = defineEmits(['changed'])

const changes = useChangesStore()
const connection = useConnectionStore()
const ui = useUiStore()

const confirm = ref(null)
const snippet = ref(null)
const choices = ref({ servers: [], clusters: [] })
const selected = ref(new Set())
const saving = ref(false)
const loading = ref(false)

/** A server that belongs to a cluster is normally targeted through it. */
const clusterOf = computed(() => {
  const map = new Map()
  for (const server of choices.value.servers) {
    const cluster = targetNames(server.cluster)[0]
    if (cluster) map.set(server.name, cluster)
  }
  return map
})

async function load() {
  loading.value = true
  try {
    const result = await wls.targetChoices()
    choices.value = { servers: items(result.servers), clusters: items(result.clusters) }
  } catch (err) {
    ui.error('Could not read the targets available', err.fullText || err.message)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.current.join(','),
  () => {
    selected.value = new Set(props.current)
  },
  { immediate: true },
)

watch(() => connection.activeId, load)
load()

const entries = computed(() => [
  ...choices.value.clusters.map((cluster) => ({
    kind: 'clusters',
    name: cluster.name,
    note: 'Cluster — every member serves it',
  })),
  ...choices.value.servers.map((server) => ({
    kind: 'servers',
    name: server.name,
    note: clusterOf.value.get(server.name) ? `Member of ${clusterOf.value.get(server.name)}` : 'Standalone server',
  })),
])

const dirty = computed(() => {
  const before = [...props.current].sort().join(',')
  const after = [...selected.value].sort().join(',')
  return before !== after
})

const chosenEntries = computed(() => entries.value.filter((entry) => selected.value.has(entry.name)))

function toggle(entry) {
  const next = new Set(selected.value)
  if (next.has(entry.name)) next.delete(entry.name)
  else next.add(entry.name)
  selected.value = next
}

function revert() {
  selected.value = new Set(props.current)
}

const added = computed(() => [...selected.value].filter((name) => !props.current.includes(name)))
const removed = computed(() => props.current.filter((name) => !selected.value.has(name)))

async function save() {
  const targets = chosenEntries.value.map((entry) => ({ kind: entry.kind, name: entry.name }))
  const body = [
    added.value.length ? `Adding: ${added.value.join(', ')}.` : '',
    removed.value.length ? `Removing: ${removed.value.join(', ')}.` : '',
    removed.value.length
      ? 'A resource stops being available on a target the moment it is removed there.'
      : 'The resource is deployed to the new targets when the change is activated.',
    targets.length ? '' : 'With no targets left, this resource is deployed nowhere at all.',
  ]
    .filter(Boolean)
    .join(' ')

  const ok = await confirm.value.ask({
    title: `Change where ${props.name} is deployed?`,
    body,
    confirmLabel: 'Save and activate',
    danger: removed.value.length > 0 || !targets.length,
  })
  if (!ok) return

  saving.value = true
  try {
    await changes.save([{ path: props.path, attributes: { targets: config.targetIdentities(targets) } }])
    await changes.activate()
    ui.success('Targets updated', `${props.name} is now targeted at ${targets.map((t) => t.name).join(', ') || 'nothing'}.`)
    emit('changed')
  } catch (err) {
    ui.error('Could not change the targets', err.fullText || err.message)
  } finally {
    saving.value = false
  }
}

function showScript() {
  const targets = chosenEntries.value.map((entry) => entry.name)
  const context = { username: connection.username, baseUrl: connection.baseUrl }
  snippet.value.show({
    title: `Re-targeting ${props.name}`,
    subtitle: 'Targets are replaced as a whole, not added to.',
    wlst: wlstForTargets(props.wlstType, props.name, targets, context),
    curl: curlFor(
      'POST',
      props.path,
      { targets: config.targetIdentities(chosenEntries.value.map((e) => ({ kind: e.kind, name: e.name }))) },
      context,
    ),
  })
}
</script>

<template>
  <section class="card p-4">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Targets
          <InfoTip
            heading="Targets"
            text="The servers and clusters this resource is deployed to. Targeting a cluster deploys to every member, now and in future — that is nearly always what you want over picking members one by one."
          />
        </h3>
        <p class="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {{ description || 'Tick where this should be deployed. The change is staged and activated like any other configuration change.' }}
        </p>
      </div>
      <button class="btn btn-ghost" title="Show this change as a WLST script and as a curl command" @click="showScript">
        Show script
      </button>
    </div>

    <p v-if="loading && !entries.length" class="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
      Reading the servers and clusters in this domain…
    </p>

    <div v-else class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <label
        v-for="entry in entries"
        :key="`${entry.kind}/${entry.name}`"
        :class="[
          'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
          selected.has(entry.name)
            ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/10'
            : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40',
        ]"
      >
        <input
          type="checkbox"
          class="mt-0.5"
          :checked="selected.has(entry.name)"
          :disabled="saving"
          @change="toggle(entry)"
        />
        <span class="min-w-0">
          <span class="block truncate font-medium text-zinc-800 dark:text-zinc-100">{{ entry.name }}</span>
          <span class="block truncate text-xs text-zinc-400 dark:text-zinc-500">{{ entry.note }}</span>
        </span>
      </label>
    </div>

    <div v-if="dirty" class="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        <span v-if="added.length" class="text-emerald-600 dark:text-emerald-400">+{{ added.join(', ') }}</span>
        <span v-if="added.length && removed.length"> · </span>
        <span v-if="removed.length" class="text-red-600 dark:text-red-400">−{{ removed.join(', ') }}</span>
      </p>
      <div class="ml-auto flex gap-2">
        <button class="btn btn-ghost" :disabled="saving" @click="revert">Undo</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save and activate' }}
        </button>
      </div>
    </div>

    <ConfirmDialog ref="confirm" />
    <SnippetDialog ref="snippet" />
  </section>
</template>
