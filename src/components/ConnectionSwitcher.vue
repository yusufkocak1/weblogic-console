<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { useReconnect } from '@/composables/useReconnect'
import PasswordPrompt from '@/components/PasswordPrompt.vue'
import { t } from '@/i18n'

const connection = useConnectionStore()
const ui = useUiStore()
const router = useRouter()

const open = ref(false)
const root = ref(null)
const prompt = ref(null)
const reconnect = useReconnect(prompt)

function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

async function switchTo(id) {
  open.value = false
  try {
    await connection.activate(id)
  } catch (err) {
    ui.error(t('Could not switch connection'), err.fullText || err.message)
  }
}

async function openProfile(profile) {
  open.value = false
  await reconnect(profile)
}

async function close(id, event) {
  event.stopPropagation()
  const wasLast = connection.connections.length === 1
  try {
    await connection.close(id)
    if (wasLast) router.push({ name: 'login' })
  } catch (err) {
    ui.error(t('Could not close connection'), err.fullText || err.message)
  }
}

function go(route) {
  open.value = false
  router.push(route)
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="
        $t(
          'The domain every page is showing. Click to switch to another open AdminServer, add one, or manage saved connections.',
        )
      "
      @click="open = !open"
    >
      <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        W
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {{ connection.activeLabel || $t('Not connected') }}
        </span>
        <span class="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {{ connection.domainName }}<template v-if="connection.target"> · {{ connection.target }}</template>
        </span>
      </span>
      <svg
        class="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform"
        :class="open && 'rotate-180'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        role="menu"
      >
        <div class="max-h-80 overflow-y-auto p-1">
          <p class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {{ $t('Connected') }}
          </p>
          <button
            v-for="item in connection.connections"
            :key="item.id"
            class="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            @click="switchTo(item.id)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="item.active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-zinc-800 dark:text-zinc-100">{{ item.name }}</span>
              <span class="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                {{ item.username }}@{{ item.host }}:{{ item.port }}
              </span>
            </span>
            <span
              class="rounded px-1 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500 dark:text-zinc-600"
              :title="$t('Close {name}', { name: item.name })"
              @click="close(item.id, $event)"
            >
              &times;
            </span>
          </button>

          <template v-if="connection.offlineProfiles.length">
            <p class="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {{ $t('Saved') }}
            </p>
            <button
              v-for="profile in connection.offlineProfiles"
              :key="profile.id"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              @click="openProfile(profile)"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-zinc-600 dark:text-zinc-300">{{ profile.name }}</span>
                <span class="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                  {{ profile.username }}@{{ profile.host }}:{{ profile.port }}
                </span>
              </span>
            </button>
          </template>
        </div>

        <div class="border-t border-zinc-200 p-1 dark:border-zinc-700">
          <button
            class="w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="go({ name: 'login', query: { add: '1' } })"
          >
            {{ $t('Add connection…') }}
          </button>
          <button
            class="w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="go({ name: 'connections' })"
          >
            {{ $t('Manage connections…') }}
          </button>
        </div>
      </div>
    </Transition>

    <PasswordPrompt ref="prompt" />
  </div>
</template>
