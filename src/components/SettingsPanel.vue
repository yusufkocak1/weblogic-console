<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import * as config from '@/api/config'
import { impacts, categoryByKey } from '@/settings/catalog'
import { useActivityStore } from '@/stores/activity'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { curlForEdits, wlstForEdits } from '@/utils/wlst'
import HelpPanel from '@/components/HelpPanel.vue'
import PendingChanges from '@/components/PendingChanges.vue'
import SettingField from '@/components/SettingField.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SnippetDialog from '@/components/SnippetDialog.vue'
import { t } from '@/i18n'

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
const activity = useActivityStore()

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

/**
 * This user's role does not allow configuration changes at all.
 *
 * WebLogic answers 403 to the edit tree rather than listing what a role may do,
 * so the backend asks once at connect and the store remembers any later refusal.
 * Knowing it up front is the whole point: filling a form in and losing it at the
 * Save is the worst way to find out, so the panel says so and shows values only.
 */
const readOnly = computed(() => !connection.canConfigure || changes.forbidden)

/** Nothing here can be edited, whether by role or because of the domain lock. */
const frozen = computed(() => readOnly.value || lockedByOther.value)

// ------------------------------------------------------------------ loading

/**
 * A dead console session is the one failure every call here has to act on: the
 * backend restarted or the session expired, so the page starts over at the
 * connect screen instead of showing an error per group.
 */
function sessionGone(err) {
  if (!err?.isAuthError) return false
  connection.reset()
  ui.error(t('Session ended'), t('Connect to the AdminServer again.'))
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
          // A refused read and a missing MBean both come back as an error, but
          // they mean different things to the operator, so they are kept apart.
          if (mbean?.__error) {
            return {
              category,
              def,
              path,
              values: {},
              draft: {},
              error: mbean.__error,
              forbidden: Boolean(mbean.__error.isForbidden),
            }
          }
          return {
            category,
            def,
            path,
            values: toForm(def.fields, mbean),
            draft: toForm(def.fields, mbean),
            error: null,
            forbidden: false,
          }
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
      entry.fields.push({ ...field, from: before, to: after, __path: group.path })
    }
  }
  return [...byPath.values()]
})

const changedFields = computed(() => edits.value.flatMap((edit) => edit.fields))
const dirty = computed(() => changedFields.value.length > 0)

/** Fields that will not do anything until something is restarted or redeployed. */
const deferred = computed(() => changedFields.value.filter((field) => field.impact && field.impact !== 'live'))

/** An edited value the way it should read in a sentence about it. */
function display(value) {
  if (value === null || value === undefined || value === '') return t('(empty)')
  if (typeof value === 'boolean') return value ? t('On') : t('Off')
  return String(value)
}

/**
 * The pending edits as the confirm dialog lists them. Confirming a count of
 * fields is not really confirming anything, so the question shows each field
 * with the value it holds now and the value it is about to get.
 */
const changeList = computed(() =>
  changedFields.value.map((field) => ({
    label: field.attr,
    note: field.impact && field.impact !== 'live' ? impacts()[field.impact]?.label : '',
    from: display(field.from),
    to: display(field.to),
  })),
)

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
    subtitle: changedFields.value
      .map((field) => `${field.attr}: ${field.from ?? t('(empty)')} → ${field.to ?? t('(empty)')}`)
      .join(' · '),
    wlst: wlstForEdits(edits.value, context),
    curl: curlForEdits(edits.value, context),
  }
}

function showScript() {
  snippet.value.show({ title: t('These changes as a script'), ...scriptFor() })
}

// -------------------------------------------------------------- navigation

