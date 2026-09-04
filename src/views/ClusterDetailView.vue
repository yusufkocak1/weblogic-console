<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'

/**
 * One cluster: who its members are, how they are doing, and the settings that
 * decide how they find each other.
 */
const route = useRoute()
const name = computed(() => String(route.params.name || ''))

const { data, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes, snapshot] = await Promise.all([
    wls.clusters({ signal }),
    wls.clusterRuntimes({ signal }),
    wls.runtimeSnapshot({ signal }),
  ])
  return { configs, runtimes, snapshot }
})

const configured = computed(() => items(data.value?.configs).find((cluster) => cluster.name === name.value))
const missing = computed(() => Boolean(data.value) && !configured.value)

/** Each member reports its own view of the cluster; this collects them. */
const memberRuntimes = computed(() =>
  items(data.value?.runtimes?.serverRuntimes)
    .filter((server) => server.clusterRuntime?.name === name.value)
    .map((server) => ({ server: server.name, ...server.clusterRuntime })),
)

const states = computed(() => new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r.state])))

const members = computed(() => {
  const configuredMembers = targetNames(configured.value?.servers)
  return configuredMembers.length ? configuredMembers : memberRuntimes.value.map((m) => m.server)
})

const sum = (field) => memberRuntimes.value.reduce((total, member) => total + Number(member[field] || 0), 0)

const facts = computed(() => [
  {
    label: 'Alive',
    value: `${memberRuntimes.value[0]?.aliveServerCount ?? memberRuntimes.value.length} / ${members.value.length}`,
    hint: 'Members that can currently see each other, against the number configured.',
  },
  { label: 'Messaging', value: configured.value?.clusterMessagingMode || '—' },
  {
    label: 'Address',
    value: configured.value?.clusterAddress || (configured.value?.multicastAddress ? `${configured.value.multicastAddress}:${configured.value.multicastPort}` : '—'),
    mono: true,
  },
  {
    label: 'Primary sessions',
    value: num(sum('primaryCount')),
    hint: 'Replicated HTTP sessions whose main copy lives on a member of this cluster.',
  },
  {
    label: 'Secondary sessions',
    value: num(sum('secondaryCount')),
    hint: 'Backup copies held for other members, so a member can fail without logging users out.',
  },
  {
    label: 'Resends',
    value: num(sum('resendRequestsCount')),
    hint: 'Cluster messages that had to be sent again. A number that keeps climbing means members are losing each other’s messages — usually a network problem.',
  },
])
</script>

<template>
  <div>
    <PageHeader
      :title="name"
      subtitle="Cluster membership, replication and settings"
      :back="{ name: 'clusters' }"
      back-label="Clusters"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      help="One cluster: how many members are alive, how much session replication is going on, and the settings that decide how members find each other."
      @refresh="reload"
    />

    <div v-if="missing" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
      This domain has no cluster called <span class="font-mono">{{ name }}</span
      >. Go back to
      <RouterLink :to="{ name: 'clusters' }" class="text-indigo-600 dark:text-indigo-400">Clusters</RouterLink> for the
      current list.
    </div>

    <template v-else>
      <div class="card mb-4 p-4">
        <FactList :facts="facts" />

        <div v-if="members.length" class="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Members — click one to configure it
          </p>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-for="member in members"
              :key="member"
              :to="{ name: 'server-detail', params: { name: member } }"
              class="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {{ member }}
              <StateBadge :state="states.get(member) || 'SHUTDOWN'" />
            </RouterLink>
          </div>
        </div>
      </div>

      <SettingsPanel
        :sections="['clusters']"
        :name="name"
        intro="Membership belongs to each server rather than to the cluster, so it is changed on a server's own page. These settings decide how the members talk to each other and how they are addressed from outside."
      />
    </template>
  </div>
</template>
