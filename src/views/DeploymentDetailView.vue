<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import TargetPicker from '@/components/TargetPicker.vue'
import DeployDialog from '@/components/DeployDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { t } from '@/i18n'

/**
 * One application: whether it is serving, where it is serving from, and the
 * deployment settings that decide how it gets there.
 */
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const changes = useChangesStore()
const activity = useActivityStore()
const connection = useConnectionStore()
const confirm = ref(null)
const deployDialog = ref(null)
const busy = ref(false)
const name = computed(() => String(route.params.name || ''))

const scriptContext = () => ({ username: connection.username, baseUrl: connection.baseUrl })

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes] = await Promise.all([wls.appDeployments({ signal }), wls.applicationRuntimes({ signal })])
  // The state the classic console shows only exists behind state actions, so
  // it is asked for separately — with this deployment's targets in hand for
  // the probe that cannot answer without one.
  const targets = targetNames(items(configs).find((config) => config.name === name.value)?.targets)
  const states = await wls.deploymentStates([{ name: name.value, targets }], { signal })
  return { configs, runtimes, states }
})

const configured = computed(() => items(data.value?.configs).find((config) => config.name === name.value))
const missing = computed(() => Boolean(data.value) && !configured.value)

/** Every server this application is actually loaded on, with its health. */
const instances = computed(() => {
  const found = []
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) {
      if (!isDeploymentRuntime(name.value, app)) continue
      if (found.some((f) => f.server === server.name)) continue
      found.push({ server: server.name, health: healthOf(app.healthState) })
    }
  }
  return found
})

const targets = computed(() => targetNames(configured.value?.targets))
// WebLogic's own answer when any state probe gave one; only when none did is
// a deployment with loaded runtimes shown as ACTIVE — safe now that the
// version-aware matching above cannot count another version's instances.
const state = computed(() => data.value?.states?.get(name.value) || (instances.value.length ? 'ACTIVE' : null))
const health = computed(() =>
  instances.value.length ? (instances.value.find((i) => i.health !== 'OK')?.health ?? 'OK') : null,
)

const facts = computed(() => [
  {
    label: t('Type'),
    value: configured.value?.moduleType || '—',
    hint: t('war for a web application, ear for an enterprise application, jar for an EJB module.'),
  },
  {
    label: t('Targets'),
    value: targets.value.join(', ') || '—',
    hint: t('The servers and clusters this application is deployed to. Start and Stop act on all of them.'),
  },
  { label: t('Running on'), value: instances.value.map((i) => i.server).join(', ') || t('nowhere') },
  {
    label: t('Deployment order'),
    value: configured.value?.deploymentOrder ?? '—',
    hint: t('Lower numbers deploy first. The setting below changes it.'),
  },
  {
    label: t('Archive'),
    value: configured.value?.absoluteSourcePath || configured.value?.sourcePath || '—',
    mono: true,
  },
])

/**
 * One start or stop of this application, written into the activity log with
 * the opposite request attached: start and stop undo each other exactly.
 */
function logDeployment(action, error) {
  const app = name.value
  const on = [...targets.value]
  const label = action === 'start' ? t('Start') : t('Stop')
  const opposite = action === 'start' ? 'stop' : 'start'
  const changes = [
    {
      label: app,
      attr: 'state',
      from: action === 'start' ? 'STOPPED' : 'ACTIVE',
      to: action === 'start' ? 'ACTIVE' : 'STOPPED',
      note: on.length ? t('on {targets}', { targets: on.join(', ') }) : '',
    },
  ]

  if (error) {
    activity.record({
      kind: 'deployment',
      title: t('Failed — {action} {app}', { action: label, app }),
      summary: error,
      changes,
      status: 'failed',
      undoNote: t('Nothing to roll back: the request did not go through.'),
    })
    return
  }

  activity.record({
    kind: 'deployment',
    title: t('{action} {app}', { action: label, app }),
    summary:
      action === 'start'
        ? t('Put back into service on {targets}.', { targets: on.join(', ') || t('its targets') })
        : t('No longer served on {targets}.', { targets: on.join(', ') || t('its targets') }),
    changes,
    undo: {
      type: 'deployment',
      app,
      action: opposite,
      targets: on,
      summary: opposite === 'start' ? t('Started again.') : t('Stopped again.'),
      body:
        opposite === 'start'
          ? t('The application is started again where it was.')
          : t('The application is stopped again where it was.'),
      hint: t('{action} {app}', { action: opposite === 'start' ? t('Start') : t('Stop'), app }),
    },
  })
}

async function runAction(action) {
  const label = action === 'start' ? t('Start') : t('Stop')
  const ok = await confirm.value.ask({
    title: t('{action} {app}?', { action: label, app: name.value }),
    body:
      action === 'start'
        ? t('The application will be served on: {targets}.', {
            targets: targets.value.join(', ') || t('its targets'),
          })
        : t('Clients will stop being served by this application on all its targets.'),
    confirmLabel: label,
    danger: action === 'stop',
    script: {
      subtitle: t('{action} {app}', { action: label, app: name.value }),
      wlst: wlstForDeploymentAction(name.value, action, targets.value, scriptContext()),
      curl: curlForDeploymentAction(name.value, action, targets.value, scriptContext()),
    },
  })
  if (!ok) return

  busy.value = true
  try {
    await wls.deploymentAction(name.value, action, targets.value)
    logDeployment(action)
    ui.success(
      t('{action} requested', { action: label }),
      t('{app} — state refreshes shortly.', { app: name.value }),
    )
    setTimeout(reload, 1500)
  } catch (err) {
    logDeployment(action, err.fullText || err.message)
    ui.error(t('{action} failed for {app}', { action: label, app: name.value }), err.fullText || err.message)
  } finally {
    busy.value = false
  }
}

