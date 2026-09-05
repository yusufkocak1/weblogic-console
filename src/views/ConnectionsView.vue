<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { useReconnect } from '@/composables/useReconnect'
import { datetime } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PasswordPrompt from '@/components/PasswordPrompt.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import { t } from '@/i18n'

const connection = useConnectionStore()
const ui = useUiStore()
const router = useRouter()

const prompt = ref(null)
const confirm = ref(null)
const reconnect = useReconnect(prompt)
const renaming = ref(null)
const draftName = ref('')
const busyId = ref(null)

/**
 * One row per saved profile, plus any live connection that was opened without
 * saving — so nothing that is currently open can be invisible here.
 */
const rows = computed(() => {
  const saved = connection.profiles.map((profile) => {
    const live = connection.connectionForProfile(profile.id)
    return {
      key: profile.id,
      profile,
      live,
      name: live?.name || profile.name,
      host: profile.host,
      port: profile.port,
      ssl: profile.ssl,
      username: profile.username,
      lastUsedAt: profile.lastUsedAt,
      active: Boolean(live?.active),
    }
  })
  const unsaved = connection.connections
    .filter((c) => !c.profileId)
    .map((live) => ({
      key: live.id,
      profile: null,
      live,
      name: live.name,
      host: live.host,
      port: live.port,
      ssl: live.ssl,
      username: live.username,
      lastUsedAt: live.connectedAt,
      active: live.active,
    }))
  return [...saved, ...unsaved]
})

async function activate(row) {
  busyId.value = row.key
  try {
    await connection.activate(row.live.id)
    ui.success(t('Switched'), t('Now working on {name}.', { name: row.name }))
  } catch (err) {
    ui.error(t('Could not switch connection'), err.fullText || err.message)
  } finally {
    busyId.value = null
  }
}

async function connect(row) {
  busyId.value = row.key
  try {
    await reconnect(row.profile)
  } finally {
    busyId.value = null
  }
}

async function close(row) {
  const ok = await confirm.value.ask({
    title: t('Close {name}?', { name: row.name }),
    body: t('The connection is dropped and its password is forgotten. The saved profile stays.'),
    confirmLabel: t('Close connection'),
    danger: true,
  })
  if (!ok) return
  const wasLast = connection.connections.length === 1
  try {
    await connection.close(row.live.id)
    if (wasLast) router.push({ name: 'login' })
  } catch (err) {
    ui.error(t('Could not close connection'), err.fullText || err.message)
  }
}

function startRename(row) {
  renaming.value = row.key
  draftName.value = row.name
}

async function commitRename(row) {
  const name = draftName.value.trim()
  renaming.value = null
  if (!name || name === row.name || !row.profile) return
  try {
    await connection.renameProfile(row.profile.id, name)
  } catch (err) {
    ui.error(t('Could not rename'), err.fullText || err.message)
  }
}

