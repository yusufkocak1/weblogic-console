<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useActivityStore, RETENTION_OPTIONS } from '@/stores/activity'
import { useUiStore } from '@/stores/ui'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import InfoTip from '@/components/InfoTip.vue'
import { t } from '@/i18n'

/**
 * The counter-clockwise arrow in the top bar: what this console has changed
 * recently, spelled out value by value, and the button that puts it back.
 *
 * The list is about changes, not about navigation — "Maximum capacity on
 * OrdersDS: 15 → 40", not "opened the data sources page" — because the only
 * reason to look here is that something behaves differently than it did ten
 * minutes ago.
 */
const activity = useActivityStore()
const ui = useUiStore()

const open = ref(false)
const showSettings = ref(false)
const confirm = ref(null)

/** Built per read so the labels follow a language change. */
const kindLabels = () => ({
  config: t('Configuration'),
  lifecycle: t('Server'),
  deployment: t('Deployment'),
  lock: t('Change lock'),
})

const KIND_DOT = {
  config: 'bg-indigo-500',
  lifecycle: 'bg-sky-500',
  deployment: 'bg-violet-500',
  lock: 'bg-zinc-400',
}

const statusNotes = () => ({
  failed: { label: t('Failed'), class: 'text-red-500 dark:text-red-400' },
  'rolled-back': { label: t('Rolled back'), class: 'text-amber-600 dark:text-amber-400' },
})

const badge = computed(() => (activity.count > 99 ? '99+' : String(activity.count)))

/**
 * Ticks only while the panel is open, so the "12m left" on each entry counts
 * down in front of the person reading it rather than freezing at whatever it
 * said when the panel was opened.
 */
const now = ref(Date.now())
let tick = null

function toggle() {
  open.value = !open.value
  clearInterval(tick)
  if (open.value) {
    now.value = Date.now()
    tick = setInterval(() => (now.value = Date.now()), 30000)
  }
}

function close() {
  open.value = false
  clearInterval(tick)
  tick = null
}

const onKey = (event) => {
  if (event.key === 'Escape') close()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(tick)
})

const time = (at) => new Date(at).toLocaleTimeString(undefined, { hour12: false })

/** How long an entry has left before the retention window drops it. */
function expiresIn(entry) {
  const left = entry.at + activity.retentionMs - now.value
  if (left <= 0) return t('expiring')
  const minutes = Math.round(left / 60000)
  return minutes >= 60
    ? t('{hours}h left', { hours: Math.round(minutes / 60) })
    : t('{minutes}m left', { minutes: Math.max(1, minutes) })
}

const display = (value) => {
  if (value === null || value === undefined || value === '') return t('(empty)')
  if (typeof value === 'boolean') return value ? t('On') : t('Off')
  return String(value)
}

/**
 * Rolling back is itself a change to the domain, so it is confirmed the same
 * way the original change was — with the values it is about to write, not with
 * a count.
 */
async function rollback(entry) {
  const ok = await confirm.value.ask({
    title: t('Roll this change back?'),
    body:
      `${entry.title}. ` +
      (entry.undo?.body ||
        t(
          'The console makes the opposite request against the domain. It is a new change, not an erasure of the old one.',
        )),
    confirmLabel: t('Roll back'),
    danger: true,
    changes: entry.changes?.length
      ? entry.changes.map((change) => ({
          label: change.label,
          note: change.note || '',
          from: display(change.to),
          to: display(change.from),
        }))
      : null,
  })
  if (!ok) return

  try {
    await activity.rollback(entry.id)
    ui.success(t('Rolled back'), entry.title)
  } catch (err) {
    ui.error(t('Could not roll that back'), err.fullText || err.message)
  }
}

async function clearAll() {
  const ok = await confirm.value.ask({
    title: t('Clear the activity log?'),
    body: t('The list is emptied and nothing in it can be rolled back afterwards. The domain itself is not touched.'),
    confirmLabel: t('Clear'),
    danger: true,
  })
  if (ok) activity.clear()
}
</script>

