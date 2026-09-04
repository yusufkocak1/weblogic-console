<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import * as config from '@/api/config'
import { IMPACTS, categoryByKey } from '@/settings/catalog'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { curlForEdits, wlstForEdits } from '@/utils/wlst'
import HelpPanel from '@/components/HelpPanel.vue'
import PendingChanges from '@/components/PendingChanges.vue'
import SettingField from '@/components/SettingField.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SnippetDialog from '@/components/SnippetDialog.vue'

/**
 * The editable settings of one object, on that object's own page.
 *
 * Everything rendered comes from the settings catalog, and every change goes
 * through WebLogic's staged edit protocol: take the domain lock, write the
 * pending values, activate. The panel never polls — a form that reloads
 * underneath somebody typing into it is worse than a slightly stale one.
 */
const props = defineProps({
  /** Catalog section keys to render, in order, e.g. ['servers', 'logging']. */
  sections: { type: Array, required: true },
  /** The server, cluster, data source or application being configured. */
  name: { type: String, default: '' },
  /** Shown above the first section when the page needs more of an intro. */
  intro: { type: String, default: '' },
})

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const connection = useConnectionStore()
const changes = useChangesStore()

const confirm = ref(null)
const snippet = ref(null)

/** One entry per catalog group: what the AdminServer holds and what is typed. */
const groups = ref([])
const loading = ref(false)
const saving = ref(false)

let controller = null

const categories = computed(() => props.sections.map(categoryByKey).filter(Boolean))

/** Somebody else holding the domain lock makes every field read-only. */
const lockedByOther = computed(
  () => changes.locked && changes.lockOwner && changes.lockOwner !== connection.username,
)

// ------------------------------------------------------------------ loading

/**
 * A dead console session is the one failure every call here has to act on: the
 * backend restarted or the session expired, so the page starts over at the
 * connect screen instead of showing an error per group.
 */
function sessionGone(err) {
  if (!err?.isAuthError) return false
  connection.reset()
  ui.error('Session ended', 'Connect to the AdminServer again.')
  router.push({ name: 'login', query: { redirect: route.fullPath } })
  return true
}