/** Leaving with unsaved edits is nearly always a mistake, so it is confirmed. */
async function confirmLeavingEdits() {
  if (!dirty.value) return true
  return confirm.value.ask({
    title: t('Discard your unsaved edits?'),
    body:
      changedFields.value.length === 1
        ? t(
            '1 field on this page has been changed but not saved. Leaving loses that edit — nothing has reached the AdminServer yet.',
          )
        : t(
            '{count} fields on this page have been changed but not saved. Leaving loses those edits — nothing has reached the AdminServer yet.',
            { count: changedFields.value.length },
          ),
    confirmLabel: t('Discard edits'),
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
  return [...new Set(deferred.value.map((field) => impacts()[field.impact]?.label).filter(Boolean))].join(', ')
}

/** What this panel is configuring, as it should read in a sentence. */
const subject = () => props.name || connection.domainName

/**
 * The edits that would put every attribute back where it was. Built from the
 * same field definitions as the forward edits, so the old value is coerced the
 * same way the new one was — an emptied text field goes back to null, not to
 * the string "null".
 */
function inverseOf(pending) {
  return pending.map((edit) => ({
    path: edit.path,
    attributes: Object.fromEntries(edit.fields.map((field) => [field.attr, coerce(field, field.from)])),
  }))
}

/**
 * Writes one save into the activity log, attribute by attribute, along with
 * the edits that would undo it. A failed save is logged too: "I pressed save
 * and it errored" is exactly the kind of thing worth being able to look up.
 */
function logChange({ fields, undoEdits }, { activated, error }) {
  if (!fields.length) return
  const changes = fields.map((field) => ({
    label: field.label,
    attr: field.attr,
    path: field.__path,
    from: field.from,
    to: field.to,
    note: field.impact && field.impact !== 'live' ? impacts()[field.impact]?.label : '',
  }))
  const count = fields.length
  const title =
    count === 1
      ? t('1 setting changed on {subject}', { subject: subject() })
      : t('{count} settings changed on {subject}', { count, subject: subject() })

  if (error) {
    activity.record({
      kind: 'config',
      title: t('Failed — {title}', { title }),
      summary: error.fullText || error.message,
      changes,
      status: 'failed',
      undoNote: t(
        'Nothing is offered to roll back, because it is not certain how much of this reached the AdminServer. The pending changes bar shows what is actually waiting.',
      ),
    })
    return
  }

  activity.record({
    kind: 'config',
    title,
    summary: activated
      ? t('Saved and activated — the running domain is using the new values.')
      : t('Saved as pending changes; not activated yet.'),
    changes,
    undo: {
      type: 'config',
      edits: undoEdits,
      activate: activated,
      summary: activated
        ? t('The previous values were written back and activated.')
        : t('The previous values were written back into the pending changes.'),
      body: activated
        ? t(
            'The old values are written back through the same staged edit and activated, so the domain ends up where it started.',
          )
        : t(
            'The old values are written back into the pending changes, which still have to be activated or discarded.',
          ),
      hint: t('Write the previous values back'),
    },
  })
}

async function save({ activate }) {
  if (!dirty.value || saving.value || frozen.value) return
  const pending = edits.value
  const count = changedFields.value.length
  const deferredCount = deferred.value.length
  const deferredKinds = describeDeferred()

  const ok = await confirm.value.ask(
    activate
      ? {
          title:
            count === 1
              ? t('Apply 1 change to the domain?')
              : t('Apply {count} changes to the domain?', { count }),
          body:
            (deferredCount
              ? t('{count} of these only take effect later ({kinds}).', {
                  count: deferredCount,
                  kinds: deferredKinds,
                })
              : t('These take effect on the running domain immediately.')) +
            (connection.productionMode ? ' ' + t('This domain runs in production mode.') : ''),
          confirmLabel: t('Save and activate'),
          danger: connection.productionMode,
          changes: changeList.value,
          script: scriptFor(),
        }
      : {
          title: count === 1 ? t('Save 1 change for later?') : t('Save {count} changes for later?', { count }),
          body: t(
            'These are written to the AdminServer as pending changes and hold the domain lock until they are activated or discarded. The running domain keeps its current values until then.',
          ),
          confirmLabel: t('Save for later'),
          changes: changeList.value,
          script: scriptFor(),
        },
  )
  if (!ok) return

  // Captured before the save: `load()` at the end refreshes the form, and the
  // activity log has to hold what was actually changed, not what is on screen
  // afterwards.
  const record = { fields: changedFields.value, undoEdits: inverseOf(pending) }

  saving.value = true
  try {
    await changes.save(pending)
    if (!activate) {
      ui.success(
        t('Saved as pending changes'),
        t('Nothing is live yet — press Activate changes at the top of the page to apply them.'),
      )
    }
  } catch (err) {
    if (!sessionGone(err)) {
      logChange(record, { activated: false, error: err })
      if (err.isForbidden) {
        // Now it is certain rather than probed: fold it into the connection so
        // every settings page in this session opens read-only from here on.
        connection.markCannotConfigure()
        ui.error(
          t('You are not authorized to change these settings'),
          err.detail ||
            t('Your WebLogic user may read this configuration but not change it. Ask a domain administrator.'),
        )
      } else {
        ui.error(
          t('Could not save the changes'),
          `${err.fullText || err.message} — ${t('anything saved before the failure is still waiting in the pending changes.')}`,
        )
      }
      saving.value = false
      await load()
    }
    return
  }

  let activated = false
  if (activate) {
    try {
      await changes.activate()
      activated = true
      ui.success(
        t('Changes activated'),
        deferredCount
          ? t('{count} of them wait for a restart or redeploy before they do anything.', { count: deferredCount })
          : t('The running domain is using the new values.'),
      )
    } catch (err) {
      ui.error(t('Saved, but activating failed'), err.fullText || err.message)
    }
  }

  logChange(record, { activated })

  saving.value = false
  await load()
}

async function activatePending() {
  const ok = await confirm.value.ask({
    title: t('Activate the pending changes?'),
    body: t(
      'Everything currently waiting is applied to the running domain, including changes made on another page or by another tool.',
    ),
    confirmLabel: t('Activate'),
    danger: connection.productionMode,
  })
  if (!ok) return
  // Read before activating: activating empties the pending set, and the whole
  // point of the entry is to say what was in it.
  const applied = changes.pending.map((change) => ({
    label: change.text,
    from: t('pending'),
    to: change.detail || t('applied'),
  }))
  try {
    await changes.activate()
    activity.record({
      kind: 'lock',
      title: t('Pending changes activated on {subject}', { subject: subject() }),
      summary: t(
        'Everything that was waiting is now live, including changes made on another page or by another tool. Only the edits this console made are listed here.',
      ),
      changes: applied,
      undoNote: t(
        'Activating is not undone as one operation. Roll back the individual changes above, or edit the settings back by hand.',
      ),
    })
    ui.success(t('Changes activated'), t('The running domain is using the new values.'))
  } catch (err) {
    ui.error(t('Could not activate the changes'), err.fullText || err.message)
  }
  await load()
}

async function discardPending() {
  const hadChanges = changes.hasChanges
  const ok = await confirm.value.ask({
    title: hadChanges ? t('Discard the pending changes?') : t('Release the configuration lock?'),
    body: hadChanges
      ? t('Everything waiting to be activated is thrown away and the domain keeps the values it is running with.')
      : t('The lock is released so another operator can edit the domain.'),
    confirmLabel: hadChanges ? t('Discard') : t('Release'),
    danger: hadChanges,
  })
  if (!ok) return
  const discarded = changes.pending.map((change) => ({
    label: change.text,
    from: change.detail || t('pending'),
    to: t('(discarded)'),
  }))
  try {
    await changes.discard()
    if (hadChanges) {
      activity.record({
        kind: 'lock',
        title: t('Pending changes discarded on {subject}', { subject: subject() }),
        summary: t('Nothing reached the running domain, which keeps the values it was already using.'),
        changes: discarded,
        undoNote: t('Discarded edits are gone from the AdminServer. Make them again if they were wanted.'),
      })
    }
    ui.info(hadChanges ? t('Pending changes discarded') : t('Lock released'))
  } catch (err) {
    ui.error(t('Could not discard the changes'), err.fullText || err.message)
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
    <HelpPanel id="settings" :title="$t('How changing a setting works')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          {{
            $t(
              'Change the fields you need. An edited field is outlined and shows what the AdminServer currently holds, so you can always see what you are about to change.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Press Save and activate to apply them, or Save for later to stage them and activate several edits together.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Every field says when it takes effect. Live on activate works immediately; Needs a restart means the running server keeps its old value until it is restarted.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'WebLogic allows one editor per domain at a time. While you hold that lock nobody else can change the configuration, so activate or discard rather than leaving edits open.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'Show script writes the pending edits out as WLST and as the REST calls this console makes — worth a glance before changing a production domain, and worth keeping afterwards as the record of what was changed.',
          )
        }}
      </p>
    </HelpPanel>

    <!-- Said once, at the top, rather than as a badge on every field. -->
    <div
      v-if="readOnly"
      class="mb-4 rounded-xl border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {{ $t('These settings are read-only for you') }}
      </p>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {{
          $t(
            'Your WebLogic user ({user}) may read this domain but not change its configuration, so the fields below show the current values and cannot be edited. A domain administrator can grant the role this needs.',
            { user: connection.username },
          )
        }}
      </p>
    </div>

    <PendingChanges @activate="activatePending" @discard="discardPending" />

    <p v-if="intro" class="mb-4 text-sm text-zinc-600 dark:text-zinc-300">{{ intro }}</p>

    <div v-if="loading && !groups.length" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('Reading the configuration…') }}
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

          <!-- Refused rather than absent: nothing is wrong, it is just not ours. -->
          <p
            v-if="group.forbidden"
            class="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
          >
            {{ $t('You are not authorized to read these settings, so they are not shown.') }}
          </p>

          <!-- A group can be missing on older releases; the rest still works. -->
          <p
            v-else-if="group.error"
            class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            {{ $t('These settings could not be read from this domain —') }}
            {{ group.error.fullText || group.error.message }}
          </p>

          <div v-else class="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <SettingField
              v-for="field in group.def.fields"
              :key="field.attr"
              :field="field"
              :original="group.values[field.attr]"
              :model-value="group.draft[field.attr]"
              :disabled="frozen || saving"
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
      <div v-if="dirty && !readOnly" class="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
        <div class="card flex max-w-3xl flex-wrap items-center gap-3 p-3 shadow-lg">
          <div class="min-w-0">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {{
                changedFields.length === 1
                  ? $t('1 unsaved edit')
                  : $t('{count} unsaved edits', { count: changedFields.length })
              }}
            </p>
            <p class="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {{ changedFields.map((field) => field.attr).join(', ') }}
            </p>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <button
              class="btn btn-ghost"
              :disabled="saving"
              :title="
                $t(
                  'Show these edits as a WLST script and as the REST calls the console makes — to check before saving, or to keep as a record',
                )
              "
              @click="showScript"
            >
              {{ $t('Show script') }}
            </button>
            <button
              class="btn btn-ghost"
              :disabled="saving"
              :title="$t('Put every field back to the value the AdminServer holds.')"
              @click="revert"
            >
              {{ $t('Undo edits') }}
            </button>
            <button
              class="btn btn-ghost"
              :disabled="saving || lockedByOther"
              :title="
                $t(
                  'Stage these changes on the AdminServer without applying them. They stay pending until you activate them.',
                )
              "
              @click="save({ activate: false })"
            >
              {{ $t('Save for later') }}
            </button>
            <button
              class="btn btn-primary"
              :disabled="saving || lockedByOther"
              :title="$t('Stage these changes and apply them to the running domain.')"
              @click="save({ activate: true })"
            >
              {{ saving ? $t('Saving…') : $t('Save and activate') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <ConfirmDialog ref="confirm" />
    <SnippetDialog ref="snippet" />
  </section>
</template>
