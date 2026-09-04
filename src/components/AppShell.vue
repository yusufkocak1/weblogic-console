<script setup>
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore, REFRESH_OPTIONS } from '@/stores/ui'
import ConnectionSwitcher from '@/components/ConnectionSwitcher.vue'
import InfoTip from '@/components/InfoTip.vue'

const connection = useConnectionStore()
const ui = useUiStore()
const router = useRouter()

const NAV = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    hint: 'Domain overview: how many servers run, plus a card per server with heap, threads and health.',
    icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  },
  {
    name: 'servers',
    label: 'Servers',
    hint: 'Start, suspend, resume and shut down servers, and see their listen address, heap and uptime.',
    icon: 'M4 5h16v5H4V5Zm0 9h16v5H4v-5Zm3-6.5h.01M7 16.5h.01',
  },
  {
    name: 'clusters',
    label: 'Clusters',
    hint: 'Cluster membership, how many members are alive, and session replication counts.',
    icon: 'M12 3v4m0 10v4M3 12h4m10 0h4M7.5 7.5 5 5m14 14-2.5-2.5m0-9L19 5M5 19l2.5-2.5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  },
  {
    name: 'deployments',
    label: 'Deployments',
    hint: 'Applications and shared libraries: where they are targeted and whether they are healthy. Start and stop them here.',
    icon: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0v18m9-13.5L12 12 3 7.5',
  },
  {
    name: 'data-sources',
    label: 'Data Sources',
    hint: 'JDBC pools with live connection counts, and a Test button that opens a real connection.',
    icon: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  },
  {
    name: 'jms',
    label: 'JMS',
    hint: 'Messaging runtime: JMS servers, queues and topics with current, pending and high message counts.',
    icon: 'M3 6h18v12H3V6Zm0 1.5 9 6 9-6',
  },
  {
    name: 'configuration',
    label: 'Configuration',
    hint: 'Change domain settings — ports, pool sizes, log levels — and activate them. Every field explains what it does.',
    icon: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2M16 4v4M8 10v4M16 16v4',
  },
  {
    name: 'monitoring',
    label: 'Monitoring',
    hint: 'Per-server JVM heap and thread pool detail — the page to open when something feels slow.',
    icon: 'M3 3v18h18M7 15l3.5-4 3 3L20 7',
  },
  {
    name: 'logs',
    label: 'Logs',
    hint: 'Search server logs by severity, time window and message text, without shell access to the machine.',
    icon: 'M8 4h9l3 3v13H8V4Zm0 0H5v16h3M11 9h6M11 13h6M11 17h4',
  },
  {
    name: 'explorer',
    label: 'REST Explorer',
    hint: 'Call any management REST endpoint directly, for anything the other pages do not cover.',
    icon: 'M4 7h16M4 12h16M4 17h10M18 15l3 2-3 2',
  },
]


async function disconnectAll() {
  await connection.disconnectAll()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
    <!-- Sidebar: fixed drawer on small screens, static column from lg up. -->
    <div
      v-if="ui.sidebarOpen"
      class="fixed inset-0 z-30 bg-zinc-950/50 lg:hidden"
      @click="ui.sidebarOpen = false"
    />
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white transition-transform lg:static lg:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900',
        ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="border-b border-zinc-200 p-2 dark:border-zinc-800">
        <ConnectionSwitcher />
        <p v-if="ui.helpVisible" class="mt-1 flex items-center gap-1 px-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          Active domain
          <InfoTip
            heading="Active connection"
            text="Every page below shows data for this domain only. Click the name to switch to another open AdminServer, add one, or manage saved connections."
            label="What the connection selector does"
          />
        </p>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto p-2">
        <RouterLink
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          :title="item.hint"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          active-class="!bg-indigo-50 !text-indigo-700 dark:!bg-indigo-500/10 dark:!text-indigo-300"
          @click="ui.sidebarOpen = false"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p class="mb-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
          Signed in as <span class="font-medium text-zinc-700 dark:text-zinc-200">{{ connection.username }}</span>
          <template v-if="connection.connections.length > 1">
            · {{ connection.connections.length }} connections open
          </template>
        </p>
        <button
          class="btn btn-ghost w-full"
          :title="
            connection.connections.length > 1
              ? 'Close every open connection and return to the sign-in screen. Saved profiles are kept.'
              : 'Close this connection and return to the sign-in screen. The saved profile is kept, the password is forgotten.'
          "
          @click="disconnectAll"
        >
          {{ connection.connections.length > 1 ? 'Disconnect all' : 'Disconnect' }}
        </button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        <button class="btn btn-ghost lg:hidden" aria-label="Toggle navigation" @click="ui.sidebarOpen = !ui.sidebarOpen">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span class="truncate text-sm font-medium text-zinc-700 lg:hidden dark:text-zinc-200">
          {{ connection.activeLabel }}
        </span>

        <span
          v-if="connection.productionMode"
          class="hidden rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline dark:bg-amber-500/15 dark:text-amber-300"
          title="This domain runs in production mode: changes here affect live traffic, and WebLogic requires confirmation for many operations."
        >
          Production
        </span>

        <div class="ml-auto flex items-center gap-2">
          <label
            class="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex dark:text-zinc-400"
            title="How often pages re-fetch data from the AdminServer. Set it to Off on a busy domain and use the Refresh button instead."
          >
            Auto-refresh
            <select
              class="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              :value="ui.refreshMs"
              @change="ui.setRefresh(Number($event.target.value))"
            >
              <option v-for="option in REFRESH_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <button
            class="btn btn-ghost"
            :aria-label="ui.helpVisible ? 'Hide help hints' : 'Show help hints'"
            :title="
              ui.helpVisible
                ? 'Hide the help panels and the ⓘ hints throughout the console'
                : 'Show help panels and ⓘ hints explaining each page, field and metric'
            "
            :aria-pressed="ui.helpVisible"
            @click="ui.toggleHelp()"
          >
            <svg
              class="h-4 w-4"
              :class="ui.helpVisible ? 'text-indigo-500 dark:text-indigo-400' : ''"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.8c-.5.2-.8.7-.8 1.3v.4M12 17v.01" />
              <path v-if="!ui.helpVisible" d="m4 20 16-16" />
            </svg>
          </button>

          <button class="btn btn-ghost" :aria-label="`Switch to ${ui.theme === 'dark' ? 'light' : 'dark'} theme`" :title="`Switch to the ${ui.theme === 'dark' ? 'light' : 'dark'} theme`" @click="ui.toggleTheme()">
            <svg v-if="ui.theme === 'dark'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
            <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          </button>
        </div>
      </header>

      <main class="min-w-0 flex-1 p-4 sm:p-6">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>
    </div>
  </div>
</template>
