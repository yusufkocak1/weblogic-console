<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { useResource } from '@/composables/useResource'
import { useActivityStore } from '@/stores/activity'
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
import { t } from '@/i18n'

const ui = useUiStore()
const changes = useChangesStore()
const activity = useActivityStore()
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
  // The state column has to agree with the classic console, and that answer
  // only exists behind per-application state actions — asked a few at a time,
  // with each deployment's own targets for the probes that need one.
  const states = await wls.deploymentStates(
    items(configs)
      .filter((config) => config.name)
      .map((config) => ({ name: config.name, targets: targetNames(config.targets) })),
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

/** The dropdown value standing in for "WebLogic reports no state at all". */
const NOT_ACTIVE = '~none'

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
      // WebLogic's own answer when any state probe gave one. Only when none
      // did is a deployment with loaded runtimes shown as ACTIVE — safe now
      // that the version-aware matching above cannot count another version's
      // instances as this one's.
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

const COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Application'),
    hint: t('The deployment name, with the archive or directory it was deployed from underneath.'),
  },
  {
    key: 'state',
    label: t('State'),
    hint: t('The state WebLogic reports for the deployment — Active means it is serving requests, Retired means a newer version took over and this one is only draining its last sessions. Next to it: the health of the loaded instances when it is not OK, and how many servers the application is loaded on. "Not active" means WebLogic reports no state and no instance at all — usually because its target servers are down.'),
  },
  {
    key: 'moduleType',
    label: t('Type'),
    hint: t('What kind of module this is: war for a web application, ear for an enterprise application, jar for an EJB module, and so on.'),
  },
  {
    key: 'targets',
    label: t('Targets'),
    hint: t('The servers and clusters the application is deployed to. Start and Stop act on all of them at once.'),
  },
  {
    key: 'staging',
    label: t('Staging'),
    hint: t('How the archive reaches each server: stage copies it to the server, nostage leaves it on a shared path that every server must be able to read, external_stage means you copy it yourself.'),
  },
  { key: 'actions', label: '', sortable: false, align: 'right' },
])

/**
 * What an operator narrows a long deployment list by: what state it is in, what
 * kind of module it is, and which target it is on. The target filter reads the
 * row's own target list rather than the joined text, so picking a cluster keeps
 * every application on it and nothing that merely mentions it.
 */
const FILTERS = computed(() => [
  {
    key: 'state',
    label: t('State'),
    hint: t('Keeps only the applications in one state. "Not active" is the state WebLogic reports nothing for — usually because the target servers are down.'),
    value: (row) => row.state || NOT_ACTIVE,
    format: (value) => (value === NOT_ACTIVE ? t('Not active') : value),
  },
  {
    key: 'type',
    label: t('Type'),
    hint: t('Keeps only one kind of module: war, ear, jar and so on.'),
    value: (row) => row.moduleType,
  },
  {
    key: 'target',
    label: t('Target'),
    hint: t('Keeps only the applications deployed to one server or cluster.'),
    value: (row) => row.targetList,
  },
])

const LIB_COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Library'),
    hint: t('Shared libraries are referenced by applications rather than served themselves. An application that references a missing library will not start.'),
  },
  {
    key: 'version',
    label: t('Version'),
    hint: t('Specification / implementation version. Applications can pin a specific version, so several versions of one library may be deployed side by side.'),
  },
  { key: 'targets', label: t('Targets'), hint: t('The servers and clusters this library is deployed to.') },
  { key: 'sourcePath', label: t('Source'), hint: t('Where the library archive was deployed from.') },
])

/** Start and stop are each other's inverse, which is what makes them undoable. */
const OPPOSITE = { start: 'stop', stop: 'start' }

/**
 * One deployment lifecycle operation as the activity log holds it: which
 * application, on which targets, and the request that puts it back.
 */