/** Removing the application from the domain, not just from service. */
async function undeploy() {
  const ok = await confirm.value.ask({
    title: t('Undeploy {app}?', { app: name.value }),
    body: t(
      'The application is removed from the domain configuration and stops being served on {targets}. Putting it back means deploying the archive again.',
      { targets: targets.value.join(', ') || t('its targets') },
    ),
    confirmLabel: t('Undeploy'),
    danger: true,
    script: {
      subtitle: t('Undeploy {app}', { app: name.value }),
      wlst: wlstForUndeploy(name.value, targets.value, scriptContext()),
      curl: curlFor('DELETE', `/edit/appDeployments/${encodeURIComponent(name.value)}`, undefined, scriptContext()),
    },
  })
  if (!ok) return

  busy.value = true
  try {
    await changes.refresh()
    if (changes.locked && changes.lockOwner && changes.lockOwner !== connection.username) {
      throw new Error(t('{owner} holds the configuration lock.', { owner: changes.lockOwner }))
    }
    if (!changes.locked) await config.startEdit()
    await wls.undeployApplication(name.value)
    await changes.activate()
    activity.record({
      kind: 'deployment',
      title: t('Undeployed {app}', { app: name.value }),
      summary: t('Removed from the domain configuration and from {targets}.', {
        targets: targets.value.join(', ') || t('its targets'),
      }),
      changes: [
        {
          label: name.value,
          attr: 'appDeployments',
          from: configured.value?.sourcePath || t('deployed'),
          to: t('(removed)'),
        },
      ],
      undoNote: t(
        'An undeploy cannot be rolled back from here: the domain no longer holds the archive, so putting the application back means deploying the file again.',
      ),
    })
    ui.success(t('Undeployed'), t('{app} has been removed from the domain.', { app: name.value }))
    router.push({ name: 'deployments' })
  } catch (err) {
    activity.record({
      kind: 'deployment',
      title: t('Failed — undeploy {app}', { app: name.value }),
      summary: err.fullText || err.message,
      status: 'failed',
      undoNote: t('The edit was discarded, so the application should still be deployed.'),
    })
    ui.error(t('Could not undeploy {app}', { app: name.value }), err.fullText || err.message)
    await changes.discard().catch(() => {})
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      :subtitle="$t('Deployment state and settings')"
      :back="{ name: 'deployments' }"
      :back-label="$t('Deployments')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'One application: whether it is serving and where, the settings that decide how it is deployed, and the buttons to put a new build out or remove it from the domain.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <div class="flex gap-1.5">
          <button
            class="btn btn-ghost"
            :title="$t('Put this application back into service on all of its targets')"
            :disabled="busy"
            @click="runAction('start')"
          >
            {{ $t('Start') }}
          </button>
          <button
            class="btn btn-danger"
            :title="
              $t('Take this application out of service on all of its targets — clients stop being served immediately')
            "
            :disabled="busy"
            @click="runAction('stop')"
          >
            {{ $t('Stop') }}
          </button>
          <button
            class="btn btn-ghost"
            :title="
              $t(
                'Upload a new archive over this deployment, keeping its name and targets — this is how a new build goes out',
              )
            "
            :disabled="busy"
            @click="deployDialog.show({ mode: 'redeploy', name, stagingMode: configured?.stagingMode, targets })"
          >
            {{ $t('Redeploy') }}
          </button>
          <button
            class="btn btn-danger"
            :title="$t('Remove this application from the domain configuration entirely')"
            :disabled="busy"
            @click="undeploy"
          >
            {{ $t('Undeploy') }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('This domain has nothing deployed under the name {name}.', { name }) }}
      {{ $t('Go back to') }}
      <RouterLink :to="{ name: 'deployments' }" class="text-indigo-600 dark:text-indigo-400">
        {{ $t('Deployments') }}
      </RouterLink>
      {{ $t('for the current list.') }}
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge v-if="state" :state="state" />
          <span v-else class="text-xs text-zinc-400 dark:text-zinc-500">
            {{ $t('Not active anywhere — check that its target servers are running.') }}
          </span>
          <StateBadge v-if="health && health !== 'OK'" kind="health" :health="health" />
        </div>
        <FactList :facts="facts" />
      </div>

      <TargetPicker
        class="mb-4"
        :path="config.deploymentPath(name)"
        :name="name"
        :current="targets"
        wlst-type="AppDeployment"
        :description="
          $t(
            'Where this application runs. Targeting a cluster deploys it to every member, including members added later; removing a target stops it being served there as soon as the change is activated.',
          )
        "
        @changed="reload"
      />

      <SettingsPanel
        :sections="['deployments']"
        :name="name"
        :intro="
          $t(
            'These settings describe how the application is deployed, not what is inside it: anything from the archive\'s own descriptors — context roots, session timeouts, EJB pool sizes — is overridden with a deployment plan, which is set below. Most of these are read when the application is next deployed, so activate the change and then redeploy it, or stop and start it, to apply it.',
          )
        "
      />
    </template>

    <ConfirmDialog ref="confirm" />
    <DeployDialog ref="deployDialog" @deployed="reload" />
  </div>
</template>