function coerce(field, value) {
  if (field.type === 'boolean') return Boolean(value)
  if (field.type === 'number') {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  // An emptied text field means "unset", which WebLogic spells as null.
  return value === '' ? null : value
}

/** Turns what REST returned into values the inputs can hold. */
function toForm(fields, mbean) {
  const form = {}
  for (const field of fields) {
    const raw = mbean?.[field.attr]
    if (field.type === 'boolean') form[field.attr] = raw === true
    else form[field.attr] = raw === null || raw === undefined ? '' : raw
  }
  return form
}

async function load() {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  const name = props.name

  loading.value = true
  try {
    // Several groups often read the same MBean — the data source pool sections
    // all live in JDBCConnectionPoolParams — so each path is fetched once.
    const reads = new Map()
    const read = (path) => {
      if (!reads.has(path)) reads.set(path, config.readMBean(path, { signal }).catch((err) => ({ __error: err })))
      return reads.get(path)
    }

    const loaded = await Promise.all(
      categories.value.flatMap((category) =>
        category.groups.map(async (def) => {
          const path = def.path(name)
          const mbean = await read(path)
          if (mbean?.__error) return { category, def, path, values: {}, draft: {}, error: mbean.__error }
          return { category, def, path, values: toForm(def.fields, mbean), draft: toForm(def.fields, mbean), error: null }
        }),
      ),
    )
    if (signal.aborted) return
    if (loaded.some((group) => sessionGone(group.error))) return
    groups.value = loaded
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

/** Sections in render order, each with the groups that belong to it. */
const rendered = computed(() =>
  categories.value.map((category) => ({
    category,
    groups: groups.value.filter((group) => group.category.key === category.key),
  })),
)

async function reload() {
  await Promise.all([changes.refresh().catch(() => {}), load()])
}

defineExpose({ reload })

// ------------------------------------------------------------------- edits

/** Every locally changed attribute, grouped by the MBean it belongs to. */
const edits = computed(() => {
  const byPath = new Map()
  for (const group of groups.value) {
    for (const field of group.def.fields) {
      if (field.readonly) continue
      const before = group.values[field.attr]
      const after = group.draft[field.attr]
      if (String(before ?? '') === String(after ?? '')) continue
      if (!byPath.has(group.path)) byPath.set(group.path, { path: group.path, attributes: {}, fields: [] })
      const entry = byPath.get(group.path)
      entry.attributes[field.attr] = coerce(field, after)
      entry.fields.push({ ...field, from: before, to: after })
    }
  }
  return [...byPath.values()]
})

const changedFields = computed(() => edits.value.flatMap((edit) => edit.fields))
const dirty = computed(() => changedFields.value.length > 0)

/** Fields that will not do anything until something is restarted or redeployed. */
const deferred = computed(() => changedFields.value.filter((field) => field.impact && field.impact !== 'live'))

function revert() {
  for (const group of groups.value) group.draft = { ...group.values }
}

/**
 * The pending edits as a script. Useful before pressing the button on a
 * production domain, and useful afterwards as the record of what was changed.
 */
const scriptFor = () => {
  const context = { username: connection.username, baseUrl: connection.baseUrl }
  return {
    subtitle: changedFields.value.map((field) => `${field.label}: ${field.from ?? '(empty)'} → ${field.to ?? '(empty)'}`).join(' · '),
    wlst: wlstForEdits(edits.value, context),
    curl: curlForEdits(edits.value, context),
  }
}

function showScript() {
  snippet.value.show({ title: 'These changes as a script', ...scriptFor() })
}

// -------------------------------------------------------------- navigation

/** Leaving with unsaved edits is nearly always a mistake, so it is confirmed. */
async function confirmLeavingEdits() {
  if (!dirty.value) return true
  return confirm.value.ask({
    title: 'Discard your unsaved edits?',
    body: `${changedFields.value.length} field${changedFields.value.length === 1 ? '' : 's'} on this page ${
      changedFields.value.length === 1 ? 'has' : 'have'
    } been changed but not saved. Leaving loses those edits — nothing has reached the AdminServer yet.`,
    confirmLabel: 'Discard edits',
    danger: true,
  })
}

onBeforeRouteLeave(() => confirmLeavingEdits())

const beforeUnload = (event) => {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  controller?.abort()
})

// ------------------------------------------------------------------ saving

function describeDeferred() {
  return [...new Set(deferred.value.map((field) => IMPACTS[field.impact]?.label).filter(Boolean))].join(', ')
}

async function save({ activate }) {
  if (!dirty.value || saving.value) return
  const pending = edits.value
  const count = changedFields.value.length
  const deferredCount = deferred.value.length
  const deferredKinds = describeDeferred()

  if (activate) {
    const ok = await confirm.value.ask({
      title: `Activate ${count} change${count === 1 ? '' : 's'}?`,
      body:
        `${changedFields.value.map((field) => field.label).join(', ')}. ` +
        (deferredCount
          ? `${deferredCount} of these only take effect later (${deferredKinds}).`
          : 'These take effect on the running domain immediately.') +
        (connection.productionMode ? ' This domain runs in production mode.' : ''),
      confirmLabel: 'Save and activate',
      danger: connection.productionMode,
      script: scriptFor(),
    })
    if (!ok) return
  }

  saving.value = true
  try {
    await changes.save(pending)
    if (!activate) {
      ui.success(
        'Saved as pending changes',
        'Nothing is live yet — press Activate changes at the top of the page to apply them.',
      )
    }
  } catch (err) {
    if (!sessionGone(err)) {
      ui.error(
        'Could not save the changes',
        `${err.fullText || err.message} — anything saved before the failure is still waiting in the pending changes.`,
      )
      saving.value = false
      await load()
    }
    return
  }

  if (activate) {
    try {
      await changes.activate()
      ui.success(
        'Changes activated',
        deferredCount
          ? `${deferredCount} of them wait for a restart or redeploy before they do anything.`
          : 'The running domain is using the new values.',
      )
    } catch (err) {
      ui.error('Saved, but activating failed', err.fullText || err.message)
    }
  }

  saving.value = false
  await load()
}

async function activatePending() {
  const ok = await confirm.value.ask({
    title: 'Activate the pending changes?',
    body: 'Everything currently waiting is applied to the running domain, including changes made on another page or by another tool.',
    confirmLabel: 'Activate',
    danger: connection.productionMode,
  })
  if (!ok) return
  try {
    await changes.activate()
    ui.success('Changes activated', 'The running domain is using the new values.')
  } catch (err) {
    ui.error('Could not activate the changes', err.fullText || err.message)
  }
  await load()
}

async function discardPending() {
  const hadChanges = changes.hasChanges
  const ok = await confirm.value.ask({
    title: hadChanges ? 'Discard the pending changes?' : 'Release the configuration lock?',
    body: hadChanges
      ? 'Everything waiting to be activated is thrown away and the domain keeps the values it is running with.'
      : 'The lock is released so another operator can edit the domain.',
    confirmLabel: hadChanges ? 'Discard' : 'Release',
    danger: hadChanges,
  })
  if (!ok) return
  try {
    await changes.discard()
    ui.info(hadChanges ? 'Pending changes discarded' : 'Lock released')
  } catch (err) {
    ui.error('Could not discard the changes', err.fullText || err.message)
  }
  await load()
}

// ------------------------------------------------------------------- wiring

// Watched as a string, not as the props themselves: the parent passes a fresh
// `sections` array on every render, and reloading on that would throw away
// whatever the operator has typed each time the page's runtime data refreshes.
watch(
  () => `${props.name} ${props.sections.join(',')}`,
  () => load(),
)

watch(
  () => connection.activeId,
  (id, previous) => {
    if (id === previous) return
    changes.reset()
    groups.value = []
    if (id) {
      changes.refresh().catch(() => {})
      load()
    }
  },
)

changes.refresh().catch(() => {})
load()
</script>

<template>
  <section class="pb-24">
    <HelpPanel id="settings" title="How changing a setting works">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          Change the fields you need. An edited field is outlined and shows what the AdminServer currently holds, so
          you can always see what you are about to change.
        </li>
        <li>
          Press <strong>Save and activate</strong> to apply them, or <strong>Save for later</strong> to stage them and
          activate several edits together.
        </li>
        <li>
          Every field says when it takes effect. <strong>Live on activate</strong> works immediately;
          <strong>Needs a restart</strong> means the running server keeps its old value until it is restarted.
        </li>
      </ol>
      <p>
        WebLogic allows one editor per domain at a time. While you hold that lock nobody else can change the
        configuration, so activate or discard rather than leaving edits open.
      </p>
      <p>
        <strong>Show script</strong> writes the pending edits out as WLST and as the REST calls this console makes —
        worth a glance before changing a production domain, and worth keeping afterwards as the record of what was
        changed.
      </p>
    </HelpPanel>

    <PendingChanges @activate="activatePending" @discard="discardPending" />

    <p v-if="intro" class="mb-4 text-sm text-zinc-600 dark:text-zinc-300">{{ intro }}</p>

    <div v-if="loading && !groups.length" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      Reading the configuration…
    </div>

    <div v-else class="space-y-6">
      <div v-for="section in rendered" :key="section.category.key" class="space-y-4">
        <!-- Only worth a heading when the page shows more than one section. -->
        <div v-if="rendered.length > 1">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {{ section.category.label }}
          </h2>
          <p class="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{{ section.category.blurb }}</p>
        </div>

        <section v-for="group in section.groups" :key="group.def.key" class="card p-4">
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{ group.def.title }}</h3>
          <p class="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ group.def.description }}</p>

          <!-- A group can be missing on older releases; the rest still works. -->
          <p
            v-if="group.error"
            class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            These settings could not be read from this domain — {{ group.error.fullText || group.error.message }}
          </p>

          <div v-else class="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <SettingField
              v-for="field in group.def.fields"
              :key="field.attr"
              :field="field"
              :original="group.values[field.attr]"
              :model-value="group.draft[field.attr]"
              :disabled="lockedByOther || saving"
              @update:model-value="group.draft[field.attr] = $event"
            />
          </div>
        </section>
      </div>
    </div>

    <!-- Unsaved edits follow the page, so the way to apply them is never lost. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="translate-y-3 opacity-0"
    >
      <div v-if="dirty" class="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
        <div class="card flex max-w-3xl flex-wrap items-center gap-3 p-3 shadow-lg">
          <div class="min-w-0">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {{ changedFields.length }} unsaved edit{{ changedFields.length === 1 ? '' : 's' }}
            </p>
            <p class="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {{ changedFields.map((field) => field.label).join(', ') }}
            </p>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <button
              class="btn btn-ghost"
              :disabled="saving"
              title="Show these edits as a WLST script and as the REST calls the console makes — to check before saving, or to keep as a record"
              @click="showScript"
            >
              Show script
            </button>
            <button
              class="btn btn-ghost"
              :disabled="saving"
              title="Put every field back to the value the AdminServer holds."
              @click="revert"
            >
              Undo edits
            </button>
            <button
              class="btn btn-ghost"
              :disabled="saving || lockedByOther"
              title="Stage these changes on the AdminServer without applying them. They stay pending until you activate them."
              @click="save({ activate: false })"
            >
              Save for later
            </button>
            <button
              class="btn btn-primary"
              :disabled="saving || lockedByOther"
              title="Stage these changes and apply them to the running domain."
              @click="save({ activate: true })"
            >
              {{ saving ? 'Saving…' : 'Save and activate' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <ConfirmDialog ref="confirm" />
    <SnippetDialog ref="snippet" />
  </section>
</template>