<template>
  <div class="relative">
    <button
      class="btn btn-ghost relative"
      :aria-label="
        activity.count ? $t('Activity: {count} recent changes', { count: activity.count }) : $t('Activity')
      "
      :aria-expanded="open"
      :title="
        $t(
          'What you have changed on this domain recently — settings, server actions, deployments — each with the values before and after, and a Roll back button while the entry lasts.',
        )
      "
      @click="toggle"
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 4v4h4" />
        <path d="M12 8v4.5l3 1.8" />
      </svg>
      <span
        v-if="activity.count"
        class="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-500 px-1 text-[10px] font-semibold leading-4 text-white"
      >
        {{ badge }}
      </span>
    </button>

    <div v-if="open" class="fixed inset-0 z-30" @click="close" />

    <div
      v-if="open"
      class="card absolute right-0 z-40 mt-2 flex max-h-[75vh] w-[26rem] max-w-[92vw] flex-col overflow-hidden shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p class="flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {{ $t('Activity') }}
          <InfoTip
            :heading="$t('Recent changes')"
            :text="
              $t(
                'Every change this console made to the domain — a setting written, a server started or stopped, an application deployed — with the value it held before and the value it holds now. Kept for a short window so a mistake can be undone; it is not an audit trail, and it does not record what other tools or other operators did.',
              )
            "
          />
        </p>
        <button
          class="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('How long entries are kept before they expire')"
          @click="showSettings = !showSettings"
        >
          {{ showSettings ? $t('Hide settings') : activity.retentionLabel }}
        </button>
        <button
          v-if="activity.entries.length"
          class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('Empty the list. Nothing in it can be rolled back afterwards.')"
          @click="clearAll"
        >
          {{ $t('Clear') }}
        </button>
      </div>

      <div v-if="showSettings" class="space-y-2 border-b border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">
            {{ $t('Keep changes for') }}
            <span class="block text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('An entry disappears when its window runs out, and its rollback goes with it.') }}
            </span>
          </span>
          <select
            class="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            :value="activity.retentionMs"
            @change="activity.setRetention(Number($event.target.value))"
          >
            <option v-for="option in RETENTION_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label() }}
            </option>
          </select>
        </label>
      </div>

      <ul v-if="activity.visible.length" class="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        <li v-for="entry in activity.visible" :key="entry.id" class="px-3 py-2.5">
          <div class="flex gap-2">
            <span :class="['mt-1.5 h-2 w-2 shrink-0 rounded-full', KIND_DOT[entry.kind] || 'bg-zinc-400']" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">{{ entry.title }}</p>
              <p v-if="entry.summary" class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {{ entry.summary }}
              </p>

              <!-- The change itself: one line per attribute, before and after. -->
              <ul
                v-if="entry.changes?.length"
                class="mt-1.5 space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <li v-for="(change, index) in entry.changes" :key="index">
                  <p class="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                    {{ change.label }}
                    <span v-if="change.attr" class="font-mono font-normal text-zinc-400 dark:text-zinc-500">
                      {{ change.attr }}
                    </span>
                    <span v-if="change.note" class="font-normal text-zinc-400 dark:text-zinc-500">{{ change.note }}</span>
                  </p>
                  <p class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span class="line-through">{{ display(change.from) }}</span>
                    <span class="mx-1">&rarr;</span>
                    <span class="font-semibold text-zinc-900 dark:text-zinc-50">{{ display(change.to) }}</span>
                  </p>
                  <p v-if="change.path" class="truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                    {{ change.path }}
                  </p>
                </li>
              </ul>

              <div class="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                <span>{{ time(entry.at) }}</span>
                <span>· {{ kindLabels()[entry.kind] || entry.kind }}</span>
                <span v-if="entry.user">· {{ entry.user }}</span>
                <span>· {{ expiresIn(entry) }}</span>
                <span v-if="statusNotes()[entry.status]" :class="statusNotes()[entry.status].class">
                  · {{ statusNotes()[entry.status].label }}
                </span>
              </div>

              <p v-if="!activity.revertible(entry) && entry.undoNote" class="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {{ entry.undoNote }}
              </p>
            </div>

            <button
              v-if="activity.revertible(entry)"
              class="btn btn-ghost h-7 shrink-0 self-start px-2 text-xs"
              :disabled="Boolean(activity.undoing)"
              :title="entry.undo?.hint || $t('Make the opposite change on the domain')"
              @click="rollback(entry)"
            >
              {{ activity.undoing === entry.id ? $t('Rolling back…') : $t('Roll back') }}
            </button>
          </div>
        </li>
      </ul>

      <p v-else class="flex-1 px-3 py-8 text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
        {{
          $t(
            'Nothing changed on this domain in the last {window}. Settings you save, servers you start or stop and applications you deploy appear here, with a way to undo them.',
            { window: activity.retentionLabel },
          )
        }}
      </p>
    </div>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
