<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useUiStore } from '@/stores/ui'
import { baseAppName, healthOf, items, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StateBadge from '@/components/StateBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import HelpPanel from '@/components/HelpPanel.vue'

const ui = useUiStore()
const confirm = ref(null)
const busyApp = ref(null)

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes, libs] = await Promise.all([
    wls.appDeployments({ signal }),
    wls.applicationRuntimes({ signal }),
    wls.libraries({ signal }),
  ])
  // The state column has to agree with the classic console, and the only place
  // that answer exists is the deployment runtime's getState action — one call
  // per application, run a few at a time.
  const states = await wls.deploymentStates(
    items(configs).map((config) => config.name).filter(Boolean),
    { signal },
  )
  return { configs, runtimes, libs, states }
})

/** app name -> [{server, health}] built from every server's applicationRuntimes. */
const runtimeIndex = computed(() => {
  const index = new Map()
  const add = (key, entry) => {
    if (!key) return
    const list = index.get(key)
    if (!list) index.set(key, [entry])
    else if (!list.some((e) => e.server === entry.server)) list.push(entry)
  }
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) {
      const entry = { server: server.name, health: healthOf(app.healthState) }
      // One running application answers to several names: the MBean's own name,
      // the application name without its version, and the two joined by a '#'.
      // The configuration side may use any of them, so index all of them —
      // otherwise a versioned deployment looks like it is running nowhere.
      const appName = app.applicationName || app.name
      add(app.name, entry)
      add(appName, entry)
      add(baseAppName(app.name), entry)
      if (app.applicationVersion) add(`${appName}#${app.applicationVersion}`, entry)
    }
  }
  return index
})

const instancesOf = (name) => runtimeIndex.value.get(name) || runtimeIndex.value.get(baseAppName(name)) || []

const rows = computed(() => {
  const states = data.value?.states
  return items(data.value?.configs).map((config) => {
    const running = instancesOf(config.name)
    const targets = targetNames(config.targets)
    return {
      name: config.name,
      moduleType: config.moduleType || '—',
      targets: targets.length ? targets.join(', ') : '—',
      sourcePath: config.sourcePath || config.absoluteSourcePath || '—',
      staging: config.stagingMode || 'nostage',
      activeOn: running.map((r) => r.server),
      // WebLogic's own answer when it gives one; a deployment that is running
      // somewhere is at least serving, so fall back to that rather than
      // claiming it is not deployed.
      state: states?.get(config.name) || (running.length ? 'ACTIVE' : null),
      // Any unhealthy instance decides the row's health: that is what an
      // operator needs to notice first.
      health: running.length ? (running.find((r) => r.health !== 'OK')?.health ?? 'OK') : null,
      targetList: targets,
    }
  })
})

const libraries = computed(() =>
  items(data.value?.libs).map((lib) => ({
    name: lib.name,
    version: [lib.specificationVersion, lib.implementationVersion].filter(Boolean).join(' / ') || '—',
    targets: targetNames(lib.targets).join(', ') || '—',
    sourcePath: lib.sourcePath || '—',
  })),
)

const COLUMNS = [
  {
    key: 'name',
    label: 'Application',
    hint: 'The deployment name, with the archive or directory it was deployed from underneath.',
  },
  {
    key: 'state',
    label: 'State',
    hint: 'The state WebLogic reports for the deployment — Active means it is serving requests. Next to it: the health of the running instances when it is not OK, and how many servers the application runs on. "Not active" means WebLogic reports no running instance at all — usually because its target servers are down.',
  },
  {
    key: 'moduleType',
    label: 'Type',
    hint: 'What kind of module this is: war for a web application, ear for an enterprise application, jar for an EJB module, and so on.',
  },
  {
    key: 'targets',
    label: 'Targets',
    hint: 'The servers and clusters the application is deployed to. Start and Stop act on all of them at once.',
  },
  {
    key: 'staging',
    label: 'Staging',
    hint: 'How the archive reaches each server: stage copies it to the server, nostage leaves it on a shared path that every server must be able to read, external_stage means you copy it yourself.',
  },
  { key: 'actions', label: '', sortable: false, align: 'right' },
]

const LIB_COLUMNS = [
  {
    key: 'name',
    label: 'Library',
    hint: 'Shared libraries are referenced by applications rather than served themselves. An application that references a missing library will not start.',
  },
  {
    key: 'version',
    label: 'Version',
    hint: 'Specification / implementation version. Applications can pin a specific version, so several versions of one library may be deployed side by side.',
  },
  { key: 'targets', label: 'Targets', hint: 'The servers and clusters this library is deployed to.' },
  { key: 'sourcePath', label: 'Source', hint: 'Where the library archive was deployed from.' },
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
      help="Applications already deployed to this domain, and the shared libraries they can reference. You can start and stop deployments here; installing a new one still needs WLST or the classic console."
      @refresh="reload"
    />

    <HelpPanel id="deployments" title="How to stop and restart an application">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          <strong>Stop</strong> takes the application out of service on every one of its targets. Clients get a 404
          from that point on, and any session state in it is gone.
        </li>
        <li><strong>Start</strong> puts it back into service on the same targets. Together they are a restart.</li>
        <li>
          The <strong>State</strong> column shows the state WebLogic reports for the deployment, plus the health of
          its running instances when that is not OK. It can take a few seconds to catch up after either action.
        </li>
      </ol>
      <p>
        An application that shows <em>Not active</em> is deployed but running nowhere — check that its target servers
        are up on the Servers page before assuming the deployment is broken.
      </p>
    </HelpPanel>

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      empty-text="Nothing is deployed to this domain."
      search-placeholder="Filter applications…"
      search-hint="Matches the application name, type, targets and staging mode of the rows already loaded."
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <div class="font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</div>
        <div class="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500" :title="row.sourcePath">
          {{ row.sourcePath }}
        </div>
      </template>

      <template #cell:state="{ row }">
        <div class="flex flex-wrap items-center gap-2">
          <StateBadge v-if="row.state" :state="row.state" />
          <span v-else class="text-xs text-zinc-400">Not active</span>
          <StateBadge v-if="row.health && row.health !== 'OK'" kind="health" :health="row.health" />
          <span
            v-if="row.activeOn.length"
            class="text-xs text-zinc-400 dark:text-zinc-500"
            :title="`Running on ${row.activeOn.join(', ')}`"
          >
            on {{ row.activeOn.length }}
          </span>
        </div>
      </template>

      <template #cell:actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <button
            class="btn btn-ghost px-2 py-1 text-xs"
            title="Put this application back into service on all of its targets"
            :disabled="busyApp === row.name"
            @click="runAction(row, 'start')"
          >
            Start
          </button>
          <button
            class="btn btn-danger px-2 py-1 text-xs"
            title="Take this application out of service on all of its targets — clients stop being served immediately"
            :disabled="busyApp === row.name"
            @click="runAction(row, 'stop')"
          >
            Stop
          </button>
        </div>
      </template>
    </DataTable>

    <template v-if="libraries.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Shared libraries
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          — code that applications reference instead of bundling; they have no lifecycle buttons of their own
        </span>
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
