<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { actionsFor, actionDescriptions, useServerActions } from '@/composables/useServerActions'
import { useActivityStore } from '@/stores/activity'
import { useAlertsStore } from '@/stores/alerts'
import { useHistoryStore, WINDOW_OPTIONS } from '@/stores/history'
import { bytes, duration, items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import SparkLine from '@/components/SparkLine.vue'
import InfoTip from '@/components/InfoTip.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { t } from '@/i18n'

/**
 * One server: what it is doing now, the lifecycle buttons that act on it, and
 * its configuration — so a setting that needs a restart can be changed and the
 * restart done without leaving the page.
 */
const route = useRoute()
const confirm = ref(null)
const name = computed(() => String(route.params.name || ''))

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [snapshot, configs] = await Promise.all([wls.runtimeSnapshot({ signal }), wls.configuredServers({ signal })])
  return { snapshot, configs }
})

const { busy, run } = useServerActions({ confirm, onChanged: reload })

/**
 * This page used to be facts alone, which answered "what is it doing" and never
 * "what has it been doing" — and the second question is the one somebody opens
 * a single server's page to ask. The charts are the same samples the monitoring
 * page draws, given the room to be read properly.
 */
const history = useHistoryStore()
const alerts = useAlertsStore()
const activity = useActivityStore()

const heap = computed(() => history.heapAnalysis(name.value))
const pool = computed(() => history.poolAnalysis(name.value))
const jdbc = computed(() => ({
  active: history.points(name.value, 'dsa'),
  waiting: history.points(name.value, 'dsw'),
  pools: history.dataSourceNames(name.value),
}))

/** Restarts of this JVM and changes made from this console, on the same axis. */
const markers = computed(() => {
  const from = Date.now() - (history.windowMs || history.span || 0)
  return [
    ...activity.visible
      .filter((entry) => entry.at >= from)
      .map((entry) => ({ t: entry.at, tone: 'change', label: entry.title })),
    ...history.restarts(name.value).map((restart) => ({ t: restart.t, tone: 'restart', label: t('Restarted') })),
  ]
})

const hasHistory = computed(() => heap.value.points.length > 1 || pool.value.busy.length > 1)

const heapFormat = (value) => `${Math.round(value)}%`

const runtime = computed(() => items(data.value?.snapshot?.serverRuntimes).find((r) => r.name === name.value))
const configured = computed(() => items(data.value?.configs).find((c) => c.name === name.value))

const state = computed(() => {
  const lifecycle = items(data.value?.snapshot?.serverLifeCycleRuntimes).find((r) => r.name === name.value)
  return runtime.value?.state || lifecycle?.state || 'SHUTDOWN'
})

const missing = computed(() => Boolean(data.value) && !configured.value && !runtime.value)

