<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import * as config from '@/api/config'
import { CATEGORIES, IMPACTS, categoryByKey } from '@/settings/catalog'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { items } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import PendingChanges from '@/components/PendingChanges.vue'
import SettingField from '@/components/SettingField.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorState from '@/components/ErrorState.vue'
import InfoTip from '@/components/InfoTip.vue'

/**
 * The one page in this console that writes rather than reads.
 *
 * Everything on it comes from the settings catalog, and every change goes
 * through WebLogic's staged edit protocol: take the lock, write the pending
 * values, activate. The page never polls — a form that refreshes underneath
 * somebody typing into it is worse than a slightly stale one.
 */

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const connection = useConnectionStore()
const changes = useChangesStore()

const confirm = ref(null)

const targets = ref({ servers: [], clusters: [], dataSources: [], deployments: [] })
const targetsError = ref(null)

/** One entry per catalog group: what the AdminServer holds and what is typed. */
const groups = ref([])
const loading = ref(false)
const saving = ref(false)
const lastUpdated = ref(null)

let controller = null

const category = computed(() => categoryByKey(route.params.category) || CATEGORIES[0])
const choices = computed(() => (category.value.scope ? targets.value[category.value.scope] || [] : []))
const selected = computed(() => String(route.query.name || ''))

/** Somebody else holding the domain lock makes every field read-only. */
const lockedByOther = computed(
  () => changes.locked && changes.lockOwner && changes.lockOwner !== connection.username,
)

// ------------------------------------------------------------------ loading

/**
 * A dead console session is the one failure every call here has to act on:
 * the backend restarted or the session expired, so the page starts over at the
 * connect screen instead of showing an error per field group.
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

async function loadTargets() {
  targetsError.value = null
  try {
    const result = await config.editTargets()
    const names = (collection) =>
      items(collection)
        .map((entry) => entry.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    targets.value = {
      servers: names(result.servers),
      clusters: names(result.clusters),
      dataSources: names(result.dataSources),
      deployments: names(result.deployments),
    }
  } catch (err) {
    if (err?.name === 'AbortError' || sessionGone(err)) return
    targetsError.value = err
  }
}

async function loadGroups() {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  const current = category.value
  const name = selected.value

  if (current.scope && !name) {
    groups.value = []
    return
  }

  loading.value = true
  try {
    // Several groups often read the same MBean — the data source pool tabs all
    // live in JDBCConnectionPoolParams — so each path is fetched once.
    const reads = new Map()
    const read = (path) => {
      if (!reads.has(path)) reads.set(path, config.readMBean(path, { signal }).catch((err) => ({ __error: err })))
      return reads.get(path)
    }

    const loaded = await Promise.all(
      current.groups.map(async (def) => {
        const path = def.path(name)
        const mbean = await read(path)
        if (mbean?.__error) return { def, path, values: {}, draft: {}, error: mbean.__error }
        return { def, path, values: toForm(def.fields, mbean), draft: toForm(def.fields, mbean), error: null }
      }),
    )
    if (signal.aborted) return
    if (loaded.some((group) => sessionGone(group.error))) return
    groups.value = loaded
    lastUpdated.value = Date.now()
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

async function reload() {
  await Promise.all([changes.refresh().catch(() => {}), loadGroups()])
}

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

async function selectCategory(key) {
  if (key === category.value.key) return
  if (!(await confirmLeavingEdits())) return
  router.replace({ name: 'configuration', params: { category: key }, query: {} })
}

async function selectItem(event) {
  const name = event.target.value
  if (name === selected.value) return
  if (!(await confirmLeavingEdits())) {
    // The select has already moved on screen; put it back where it was.
    event.target.value = selected.value
    return
  }
  router.replace({ name: 'configuration', params: { category: category.value.key }, query: { name } })
}

onBeforeRouteLeave(async () => (await confirmLeavingEdits()) || false)

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
  const kinds = new Set(deferred.value.map((field) => IMPACTS[field.impact]?.label).filter(Boolean))
  return [...kinds].join(', ')
}

async function save({ activate }) {
  if (!dirty.value || saving.value) return
  const pending = edits.value

  if (activate) {
    const ok = await confirm.value.ask({
      title: `Activate ${changedFields.value.length} change${changedFields.value.length === 1 ? '' : 's'}?`,
      body:
        `${changedFields.value.map((field) => field.label).join(', ')}. ` +
        (deferred.value.length
          ? `${deferred.value.length} of these only take effect later (${describeDeferred()}).`
          : 'These take effect on the running domain immediately.') +
        (connection.productionMode ? ' This domain runs in production mode.' : ''),
      confirmLabel: 'Save and activate',
      danger: connection.productionMode,
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
    if (sessionGone(err)) return
    ui.error(
      'Could not save the changes',
      `${err.fullText || err.message} — anything saved before the failure is still waiting in the pending changes.`,
    )
    saving.value = false
    await loadGroups()
    return
  }

  if (activate) {
    try {
      await changes.activate()
      ui.success(
        'Changes activated',
        deferred.value.length
          ? `${deferred.value.length} of them wait for a restart or redeploy before they do anything.`
          : 'The running domain is using the new values.',
      )
    } catch (err) {
      ui.error('Saved, but activating failed', err.fullText || err.message)
    }
  }

  saving.value = false
  await loadGroups()
}

async function activatePending() {
  const ok = await confirm.value.ask({
    title: 'Activate the pending changes?',
    body: 'Everything currently waiting is applied to the running domain, including changes made from another page or by another tool.',
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
  await loadGroups()
}

async function discardPending() {
  const ok = await confirm.value.ask({
    title: changes.hasChanges ? 'Discard the pending changes?' : 'Release the configuration lock?',
    body: changes.hasChanges
      ? 'Everything waiting to be activated is thrown away and the domain keeps the values it is running with.'
      : 'The lock is released so another operator can edit the domain.',
    confirmLabel: changes.hasChanges ? 'Discard' : 'Release',
    danger: changes.hasChanges,
  })
  if (!ok) return
  try {
    await changes.discard()
    ui.info(changes.hasChanges ? 'Lock released' : 'Pending changes discarded')
  } catch (err) {
    ui.error('Could not discard the changes', err.fullText || err.message)
  }
  await loadGroups()
}

// ------------------------------------------------------------------- wiring

/** Pick something sensible when the page opens or the category changes. */
watch(
  [category, choices, selected],
  () => {
    const scope = category.value.scope
    if (!scope) return
    const list = choices.value
    if (!list.length) return
    if (!selected.value || !list.includes(selected.value)) {
      router.replace({ name: 'configuration', params: { category: category.value.key }, query: { name: list[0] } })
    }
  },
  { immediate: true },
)