function logDeployment(name, action, targets, error) {
  const label = action === 'start' ? t('Start') : t('Stop')
  const opposite = OPPOSITE[action]
  const changes = [
    {
      label: name,
      attr: 'state',
      from: action === 'start' ? 'STOPPED' : 'ACTIVE',
      to: action === 'start' ? 'ACTIVE' : 'STOPPED',
      note: targets?.length ? t('on {targets}', { targets: targets.join(', ') }) : '',
    },
  ]

  if (error) {
    activity.record({
      kind: 'deployment',
      title: t('Failed — {action} {app}', { action: label, app: name }),
      summary: error,
      changes,
      status: 'failed',
      undoNote: t('Nothing to roll back: the request did not go through.'),
    })
    return
  }

  activity.record({
    kind: 'deployment',
    title: t('{action} {app}', { action: label, app: name }),
    summary:
      action === 'start'
        ? t('Put back into service on {targets}.', { targets: targets?.join(', ') || t('its targets') })
        : t('No longer served on {targets}.', { targets: targets?.join(', ') || t('its targets') }),
    changes,
    undo: {
      type: 'deployment',
      app: name,
      action: opposite,
      targets: [...(targets || [])],
      summary: opposite === 'start' ? t('Started again.') : t('Stopped again.'),
      body:
        opposite === 'start'
          ? t('The application is started again on the same targets.')
          : t('The application is stopped again on the same targets.'),
      hint: t('{action} {app}', { action: opposite === 'start' ? t('Start') : t('Stop'), app: name }),
    },
  })
}

async function runAction(row, action) {
  const label = action === 'start' ? t('Start') : t('Stop')
  const ok = await confirm.value.ask({
    title: t('{action} {app}?', { action: label, app: row.name }),
    body:
      action === 'start'
        ? t('The application will be served on: {targets}.', { targets: row.targets })
        : t('Clients will stop being served by this application on all its targets.'),
    confirmLabel: label,
    danger: action === 'stop',
    script: {
      subtitle: t('{action} {app}', { action: label, app: row.name }),
      wlst: wlstForDeploymentAction(row.name, action, row.targetList, scriptContext()),
      curl: curlForDeploymentAction(row.name, action, scriptContext()),
    },
  })
  if (!ok) return

  busyApp.value = row.name
  try {
    await wls.deploymentAction(row.name, action)
    logDeployment(row.name, action, row.targetList)
    ui.success(t('{action} requested', { action: label }), t('{app} — state refreshes shortly.', { app: row.name }))
    setTimeout(reload, 1500)
  } catch (err) {
    logDeployment(row.name, action, row.targetList, err.fullText || err.message)
    ui.error(t('{action} failed for {app}', { action: label, app: row.name }), err.fullText || err.message)
  } finally {
    busyApp.value = null
  }
}

/** Start or stop every ticked application, one after another. */
async function runBulk(action) {
  const chosen = rows.value.filter((row) => selected.value.includes(row.name))
  if (!chosen.length) return
  const label = action === 'start' ? t('Start') : t('Stop')
  const ok = await confirm.value.ask({
    title:
      chosen.length === 1
        ? t('{action} 1 application?', { action: label })
        : t('{action} {count} applications?', { action: label, count: chosen.length }),
    body: `${chosen.map((row) => row.name).join(', ')}. ${
      action === 'stop'
        ? t('Clients stop being served by each of them on all of their targets.')
        : t('Each is put back into service on its own targets.')
    }`,
    confirmLabel: `${label} ${chosen.length}`,
    danger: action === 'stop',
  })
  if (!ok) return

  const failures = []
  for (const row of chosen) {
    busyApp.value = row.name
    try {
      await wls.deploymentAction(row.name, action)
      // Logged per application rather than as one bulk entry, so each keeps
      // its own targets and its own rollback.
      logDeployment(row.name, action, row.targetList)
    } catch (err) {
      failures.push(`${row.name}: ${err.fullText || err.message}`)
      logDeployment(row.name, action, row.targetList, err.fullText || err.message)
    }
  }
  busyApp.value = null
  selected.value = []

  const done = chosen.length - failures.length
  if (done) {
    ui.success(t('{action} requested for {count}', { action: label, count: done }), t('States refresh shortly.'))
  }
  if (failures.length) {
    ui.error(t('{action} failed for {count}', { action: label, count: failures.length }), failures.join(' · '))
  }
  setTimeout(reload, 1500)
}

