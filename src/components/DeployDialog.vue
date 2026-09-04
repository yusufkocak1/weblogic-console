<script setup>
import { computed, ref } from 'vue'
import * as wls from '@/api/weblogic'
import * as config from '@/api/config'
import { bytes, items, targetNames } from '@/utils/format'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { curlForDeploy, wlstForDeploy } from '@/utils/wlst'
import SnippetDialog from '@/components/SnippetDialog.vue'
import InfoTip from '@/components/InfoTip.vue'

/**
 * Installing an application, and replacing the archive of one already there.
 *
 * The archive is uploaded to the local console process and forwarded to the
 * AdminServer as multipart form data — the same call the classic console makes.
 * It lands in the pending configuration like any other change, and is activated
 * at the end, so a failed upload leaves the domain as it was.
 */
const emit = defineEmits(['deployed'])

const changes = useChangesStore()
const connection = useConnectionStore()
const ui = useUiStore()

const snippet = ref(null)
const open = ref(false)
const mode = ref('deploy')
const busy = ref(false)
const step = ref('')

const form = ref({ name: '', stagingMode: '', file: null, plan: null })
const selected = ref(new Set())
const choices = ref({ servers: [], clusters: [] })

const STAGING = [
  { value: '', label: 'Domain default' },
  { value: 'stage', label: 'stage — copy the archive to each server' },
  { value: 'nostage', label: 'nostage — every server reads the same path' },
  { value: 'external_stage', label: 'external_stage — you copy it yourself' },
]

const title = computed(() => (mode.value === 'redeploy' ? `Redeploy ${form.value.name}` : 'Deploy an application'))

const entries = computed(() => [
  ...items(choices.value.clusters).map((cluster) => ({ kind: 'clusters', name: cluster.name, note: 'Cluster' })),
  ...items(choices.value.servers).map((server) => ({
    kind: 'servers',
    name: server.name,
    note: targetNames(server.cluster)[0] ? `Member of ${targetNames(server.cluster)[0]}` : 'Standalone server',
  })),
])

async function show(options = {}) {
  mode.value = options.mode || 'deploy'
  form.value = { name: options.name || '', stagingMode: options.stagingMode || '', file: null, plan: null }
  selected.value = new Set(options.targets || [])
  step.value = ''
  open.value = true
  try {
    const result = await wls.targetChoices()
    choices.value = result
  } catch (err) {
    ui.error('Could not read the targets available', err.fullText || err.message)
  }
}

function close() {
  if (busy.value) return
  open.value = false
}

function pickFile(event) {
  const file = event.target.files?.[0] || null
  form.value.file = file
  // The deployment name defaults to the archive's, which is what an operator
  // expects and what the classic console does.
  if (file && mode.value === 'deploy' && !form.value.name) {
    form.value.name = file.name.replace(/\.(war|ear|jar|rar|zip)$/i, '')
  }
}

function toggle(entry) {
  const next = new Set(selected.value)
  if (next.has(entry.name)) next.delete(entry.name)
  else next.add(entry.name)
  selected.value = next
}

const chosen = computed(() => entries.value.filter((entry) => selected.value.has(entry.name)))

const canSubmit = computed(
  () => Boolean(form.value.file) && Boolean(form.value.name.trim()) && (mode.value === 'redeploy' || chosen.value.length > 0),
)

function buildModel() {
  const model = { name: form.value.name.trim() }
  if (chosen.value.length) {
    model.targets = chosen.value.map((entry) => ({ identity: [entry.kind, entry.name] }))
  }
  if (form.value.stagingMode) model.stagingMode = form.value.stagingMode
  return model
}

async function submit() {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  try {
    step.value = 'Taking the configuration lock…'
    await changes.refresh()
    if (changes.locked && changes.lockOwner && changes.lockOwner !== connection.username) {
      throw new Error(`${changes.lockOwner} holds the configuration lock. Ask them to activate or release it first.`)
    }
    if (!changes.locked) await config.startEdit()

    step.value = `Uploading ${form.value.file.name} (${bytes(form.value.file.size)})…`
    const body = wls.deploymentForm({ file: form.value.file, plan: form.value.plan, model: buildModel() })
    if (mode.value === 'redeploy') await wls.redeployApplication(form.value.name.trim(), body)
    else await wls.deployApplication(body)

    step.value = 'Activating the change…'
    await changes.activate()

    ui.success(
      mode.value === 'redeploy' ? 'Redeployed' : 'Deployed',
      `${form.value.name} is installed. It can take a moment to reach ACTIVE on every target.`,
    )
    open.value = false
    emit('deployed')
  } catch (err) {
    ui.error(
      mode.value === 'redeploy' ? 'Redeploy failed' : 'Deployment failed',
      `${err.fullText || err.message} — the change was not activated, so the domain is unchanged.`,
    )
    // Leaving a half-finished edit session behind would block everyone else.
    await changes.discard().catch(() => {})
  } finally {
    busy.value = false
    step.value = ''
  }
}