watch([() => category.value.key, selected], loadGroups)

watch(
  () => connection.activeId,
  (id, previous) => {
    if (id === previous) return
    changes.reset()
    groups.value = []
    targets.value = { servers: [], clusters: [], dataSources: [], deployments: [] }
    if (id) start()
  },
)

async function start() {
  await Promise.all([loadTargets(), changes.refresh().catch(() => {})])
  await loadGroups()
}

start()
</script>

<template>
  <div class="pb-24">
    <PageHeader
      title="Configuration"
      subtitle="Change domain settings, then activate them"
      :last-updated="lastUpdated"
      :refreshing="loading"
      help="Reads and writes the domain configuration. Changes are staged first and only reach the running domain when you activate them."
      @refresh="reload"
    />

    <HelpPanel id="configuration" title="How changing a setting works" default-open>
      <ol class="list-decimal space-y-1 pl-4">
        <li>Pick what you want to configure, then which server, cluster, data source or application it belongs to.</li>
        <li>
          Change the fields you need. Edited fields are outlined and show what the AdminServer currently holds, so you
          can always see what you are about to change.
        </li>
        <li>
          Press <strong>Save and activate</strong> to apply them, or <strong>Save for later</strong> to stage them and
          activate several edits together.
        </li>
      </ol>
      <p>
        Every field says when it takes effect. <strong>Live on activate</strong> works immediately;
        <strong>Needs a restart</strong> means the running server keeps its old value until it is restarted from the
        Servers page.
      </p>
      <p>
        WebLogic allows one editor per domain at a time. While you hold that lock nobody else can change the
        configuration, so activate or discard rather than leaving edits open.
      </p>
    </HelpPanel>

    <PendingChanges @activate="activatePending" @discard="discardPending" />

    <!-- What can be configured. Each tab is a section of the catalog. -->
    <div class="mb-4 flex flex-wrap gap-1.5">
      <button
        v-for="entry in CATEGORIES"
        :key="entry.key"
        :class="[
          'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
          entry.key === category.key
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300'
            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800',
        ]"
        :title="entry.blurb"
        @click="selectCategory(entry.key)"
      >
        {{ entry.label }}
      </button>
    </div>

    <ErrorState v-if="targetsError" :error="targetsError" @retry="loadTargets" />

    <div class="card mb-4 p-4">
      <p class="text-sm text-zinc-600 dark:text-zinc-300">{{ category.blurb }}</p>

      <div v-if="category.scope" class="mt-3 max-w-md">
        <label class="label-row" :for="`pick-${category.key}`">
          {{ category.pickerLabel }}
          <InfoTip v-if="category.pickerHelp" :heading="category.pickerLabel" :text="category.pickerHelp" />
        </label>
        <select
          :id="`pick-${category.key}`"
          class="input"
          :value="selected"
          :disabled="!choices.length"
          @change="selectItem($event)"
        >
          <option v-if="!choices.length" value="">Nothing to configure here</option>
          <option v-for="name in choices" :key="name" :value="name">{{ name }}</option>
        </select>
        <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {{ choices.length }} in this domain · settings below apply to the one selected
        </p>
      </div>
    </div>

    <div v-if="loading && !groups.length" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      Reading the configuration…
    </div>

    <div v-else-if="category.scope && !choices.length" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      This domain has no {{ category.label.toLowerCase() }} to configure.
    </div>

    <div v-else class="space-y-4">
      <section v-for="group in groups" :key="group.def.key" class="card p-4">
        <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{ group.def.title }}</h2>
        <p class="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ group.def.description }}</p>

        <!-- A group can be missing on older releases; the rest of the page still works. -->
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
            <button class="btn btn-ghost" :disabled="saving" title="Put every field back to the value the AdminServer holds." @click="revert">
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
  </div>
</template>
