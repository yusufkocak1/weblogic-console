<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { healthOf, items, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = useUiStore()
const confirm = ref(null)
const busyApp = ref(null)

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes, libs] = await Promise.all([
    wls.appDeployments({ signal }),
    wls.applicationRuntimes({ signal }),
    wls.libraries({ signal }),
  ])
  return { configs, runtimes, libs }
})

/** app name -> [{server, health}] built from every server's applicationRuntimes. */
const runtimeIndex = computed(() => {
  const index = new Map()
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) {
      const key = app.applicationName || app.name
      if (!index.has(key)) index.set(key, [])
      index.get(key).push({ server: server.name, health: healthOf(app.healthState) })
    }
  }
  return index
})

const rows = computed(() =>
  items(data.value?.configs).map((config) => {
    const running = runtimeIndex.value.get(config.name) || []
    const targets = targetNames(config.targets)
    return {
      name: config.name,
      moduleType: config.moduleType || '—',
      targets: targets.length ? targets.join(', ') : '—',
      sourcePath: config.sourcePath || config.absoluteSourcePath || '—',
      staging: config.stagingMode || 'nostage',
      activeOn: running.map((r) => r.server),
      // Any unhealthy instance decides the row's health: that is what an
      // operator needs to notice first.
      health: running.length ? (running.find((r) => r.health !== 'OK')?.health ?? 'OK') : null,
      targetList: targets,
    }
  }),
)

const libraries = computed(() =>
  items(data.value?.libs).map((lib) => ({
    name: lib.name,
    version: [lib.specificationVersion, lib.implementationVersion].filter(Boolean).join(' / ') || '—',
    targets: targetNames(lib.targets).join(', ') || '—',
    sourcePath: lib.sourcePath || '—',
  })),
)

const COLUMNS = [
  { key: 'name', label: 'Application' },
  { key: 'health', label: 'State' },
  { key: 'moduleType', label: 'Type' },
  { key: 'targets', label: 'Targets' },
  { key: 'staging', label: 'Staging' },
  { key: 'actions', label: '', sortable: false, align: 'right' },
]

const LIB_COLUMNS = [
  { key: 'name', label: 'Library' },
  { key: 'version', label: 'Version' },
  { key: 'targets', label: 'Targets' },
  { key: 'sourcePath', label: 'Source' },
]

async function runAction(row, action) {
  const label = action === 'start' ? 'Start' : 'Stop'
  const ok = await confirm.value.ask({
    title: `${label} ${row.name}?`,
    body:
      action === 'start'
        ? `The application will be served on: ${row.targets}.`
        : 'Clients will stop being served by this application on all its targets.',
    confirmLabel: label,
    danger: action === 'stop',
  })
  if (!ok) return

  busyApp.value = row.name
  try {
    await wls.deploymentAction(row.name, action, row.targetList)
    ui.success(`${label} requested`, `${row.name} — state refreshes shortly.`)
    setTimeout(reload, 1500)
  } catch (err) {
    ui.error(`${label} failed for ${row.name}`, err.fullText || err.message)
  } finally {
    busyApp.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Deployments"
      subtitle="Applications and shared libraries in this domain"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      @refresh="reload"
    />

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="Nothing is deployed to this domain."
      search-placeholder="Filter applications…"
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
        <div class="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500" :title="row.sourcePath">
          {{ row.sourcePath }}
        </div>
      </template>

      <template #cell:health="{ row }">
        <div v-if="!row.activeOn.length" class="text-xs text-zinc-400">Not active</div>
        <div v-else class="flex items-center gap-2">
          <StateBadge kind="health" :health="row.health" />
          <span class="text-xs text-zinc-400 dark:text-zinc-500">on {{ row.activeOn.length }}</span>
        </div>
      </template>

      <template #cell:actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <button class="btn btn-ghost px-2 py-1 text-xs" :disabled="busyApp === row.name" @click="runAction(row, 'start')">
            Start
          </button>
          <button class="btn btn-danger px-2 py-1 text-xs" :disabled="busyApp === row.name" @click="runAction(row, 'stop')">
            Stop
          </button>
        </div>
      </template>
    </DataTable>

    <template v-if="libraries.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Shared libraries
      </h2>
      <DataTable :columns="LIB_COLUMNS" :rows="libraries" :searchable="false" dense>
        <template #cell:sourcePath="{ row }">
          <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ row.sourcePath }}</span>
        </template>
      </DataTable>
    </template>

    <ConfirmDialog ref="confirm" />
  </div>
</template>
