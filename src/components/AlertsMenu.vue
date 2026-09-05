<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAlertsStore, DEFAULT_RULES } from '@/stores/alerts'
import { useHistoryStore } from '@/stores/history'
import InfoTip from '@/components/InfoTip.vue'

/**
 * The bell in the top bar: what the watcher has noticed, and the thresholds it
 * watches against. Both live here because the first question after seeing an
 * alert is usually "at what number did that fire?".
 */
const alerts = useAlertsStore()
const history = useHistoryStore()

const open = ref(false)
const showRules = ref(false)

const badge = computed(() => (alerts.unread > 99 ? '99+' : String(alerts.unread)))

const TONE_DOT = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-sky-500',
}

const BELL_TONE = {
  error: 'text-red-500 dark:text-red-400',
  warn: 'text-amber-500 dark:text-amber-400',
  info: 'text-sky-500 dark:text-sky-400',
  none: '',
}

function toggle() {
  open.value = !open.value
  alerts.open = open.value
  if (open.value) alerts.markAllRead()
}

function close() {
  open.value = false
  alerts.open = false
}

const onKey = (event) => {
  if (event.key === 'Escape') close()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const time = (at) => new Date(at).toLocaleTimeString(undefined, { hour12: false })
</script>

<template>
  <div class="relative">
    <button
      class="btn btn-ghost relative"
      :aria-label="alerts.unread ? $t('{count} unread alerts', { count: alerts.unread }) : $t('Alerts')"
      :aria-expanded="open"
      :title="
        $t(
          'Alerts raised by watching this domain: a server leaving RUNNING, a heap or queue past its threshold, a stuck thread. Click to see them and to set the thresholds.',
        )
      "
      @click="toggle"
    >
      <svg
        class="h-4 w-4"
        :class="BELL_TONE[alerts.worst]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span
        v-if="alerts.unread"
        class="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white"
      >
        {{ badge }}
      </span>
    </button>

    <div v-if="open" class="fixed inset-0 z-30" @click="close" />

    <div
      v-if="open"
      class="card absolute right-0 z-40 mt-2 flex max-h-[70vh] w-96 max-w-[92vw] flex-col overflow-hidden shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p class="flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {{ $t('Alerts') }}
          <InfoTip
            :heading="$t('Alerts')"
            :text="
              $t(
                'Raised from the runtime samples the console collects in the background, on whichever page you are on. Each one fires when the condition starts holding and again only once it has cleared, so a long-running problem is one line, not hundreds.',
              )
            "
          />
        </p>
        <button
          class="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('Show the thresholds these alerts fire at')"
          @click="showRules = !showRules"
        >
          {{ showRules ? $t('Hide thresholds') : $t('Thresholds') }}
        </button>
        <button
          v-if="alerts.alerts.length"
          class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="$t('Remove every alert from this list. It does not change anything on the domain.')"
          @click="alerts.clear()"
        >
          {{ $t('Clear') }}
        </button>
      </div>

      <div v-if="showRules" class="space-y-3 border-b border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Server leaves RUNNING') }}</span>
          <input
            type="checkbox"
            :checked="alerts.rules.serverDown"
            @change="alerts.setRule('serverDown', $event.target.checked)"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Heap above') }}</span>
          <span class="flex items-center gap-1">
            <input
              class="input w-20 py-1"
              type="number"
              min="1"
              max="100"
              :value="alerts.rules.heapPercent"
              @change="alerts.setRule('heapPercent', Number($event.target.value))"
            />
            <span class="text-xs text-zinc-400">%</span>
          </span>
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Stuck threads at or above') }}</span>
          <input
            class="input w-20 py-1"
            type="number"
            min="1"
            :value="alerts.rules.stuckThreads"
            @change="alerts.setRule('stuckThreads', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Queued requests at or above') }}</span>
          <input
            class="input w-20 py-1"
            type="number"
            min="0"
            :value="alerts.rules.queueLength"
            @change="alerts.setRule('queueLength', Number($event.target.value))"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">{{ $t('Running server reports unhealthy') }}</span>
          <input
            type="checkbox"
            :checked="alerts.rules.unhealthy"
            @change="alerts.setRule('unhealthy', $event.target.checked)"
          />
        </label>
        <label class="flex items-center justify-between gap-2">
          <span class="text-zinc-700 dark:text-zinc-200">
            {{ $t('Desktop notifications') }}
            <span class="block text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('Also notify when this tab is hidden') }}
            </span>
          </span>
          <input type="checkbox" :checked="alerts.desktop" @change="alerts.setDesktop($event.target.checked)" />
        </label>
        <button
          class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          :title="
            $t('Back to the defaults: heap {heap}%, {stuck} stuck thread, {queued} queued requests', {
              heap: DEFAULT_RULES.heapPercent,
              stuck: DEFAULT_RULES.stuckThreads,
              queued: DEFAULT_RULES.queueLength,
            })
          "
          @click="alerts.resetRules()"
        >
          {{ $t('Reset to defaults') }}
        </button>
      </div>

      <p
        v-if="!history.sampling"
        class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ $t('Runtime sampling is switched off in the backend (WLC_SAMPLE_MS=0), so nothing is being watched.') }}
      </p>
      <p
        v-else-if="history.error"
        class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ history.error }}
      </p>

      <ul v-if="alerts.alerts.length" class="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        <li v-for="alert in alerts.alerts" :key="alert.id" class="flex gap-2 px-3 py-2">
          <span :class="['mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[alert.severity] || 'bg-zinc-400']" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">{{ alert.title }}</p>
            <p class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ alert.detail }}</p>
            <p class="mt-0.5 text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{{ time(alert.at) }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="flex-1 px-3 py-8 text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
        {{
          $t(
            'Nothing to report. Alerts appear here when something changes — the state the domain was already in when you opened the console is on the Dashboard, not in this list.',
          )
        }}
      </p>
    </div>
  </div>
</template>
