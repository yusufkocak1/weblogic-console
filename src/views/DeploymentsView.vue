<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { useResource } from '@/composables/useResource'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { healthOf, isDeploymentRuntime, items, targetNames } from '@/utils/format'
import { curlFor, curlForDeploymentAction, wlstForDeploymentAction, wlstForUndeploy } from '@/utils/wlst'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import DeployDialog from '@/components/DeployDialog.vue'
import StateBadge from '@/components/StateBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import HelpPanel from '@/components/HelpPanel.vue'

const ui = useUiStore()
const changes = useChangesStore()
const connection = useConnectionStore()
const confirm = ref(null)
const deployDialog = ref(null)
const busyApp = ref(null)
const selected = ref([])

const scriptContext = () => ({ username: connection.username, baseUrl: connection.baseUrl })

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

/** Every server's application runtimes, flattened once for the row lookups. */
const runtimeApps = computed(() => {
  const list = []
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) list.push({ server: server.name, app })
  }
  return list
})

/** The servers a configured deployment is actually loaded on, with their health. */
const instancesOf = (name) => {
  const found = []
  for (const { server, app } of runtimeApps.value) {
    if (!isDeploymentRuntime(name, app)) continue
    if (found.some((entry) => entry.server === server)) continue
    found.push({ server, health: healthOf(app.healthState) })
  }
  return found
}

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
      // WebLogic's own answer, and nothing invented on top of it. A loaded
      // runtime is not proof the deployment is serving — a retired version
      // still has one while it drains its last sessions — so when the getState
      // call gave no answer the state stays UNKNOWN rather than ACTIVE.
      state: states?.get(config.name) || (running.length ? 'UNKNOWN' : null),
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
    hint: 'The state WebLogic reports for the deployment — Active means it is serving requests, Retired means a newer version took over and this one is only draining its last sessions. Next to it: the health of the loaded instances when it is not OK, and how many servers the application is loaded on. "Not active" means WebLogic reports no state and no instance at all — usually because its target servers are down.',
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
    script: {
      subtitle: `${label} ${row.name}`,
      wlst: wlstForDeploymentAction(row.name, action, row.targetList, scriptContext()),
      curl: curlForDeploymentAction(row.name, action, row.targetList, scriptContext()),
    },
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

/** Start or stop every ticked application, one after another. */
async function runBulk(action) {
  const chosen = rows.value.filter((row) => selected.value.includes(row.name))
  if (!chosen.length) return
  const label = action === 'start' ? 'Start' : 'Stop'
  const ok = await confirm.value.ask({
    title: `${label} ${chosen.length} application${chosen.length === 1 ? '' : 's'}?`,
    body: `${chosen.map((row) => row.name).join(', ')}. ${
      action === 'stop'
        ? 'Clients stop being served by each of them on all of their targets.'
        : 'Each is put back into service on its own targets.'
    }`,
    confirmLabel: `${label} ${chosen.length}`,
    danger: action === 'stop',
  })
  if (!ok) return

  const failures = []
  for (const row of chosen) {
    busyApp.value = row.name
    try {
      await wls.deploymentAction(row.name, action, row.targetList)
    } catch (err) {
      failures.push(`${row.name}: ${err.fullText || err.message}`)
    }
  }
  busyApp.value = null
  selected.value = []

  const done = chosen.length - failures.length
  if (done) ui.success(`${label} requested for ${done}`, 'States refresh shortly.')
  if (failures.length) ui.error(`${label} failed for ${failures.length}`, failures.join(' · '))
  setTimeout(reload, 1500)
}

/**
 * Removing an application from the domain altogether. This is a configuration
 * change, not a lifecycle one, so it takes the lock, deletes the deployment and
 * activates — and it is not undoable from here, which the dialog says.
 */
async function undeploy(row) {
  const ok = await confirm.value.ask({
    title: `Undeploy ${row.name}?`,
    body: `The application is removed from the domain configuration and stops being served on ${row.targets}. Putting it back means deploying the archive again.`,
    confirmLabel: 'Undeploy',
    danger: true,
    script: {
      subtitle: `Undeploy ${row.name}`,
      wlst: wlstForUndeploy(row.name, row.targetList, scriptContext()),
      curl: curlFor('DELETE', `/edit/appDeployments/${encodeURIComponent(row.name)}`, undefined, scriptContext()),
    },
  })
  if (!ok) return

  busyApp.value = row.name
  try {
    await changes.refresh()
    if (changes.locked && changes.lockOwner && changes.lockOwner !== connection.username) {
      throw new Error(`${changes.lockOwner} holds the configuration lock.`)
    }
    if (!changes.locked) await config.startEdit()
    await wls.undeployApplication(row.name)
    await changes.activate()
    ui.success('Undeployed', `${row.name} has been removed from the domain.`)
    reload()
  } catch (err) {
    ui.error(`Could not undeploy ${row.name}`, err.fullText || err.message)
    await changes.discard().catch(() => {})
  } finally {
    busyApp.value = null
  }
}