/**
 * Removing an application from the domain altogether. This is a configuration
 * change, not a lifecycle one, so it takes the lock, deletes the deployment and
 * activates — and it is not undoable from here, which the dialog says.
 */
async function undeploy(row) {
  const ok = await confirm.value.ask({
    title: t('Undeploy {app}?', { app: row.name }),
    body: t(
      'The application is removed from the domain configuration and stops being served on {targets}. Putting it back means deploying the archive again.',
      { targets: row.targets },
    ),
    confirmLabel: t('Undeploy'),
    danger: true,
    script: {
      subtitle: t('Undeploy {app}', { app: row.name }),
      wlst: wlstForUndeploy(row.name, row.targetList, scriptContext()),
      curl: curlFor('DELETE', `/edit/appDeployments/${encodeURIComponent(row.name)}`, undefined, scriptContext()),
    },
  })
  if (!ok) return

  busyApp.value = row.name
  try {
    await changes.refresh()
    if (changes.locked && changes.lockOwner && changes.lockOwner !== connection.username) {
      throw new Error(t('{owner} holds the configuration lock.', { owner: changes.lockOwner }))
    }
    if (!changes.locked) await config.startEdit()
    await wls.undeployApplication(row.name)
    await changes.activate()
    activity.record({
      kind: 'deployment',
      title: t('Undeployed {app}', { app: row.name }),
      summary: t('Removed from the domain configuration and from {targets}.', { targets: row.targets }),
      changes: [
        { label: row.name, attr: 'appDeployments', from: row.sourcePath || t('deployed'), to: t('(removed)') },
      ],
      undoNote: t(
        'An undeploy cannot be rolled back from here: the domain no longer holds the archive, so putting the application back means deploying the file again.',
      ),
    })
    ui.success(t('Undeployed'), t('{app} has been removed from the domain.', { app: row.name }))
    reload()
  } catch (err) {
    activity.record({
      kind: 'deployment',
      title: t('Failed — undeploy {app}', { app: row.name }),
      summary: err.fullText || err.message,
      status: 'failed',
      undoNote: t('The edit was discarded, so the application should still be deployed.'),
    })
    ui.error(t('Could not undeploy {app}', { app: row.name }), err.fullText || err.message)
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
      :title="$t('Deployments')"
      :subtitle="$t('Applications and shared libraries in this domain')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'Every application deployed to this domain and the shared libraries they reference. Install a new archive, replace one that is already there, start and stop them, or remove them entirely.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <button
          class="btn btn-primary"
          :disabled="!connection.canConfigure"
          :title="
            connection.canConfigure
              ? $t('Upload a WAR, EAR or JAR and install it in this domain')
              : $t('Your WebLogic user is not allowed to change this domain’s configuration.')
          "
          @click="deployDialog.show({ mode: 'deploy' })"
        >
          {{ $t('Deploy') }}
        </button>
      </template>
    </PageHeader>

    <HelpPanel id="deployments" :title="$t('How to stop and restart an application')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          {{
            $t(
              'Stop takes the application out of service on every one of its targets. Clients get a 404 from that point on, and any session state in it is gone.',
            )
          }}
        </li>
        <li>{{ $t('Start puts it back into service on the same targets. Together they are a restart.') }}</li>
        <li>
          {{
            $t(
              'The State column shows the state WebLogic reports for the deployment, plus the health of its loaded instances when that is not OK. It can take a few seconds to catch up after either action.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'An application that shows Not active is deployed but running nowhere — check that its target servers are up on the Servers page before assuming the deployment is broken. Retired is different: a newer version of the same application took over, and this one is only finishing the sessions it already had. It still shows the servers it is loaded on, but it serves no new requests.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'Deploy uploads a new archive and installs it. Redeploy replaces the archive of one already there, keeping its name and targets — that is how a new build goes out. Undeploy removes it from the domain altogether. All three are staged as configuration changes and activated, so a failed upload leaves the domain exactly as it was.',
          )
        }}
      </p>
    </HelpPanel>

    <DataTable
      v-model:selected="selected"
      :columns="COLUMNS"
      :rows="rows"
      :filters="FILTERS"
      :loading="loading"
      :error="error && !data ? error : null"
      state-key="main"
      export-name="deployments"
      selectable
      :empty-text="$t('Nothing is deployed to this domain.')"
      :search-placeholder="$t('Filter applications…')"
      :search-hint="$t('Matches the application name, type, targets and staging mode of the rows already loaded.')"
      @retry="reload"
    >
      <template #toolbar>
        <div v-if="selected.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {{ $t('{count} selected', { count: selected.length }) }}
          </span>
          <button class="btn btn-ghost px-2 py-1 text-xs" @click="runBulk('start')">{{ $t('Start') }}</button>
          <button class="btn btn-danger px-2 py-1 text-xs" @click="runBulk('stop')">{{ $t('Stop') }}</button>
          <button class="btn btn-ghost px-2 py-1 text-xs" @click="selected = []">{{ $t('Clear') }}</button>
        </div>
      </template>
      <template #cell:name="{ row }">
        <RouterLink
          :to="{ name: 'deployment-detail', params: { name: row.name } }"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          :title="$t('Open this application: deployment state and its settings')"
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
          <span v-else class="text-xs text-zinc-400">{{ $t('Not active') }}</span>
          <StateBadge v-if="row.health && row.health !== 'OK'" kind="health" :health="row.health" />
          <span
            v-if="row.activeOn.length"
            class="text-xs text-zinc-400 dark:text-zinc-500"
            :title="$t('Loaded on {servers}', { servers: row.activeOn.join(', ') })"
          >
            {{ $t('on {count}', { count: row.activeOn.length }) }}
          </span>
        </div>
      </template>

      <template #cell:actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <button
            class="btn btn-ghost px-2 py-1 text-xs"
            :title="$t('Put this application back into service on all of its targets')"
            :disabled="busyApp === row.name"
            @click="runAction(row, 'start')"
          >
            {{ $t('Start') }}
          </button>
          <button
            class="btn btn-danger px-2 py-1 text-xs"
            :title="
              $t('Take this application out of service on all of its targets — clients stop being served immediately')
            "
            :disabled="busyApp === row.name"
            @click="runAction(row, 'stop')"
          >
            {{ $t('Stop') }}
          </button>
          <button
            class="btn btn-ghost px-2 py-1 text-xs"
            :title="
              connection.canConfigure
                ? $t('Upload a new archive over this deployment, keeping its name and targets')
                : $t('Your WebLogic user is not allowed to change this domain’s configuration.')
            "
            :disabled="busyApp === row.name || !connection.canConfigure"
            @click="redeploy(row)"
          >
            {{ $t('Redeploy') }}
          </button>
          <button
            class="btn btn-danger px-2 py-1 text-xs"
            :title="
              connection.canConfigure
                ? $t('Remove this application from the domain configuration entirely')
                : $t('Your WebLogic user is not allowed to change this domain’s configuration.')
            "
            :disabled="busyApp === row.name || !connection.canConfigure"
            @click="undeploy(row)"
          >
            {{ $t('Undeploy') }}
          </button>
        </div>
      </template>
    </DataTable>

    <template v-if="libraries.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {{ $t('Shared libraries') }}
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          {{ $t('— code that applications reference instead of bundling; they have no lifecycle buttons of their own') }}
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
