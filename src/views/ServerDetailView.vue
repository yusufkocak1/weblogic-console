<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { actionsFor, ACTION_DESCRIPTIONS, useServerActions } from '@/composables/useServerActions'
import { bytes, duration, items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

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
      label: 'Listening on',
      value: `${configured.value?.listenAddress || runtime.value?.listenAddress || 'all addresses'}:${
        configured.value?.listenPort ?? runtime.value?.listenPort ?? '—'
      }`,
      mono: true,
      hint: 'The address and plain port this server accepts requests on — the same values the settings below change.',
    },
    { label: 'Cluster', value: targetNames(configured.value?.cluster)[0] || 'standalone' },
    { label: 'Machine', value: targetNames(configured.value?.machine)[0] || '—', hint: 'The machine this server runs on, which is also the Node Manager that can start it.' },
    {
      label: 'Uptime',
      value: jvm?.uptime ? duration(jvm.uptime) : '—',
      hint: 'How long this JVM has been up. A short uptime you did not cause means the server crashed and was restarted.',
    },
    {
      label: 'Heap',
      value: jvm ? `${bytes(heapUsed)} / ${bytes(jvm.heapSizeMax)}` : '—',
      hint: 'Java heap in use against the JVM maximum. Change the maximum in the JVM arguments below, then restart.',
    },
    {
      label: 'Threads',
      value: threads ? `${num(threads.executeThreadTotalCount)}${threads.stuckThreadCount > 0 ? ` · ${threads.stuckThreadCount} stuck` : ''}` : '—',
      hint: 'Execute threads in the self-tuning pool. The stuck count follows the stuck-thread settings below.',
    },
    { label: 'WebLogic', value: runtime.value?.weblogicVersion || '—' },
    { label: 'Java', value: jvm?.javaVersion || '—' },
  ]
})
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      subtitle="Runtime state and configuration of this server"
      :back="{ name: 'servers' }"
      back-label="Servers"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="Everything about one server: what it is doing now, the lifecycle actions available for that state, and the settings that decide how it starts and behaves."
      @refresh="reload"
    >
      <template #actions>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="action in actionsFor(state)"
            :key="action.action"
            :class="['btn', action.danger ? 'btn-danger' : 'btn-ghost']"
            :title="ACTION_DESCRIPTIONS[action.action]"
            :disabled="busy === name"
            @click="run(name, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      This domain has no server called <span class="font-mono">{{ name }}</span
      >. It may have been renamed or removed — go back to
      <RouterLink :to="{ name: 'servers' }" class="text-indigo-600 dark:text-indigo-400">Servers</RouterLink> for the
      current list.
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge :state="state" />
          <StateBadge v-if="runtime?.healthState" kind="health" :health="runtime.healthState" />
          <span v-if="!runtime" class="text-xs text-zinc-400 dark:text-zinc-500">
            Not running, so the runtime figures below are unavailable — the settings still are.
          </span>
        </div>
        <FactList :facts="facts" />
      </div>

      <SettingsPanel :sections="['servers', 'logging']" :name="name" />
    </template>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