function showScript() {
  const context = { username: connection.username, baseUrl: connection.baseUrl }
  const details = {
    name: form.value.name || '<application>',
    path: form.value.file?.name ? `/path/to/${form.value.file.name}` : '/path/to/archive.war',
    targets: chosen.value.map((entry) => `${entry.kind}/${entry.name}`),
    stagingMode: form.value.stagingMode,
  }
  snippet.value.show({
    title: title.value,
    subtitle: 'Deployment uploads the archive; WLST reads it from a path the AdminServer can see.',
    wlst: wlstForDeploy(
      { ...details, targets: chosen.value.map((entry) => entry.name) },
      context,
    ),
    curl: curlForDeploy(details, context),
  })
}

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 py-10 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="card w-full max-w-2xl p-5" role="dialog" aria-modal="true">
        <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">{{ title }}</h2>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The archive is uploaded through this console to the AdminServer and activated as a configuration change.
          Nothing is written to the domain until the upload has succeeded.
        </p>

        <div class="mt-4 space-y-4">
          <div>
            <label class="label-row" for="deploy-file">
              Archive
              <InfoTip
                heading="Archive"
                text="The WAR, EAR, JAR or RAR to install. It travels from this browser through the local console process to the AdminServer, so it does not need to exist on the AdminServer's own disk."
              />
            </label>
            <input
              id="deploy-file"
              type="file"
              class="input py-1.5"
              accept=".war,.ear,.jar,.rar,.zip"
              :disabled="busy"
              @change="pickFile"
            />
            <p v-if="form.file" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {{ form.file.name }} · {{ bytes(form.file.size) }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label-row" for="deploy-name">
                Deployment name
                <InfoTip
                  heading="Deployment name"
                  text="What the application is called in the domain — the name on the Deployments page, not the file name. Redeploying keeps the existing name."
                />
              </label>
              <input
                id="deploy-name"
                v-model="form.name"
                class="input"
                :disabled="busy || mode === 'redeploy'"
                placeholder="myapp"
              />
            </div>
            <div>
              <label class="label-row" for="deploy-staging">
                Staging
                <InfoTip
                  heading="Staging"
                  text="stage copies the archive to each target server, which is the safe default. nostage leaves it on a path every server must be able to read. external_stage means you place it there yourself."
                />
              </label>
              <select id="deploy-staging" v-model="form.stagingMode" class="input" :disabled="busy">
                <option v-for="option in STAGING" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
          </div>

          <div v-if="mode !== 'redeploy'">
            <p class="label-row">
              Targets
              <InfoTip
                heading="Targets"
                text="Where the application will run. Targeting a cluster deploys it to every member, including members added later."
              />
            </p>
            <div class="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              <label
                v-for="entry in entries"
                :key="`${entry.kind}/${entry.name}`"
                :class="[
                  'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  selected.has(entry.name)
                    ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                    : 'border-zinc-200 dark:border-zinc-800',
                ]"
              >
                <input
                  type="checkbox"
                  class="mt-0.5"
                  :checked="selected.has(entry.name)"
                  :disabled="busy"
                  @change="toggle(entry)"
                />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-zinc-800 dark:text-zinc-100">{{ entry.name }}</span>
                  <span class="block truncate text-xs text-zinc-400 dark:text-zinc-500">{{ entry.note }}</span>
                </span>
              </label>
            </div>
          </div>

          <details class="text-sm">
            <summary class="cursor-pointer text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100">
              Deployment plan (optional)
            </summary>
            <input
              type="file"
              class="input mt-2 py-1.5"
              accept=".xml"
              :disabled="busy"
              @change="form.plan = $event.target.files?.[0] || null"
            />
            <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              A plan.xml overriding descriptor values for this environment. Leave it empty unless you already use one.
            </p>
          </details>
        </div>

        <p v-if="step" class="mt-4 text-sm text-indigo-600 dark:text-indigo-400">{{ step }}</p>

        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <button class="btn btn-ghost mr-auto" :disabled="busy" @click="showScript">Show script</button>
          <button class="btn btn-ghost" :disabled="busy" @click="close">Cancel</button>
          <button class="btn btn-primary" :disabled="!canSubmit || busy" @click="submit">
            {{ busy ? 'Working…' : mode === 'redeploy' ? 'Redeploy' : 'Deploy' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <SnippetDialog ref="snippet" />
</template>