const facts = computed(() => {
  const jvm = runtime.value?.JVMRuntime
  const threads = runtime.value?.threadPoolRuntime
  const heapUsed = jvm ? Number(jvm.heapSizeCurrent || 0) - Number(jvm.heapFreeCurrent || 0) : null
  return [
    {
      label: t('Listening on'),
      value: `${configured.value?.listenAddress || runtime.value?.listenAddress || t('all addresses')}:${
        configured.value?.listenPort ?? runtime.value?.listenPort ?? '—'
      }`,
      mono: true,
      hint: t(
        'The address and plain port this server accepts requests on — the same values the settings below change.',
      ),
    },
    { label: t('Cluster'), value: targetNames(configured.value?.cluster)[0] || t('standalone') },
    {
      label: t('Machine'),
      value: targetNames(configured.value?.machine)[0] || '—',
      hint: t('The machine this server runs on, which is also the Node Manager that can start it.'),
    },
    {
      label: t('Uptime'),
      value: jvm?.uptime ? duration(jvm.uptime) : '—',
      hint: t(
        'How long this JVM has been up. A short uptime you did not cause means the server crashed and was restarted.',
      ),
    },
    {
      label: t('Heap'),
      value: jvm ? `${bytes(heapUsed)} / ${bytes(jvm.heapSizeMax)}` : '—',
      hint: t('Java heap in use against the JVM maximum. Change the maximum in the JVM arguments below, then restart.'),
    },
    {
      label: t('Threads'),
      value: threads
        ? `${num(threads.executeThreadTotalCount)}${
            threads.stuckThreadCount > 0 ? ` · ${t('{count} stuck', { count: threads.stuckThreadCount })}` : ''
          }`
        : '—',
      hint: t('Execute threads in the self-tuning pool. The stuck count follows the stuck-thread settings below.'),
    },
    { label: t('WebLogic'), value: runtime.value?.weblogicVersion || '—' },
    { label: t('Java'), value: jvm?.javaVersion || '—' },
  ]
})
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      :subtitle="$t('Runtime state and configuration of this server')"
      :back="{ name: 'servers' }"
      :back-label="$t('Servers')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'Everything about one server: what it is doing now, the lifecycle actions available for that state, and the settings that decide how it starts and behaves.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="action in actionsFor(state)"
            :key="action.action"
            :class="['btn', action.danger ? 'btn-danger' : 'btn-ghost']"
            :title="actionDescriptions()[action.action]"
            :disabled="busy === name"
            @click="run(name, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('This domain has no server called {name}.', { name }) }}
      {{ $t('It may have been renamed or removed — go back to') }}
      <RouterLink :to="{ name: 'servers' }" class="text-indigo-600 dark:text-indigo-400">
        {{ $t('Servers') }}
      </RouterLink>
      {{ $t('for the current list.') }}
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge :state="state" />
          <StateBadge v-if="runtime?.healthState" kind="health" :health="runtime.healthState" />
          <span v-if="!runtime" class="text-xs text-zinc-400 dark:text-zinc-500">
            {{ $t('Not running, so the runtime figures below are unavailable — the settings still are.') }}
          </span>
        </div>
        <FactList :facts="facts" />
      </div>

      <div v-if="hasHistory" class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {{ $t('Recent history') }}
            <InfoTip
              :heading="$t('Recent history')"
              :text="
                $t(
                  'Collected in the background by the console process, whether or not this page was open, and kept on disk so a restart of the console does not erase it. Hover any line for the reading and the moment it was taken.',
                )
              "
            />
          </h2>
          <div
            class="flex overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700"
            role="group"
            :aria-label="$t('How much history the charts show')"
          >
            <button
              v-for="option in WINDOW_OPTIONS"
              :key="option.value"
              :class="[
                'px-2 py-1 transition',
                history.windowMs === option.value
                  ? 'bg-indigo-500 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
              ]"
              @click="history.setWindow(option.value)"
            >
              {{ option.label() }}
            </button>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {{ $t('Heap') }}
              </p>
              <p class="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                {{
                  $t('floor {floor}%, {collections} collections/h', {
                    floor: heap.floor.last === null ? '—' : Math.round(heap.floor.last),
                    collections: Math.round(heap.collectionsPerHour),
                  })
                }}
              </p>
            </div>
            <SparkLine
              class="mt-1"
              :points="heap.points"
              :baseline="heap.baseline"
              :max="100"
              :min="0"
              :height="120"
              axis
              interactive
              :threshold="Number(alerts.ruleFor(name, 'heapPercent')) || null"
              :markers="markers"
              :gap-ms="history.gapMs"
              :format="heapFormat"
              :title="$t('Heap used as a percentage of the maximum')"
            />
          </div>

          <div>
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {{ $t('Thread pool') }}
              </p>
              <p class="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                {{ $t('{percent}% of the range saturated', { percent: Math.round(pool.saturated * 100) }) }}
              </p>
            </div>
            <SparkLine
              class="mt-1"
              :series="[
                { name: $t('Busy'), points: pool.busy, tone: 'default' },
                { name: $t('Queued'), points: pool.queue, tone: 'bad' },
              ]"
              :height="120"
              axis
              interactive
              :markers="markers"
              :gap-ms="history.gapMs"
              :title="$t('Threads executing requests, and requests waiting for one')"
            />
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {{ $t('Throughput') }}
            </p>
            <SparkLine
              class="mt-1"
              :points="pool.throughput"
              :height="90"
              axis
              interactive
              :markers="markers"
              :gap-ms="history.gapMs"
              unit="req/s"
              :title="$t('Requests completed per second')"
            />
          </div>

          <div v-if="jdbc.pools.length">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {{ $t('JDBC pools') }}
              </p>
              <RouterLink
                :to="{ name: 'data-sources' }"
                class="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {{ $t('{count} data source(s)', { count: jdbc.pools.length }) }}
              </RouterLink>
            </div>
            <SparkLine
              class="mt-1"
              :series="[
                { name: $t('In use'), points: jdbc.active, tone: 'default' },
                { name: $t('Waiting'), points: jdbc.waiting, tone: 'bad' },
              ]"
              :height="90"
              axis
              interactive
              :gap-ms="history.gapMs"
              :title="$t('JDBC connections in use, and requests waiting for one')"
            />
          </div>
        </div>
      </div>

      <SettingsPanel :sections="['servers', 'logging']" :name="name" />
    </template>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