async function remove(row) {
  const ok = await confirm.value.ask({
    title: t('Forget {name}?', { name: row.name }),
    body: row.live
      ? t(
          'The connection is left open, but the saved profile is removed — you will have to enter the host and port again next time.',
        )
      : t('The saved profile is removed. Nothing on the server is affected.'),
    confirmLabel: t('Forget profile'),
    danger: true,
  })
  if (!ok) return
  try {
    await connection.deleteProfile(row.profile.id)
  } catch (err) {
    ui.error(t('Could not remove the profile'), err.fullText || err.message)
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Connections')"
      :subtitle="$t('Saved domains and the ones currently open')"
      :help="
        $t(
          'Every AdminServer you have saved or opened. Several can be connected at once; the one marked Active is the domain every other page is showing.',
        )
      "
    >
      <template #actions>
        <button
          class="btn btn-primary"
          :title="$t('Open the connect form to add another AdminServer, keeping the ones already open')"
          @click="router.push({ name: 'login', query: { add: '1' } })"
        >
          {{ $t('Add connection') }}
        </button>
      </template>
    </PageHeader>

    <HelpPanel id="connections" :title="$t('What the buttons on each row do')">
      <ul class="list-disc space-y-1 pl-4">
        <li>
          {{ $t('Connect opens a saved profile. It asks for the password, because passwords are never stored.') }}
        </li>
        <li>
          {{
            $t(
              'Switch to makes an already-open connection the active one — every page then shows that domain. The connections you switch away from stay open.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Close drops the live connection and forgets its password. The saved profile stays, so you can connect again later.',
            )
          }}
        </li>
        <li>{{ $t('Forget deletes the saved profile from this machine. Nothing on the server changes.') }}</li>
        <li>
          {{ $t('rename next to the name gives a connection a label of your own, such as Prod · Ankara.') }}
        </li>
      </ul>
      <p>
        {{ $t('The dot on the left is green for active, grey for open but not active, and hollow for not connected.') }}
      </p>
    </HelpPanel>

    <div v-if="!rows.length" class="card p-10 text-center text-sm text-zinc-400">
      {{ $t('No saved connections yet.') }}
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="row in rows"
        :key="row.key"
        class="card flex flex-wrap items-center gap-3 p-3"
        :class="row.active && 'ring-1 ring-indigo-500/50'"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :class="
            row.active
              ? 'bg-emerald-500'
              : row.live
                ? 'bg-zinc-400 dark:bg-zinc-500'
                : 'border border-zinc-300 dark:border-zinc-600'
          "
          :title="row.active ? $t('Active') : row.live ? $t('Connected') : $t('Not connected')"
        />

        <div class="min-w-0 flex-1">
          <input
            v-if="renaming === row.key"
            v-model="draftName"
            class="input max-w-xs py-1"
            autofocus
            @blur="commitRename(row)"
            @keyup.enter="commitRename(row)"
            @keyup.esc="renaming = null"
          />
          <div v-else class="flex items-center gap-2">
            <span class="truncate font-medium text-zinc-900 dark:text-zinc-50">{{ row.name }}</span>
            <span
              v-if="row.active"
              class="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              {{ $t('Active') }}
            </span>
            <span v-if="!row.profile" class="text-xs text-zinc-400 dark:text-zinc-500">{{ $t('not saved') }}</span>
            <button
              v-if="row.profile"
              class="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
              :title="$t('Give this connection a name of your own, such as Prod · Ankara')"
              @click="startRename(row)"
            >
              {{ $t('rename') }}
            </button>
          </div>
          <p class="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {{ row.username }}@{{ row.host }}:{{ row.port }}<span v-if="row.ssl"> · SSL</span>
          </p>
        </div>

        <p class="hidden text-xs text-zinc-400 sm:block dark:text-zinc-500">
          {{ row.live ? $t('Connected') : $t('Last used {when}', { when: datetime(row.lastUsedAt) }) }}
        </p>

        <div class="flex gap-1.5">
          <button
            v-if="row.live && !row.active"
            class="btn btn-primary px-2 py-1 text-xs"
            :title="$t('Make this the active domain — every page switches to it. Other connections stay open.')"
            :disabled="busyId === row.key"
            @click="activate(row)"
          >
            {{ $t('Switch to') }}
          </button>
          <button
            v-else-if="!row.live"
            class="btn btn-ghost px-2 py-1 text-xs"
            :title="$t('Open this saved profile — you will be asked for the password')"
            :disabled="busyId === row.key"
            @click="connect(row)"
          >
            {{ $t('Connect') }}
          </button>
          <button
            v-if="row.live"
            class="btn btn-ghost px-2 py-1 text-xs"
            :title="$t('Drop this connection and forget its password. The saved profile is kept.')"
            @click="close(row)"
          >
            {{ $t('Close') }}
          </button>
          <button
            v-if="row.profile"
            class="btn btn-danger px-2 py-1 text-xs"
            :title="$t('Delete this saved profile from this machine. Nothing on the server is affected.')"
            @click="remove(row)"
          >
            {{ $t('Forget') }}
          </button>
        </div>
      </li>
    </ul>

    <p class="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
      {{
        $t(
          'Profiles are stored on this machine without passwords, so each one needs its password entered once per console restart. Connections stay open until you close them or the console process stops.',
        )
      }}
    </p>

    <PasswordPrompt ref="prompt" />
    <ConfirmDialog ref="confirm" />
  </div>
</template>