function redeploy(row) {
  deployDialog.value.show({ mode: 'redeploy', name: row.name, stagingMode: row.staging, targets: row.targetList })
}
</script>

<template>
  <div>
    <PageHeader
      title="Deployments"
      subtitle="Applications and shared libraries in this domain"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="Every application deployed to this domain and the shared libraries they reference. Install a new archive, replace one that is already there, start and stop them, or remove them entirely."
      @refresh="reload"
    >
      <template #actions>
        <button
          class="btn btn-primary"
          title="Upload a WAR, EAR or JAR and install it in this domain"
          @click="deployDialog.show({ mode: 'deploy' })"
        >
          Deploy
        </button>
      </template>
    </PageHeader>

    <HelpPanel id="deployments" title="How to stop and restart an application">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          <strong>Stop</strong> takes the application out of service on every one of its targets. Clients get a 404
          from that point on, and any session state in it is gone.
        </li>
        <li><strong>Start</strong> puts it back into service on the same targets. Together they are a restart.</li>
        <li>
          The <strong>State</strong> column shows the state WebLogic reports for the deployment, plus the health of
          its loaded instances when that is not OK. It can take a few seconds to catch up after either action.
        </li>
      </ol>
      <p>
        An application that shows <em>Not active</em> is deployed but running nowhere — check that its target servers
        are up on the Servers page before assuming the deployment is broken. <em>Retired</em> is different: a newer
        version of the same application took over, and this one is only finishing the sessions it already had. It
        still shows the servers it is loaded on, but it serves no new requests.
      </p>
      <p>
        <strong>Deploy</strong> uploads a new archive and installs it. <strong>Redeploy</strong> replaces the archive
        of one already there, keeping its name and targets — that is how a new build goes out.
        <strong>Undeploy</strong> removes it from the domain altogether. All three are staged as configuration
        changes and activated, so a failed upload leaves the domain exactly as it was.
      </p>
    </HelpPanel>

    <DataTable
      v-model:selected="selected"
      :columns="COLUMNS"
      :rows="rows"
      :loading="loading"
      :error="error && !data ? error : null"
      state-key="main"
      export-name="deployments"
      selectable
      empty-text="Nothing is deployed to this domain."
      search-placeholder="Filter applications…"
      search-hint="Matches the application name, type, targets and staging mode of the rows already loaded."
      @retry="reload"
    >
      <template #toolbar>
        <div v-if="selected.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">{{ selected.length }} selected</span>
          <button class="btn btn-ghost px-2 py-1 text-xs" @click="runBulk('start')">Start</button>
          <button class="btn btn-danger px-2 py-1 text-xs" @click="runBulk('stop')">Stop</button>
          <button class="btn btn-ghost px-2 py-1 text-xs" @click="selected = []">Clear</button>
        </div>
      </template>
      <template #cell:name="{ row }">
        <RouterLink
          :to="{ name: 'deployment-detail', params: { name: row.name } }"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          title="Open this application: deployment state and its settings"
        >
          {{ row.name }}
        </RouterLink>
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
            :title="`Loaded on ${row.activeOn.join(', ')}`"
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
          <button
            class="btn btn-ghost px-2 py-1 text-xs"
            title="Upload a new archive over this deployment, keeping its name and targets"
            :disabled="busyApp === row.name"
            @click="redeploy(row)"
          >
            Redeploy
          </button>
          <button
            class="btn btn-danger px-2 py-1 text-xs"
            title="Remove this application from the domain configuration entirely"
            :disabled="busyApp === row.name"
            @click="undeploy(row)"
          >
            Undeploy
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
      <DataTable :columns="LIB_COLUMNS" :rows="libraries" :searchable="false" export-name="libraries" dense>
        <template #cell:sourcePath="{ row }">
          <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ row.sourcePath }}</span>
        </template>
      </DataTable>
    </template>

    <ConfirmDialog ref="confirm" />
    <DeployDialog ref="deployDialog" @deployed="reload" />
  </div>
</template>
