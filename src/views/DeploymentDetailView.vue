<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { useResource } from '@/composables/useResource'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { baseAppName, healthOf, items, targetNames } from '@/utils/format'
import { curlFor, curlForDeploymentAction, wlstForDeploymentAction, wlstForUndeploy } from '@/utils/wlst'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import TargetPicker from '@/components/TargetPicker.vue'
import DeployDialog from '@/components/DeployDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

/**
 * One application: whether it is serving, where it is serving from, and the
 * deployment settings that decide how it gets there.
 */
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const changes = useChangesStore()
const connection = useConnectionStore()
const confirm = ref(null)
const deployDialog = ref(null)
const busy = ref(false)
const name = computed(() => String(route.params.name || ''))

const scriptContext = () => ({ username: connection.username, baseUrl: connection.baseUrl })

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes] = await Promise.all([wls.appDeployments({ signal }), wls.applicationRuntimes({ signal })])
  // The state the classic console shows only exists as an action on the
  // deployment runtime, so it is asked for separately.
  const states = await wls.deploymentStates([name.value], { signal })
  return { configs, runtimes, states }
})

const configured = computed(() => items(data.value?.configs).find((config) => config.name === name.value))
const missing = computed(() => Boolean(data.value) && !configured.value)

/** Every server this application is actually running on, with its health. */
const instances = computed(() => {
  const wanted = new Set([name.value, baseAppName(name.value)])
  const found = []
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    for (const app of items(server.applicationRuntimes)) {
      const names = [app.name, app.applicationName, baseAppName(app.name)].filter(Boolean)
      if (names.some((candidate) => wanted.has(candidate)) && !found.some((f) => f.server === server.name)) {
        found.push({ server: server.name, health: healthOf(app.healthState) })
      }
    }
  }
  return found
})

const targets = computed(() => targetNames(configured.value?.targets))
const state = computed(() => data.value?.states?.get(name.value) || (instances.value.length ? 'ACTIVE' : null))
const health = computed(() =>
  instances.value.length ? (instances.value.find((i) => i.health !== 'OK')?.health ?? 'OK') : null,
)

const facts = computed(() => [
  { label: 'Type', value: configured.value?.moduleType || '—', hint: 'war for a web application, ear for an enterprise application, jar for an EJB module.' },
  { label: 'Targets', value: targets.value.join(', ') || '—', hint: 'The servers and clusters this application is deployed to. Start and Stop act on all of them.' },
  { label: 'Running on', value: instances.value.map((i) => i.server).join(', ') || 'nowhere' },
  { label: 'Deployment order', value: configured.value?.deploymentOrder ?? '—', hint: 'Lower numbers deploy first. The setting below changes it.' },
  { label: 'Archive', value: configured.value?.absoluteSourcePath || configured.value?.sourcePath || '—', mono: true },
])

async function runAction(action) {
  const label = action === 'start' ? 'Start' : 'Stop'
  const ok = await confirm.value.ask({
    title: `${label} ${name.value}?`,
    body:
      action === 'start'
        ? `The application will be served on: ${targets.value.join(', ') || 'its targets'}.`
        : 'Clients will stop being served by this application on all its targets.',
    confirmLabel: label,
    danger: action === 'stop',
    script: {
      subtitle: `${label} ${name.value}`,
      wlst: wlstForDeploymentAction(name.value, action, targets.value, scriptContext()),
      curl: curlForDeploymentAction(name.value, action, targets.value, scriptContext()),
    },
  })
  if (!ok) return

  busy.value = true
  try {
    await wls.deploymentAction(name.value, action, targets.value)
    ui.success(`${label} requested`, `${name.value} — state refreshes shortly.`)
    setTimeout(reload, 1500)
  } catch (err) {
    ui.error(`${label} failed for ${name.value}`, err.fullText || err.message)
  } finally {
    busy.value = false
  }
}

/** Removing the application from the domain, not just from service. */
async function undeploy() {
  const ok = await confirm.value.ask({
    title: `Undeploy ${name.value}?`,
    body: `The application is removed from the domain configuration and stops being served on ${
      targets.value.join(', ') || 'its targets'
    }. Putting it back means deploying the archive again.`,
    confirmLabel: 'Undeploy',
    danger: true,
    script: {
      subtitle: `Undeploy ${name.value}`,
      wlst: wlstForUndeploy(name.value, targets.value, scriptContext()),
      curl: curlFor('DELETE', `/edit/appDeployments/${encodeURIComponent(name.value)}`, undefined, scriptContext()),
    },
  })
  if (!ok) return

  busy.value = true
  try {
    await changes.refresh()
    if (changes.locked && changes.lockOwner && changes.lockOwner !== connection.username) {
      throw new Error(`${changes.lockOwner} holds the configuration lock.`)
    }
    if (!changes.locked) await config.startEdit()
    await wls.undeployApplication(name.value)
    await changes.activate()
    ui.success('Undeployed', `${name.value} has been removed from the domain.`)
    router.push({ name: 'deployments' })
  } catch (err) {
    ui.error(`Could not undeploy ${name.value}`, err.fullText || err.message)
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
      subtitle="Deployment state and settings"
      :back="{ name: 'deployments' }"
      back-label="Deployments"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="One application: whether it is serving and where, the settings that decide how it is deployed, and the buttons to put a new build out or remove it from the domain."
      @refresh="reload"
    >
      <template #actions>
        <div class="flex gap-1.5">
          <button
            class="btn btn-ghost"
            title="Put this application back into service on all of its targets"
            :disabled="busy"
            @click="runAction('start')"
          >
            Start
          </button>
          <button
            class="btn btn-danger"
            title="Take this application out of service on all of its targets — clients stop being served immediately"
            :disabled="busy"
            @click="runAction('stop')"
          >
            Stop
          </button>
          <button
            class="btn btn-ghost"
            title="Upload a new archive over this deployment, keeping its name and targets — this is how a new build goes out"
            :disabled="busy"
            @click="deployDialog.show({ mode: 'redeploy', name, stagingMode: configured?.stagingMode, targets })"
          >
            Redeploy
          </button>
          <button
            class="btn btn-danger"
            title="Remove this application from the domain configuration entirely"
            :disabled="busy"
            @click="undeploy"
          >
            Undeploy
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      This domain has nothing deployed under the name <span class="font-mono">{{ name }}</span
      >. Go back to
      <RouterLink :to="{ name: 'deployments' }" class="text-indigo-600 dark:text-indigo-400">Deployments</RouterLink>
      for the current list.
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <StateBadge v-if="state" :state="state" />
          <span v-else class="text-xs text-zinc-400 dark:text-zinc-500">
            Not active anywhere — check that its target servers are running.
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
        description="Where this application runs. Targeting a cluster deploys it to every member, including members added later; removing a target stops it being served there as soon as the change is activated."
        @changed="reload"
      />

      <SettingsPanel
        :sections="['deployments']"
        :name="name"
        intro="These settings describe how the application is deployed. Most of them are read when it is next deployed, so activate the change and then stop and start the application to apply it."
      />
    </template>

    <ConfirmDialog ref="confirm" />
    <DeployDialog ref="deployDialog" @deployed="reload" />
  </div>
</template>
