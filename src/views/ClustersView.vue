<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { items, num, targetNames } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StateBadge from '@/components/StateBadge.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [configs, runtimes, snapshot] = await Promise.all([
    wls.clusters({ signal }),
    wls.clusterRuntimes({ signal }),
    wls.runtimeSnapshot({ signal }),
  ])
  return { configs, runtimes, snapshot }
})

/**
 * There is no domain-wide ClusterRuntime: each member server reports its own
 * view of the cluster, so the per-server runtimes are grouped by cluster name.
 */
const clusters = computed(() => {
  const states = new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r.state]))
  const byCluster = new Map()
  for (const server of items(data.value?.runtimes?.serverRuntimes)) {
    const runtime = server.clusterRuntime
    if (!runtime?.name) continue
    if (!byCluster.has(runtime.name)) byCluster.set(runtime.name, [])
    byCluster.get(runtime.name).push({ server: server.name, ...runtime })
  }

  return items(data.value?.configs).map((config) => {
    const members = targetNames(config.servers)
    const memberRuntimes = byCluster.get(config.name) || []
    return {
      name: config.name,
      messagingMode: config.clusterMessagingMode || '—',
      address: config.clusterAddress || (config.multicastAddress ? `${config.multicastAddress}:${config.multicastPort}` : '—'),
      members: members.length ? members : memberRuntimes.map((m) => m.server),
      alive: memberRuntimes[0]?.aliveServerCount ?? memberRuntimes.length,
      primaries: memberRuntimes.reduce((sum, m) => sum + Number(m.primaryCount || 0), 0),
      secondaries: memberRuntimes.reduce((sum, m) => sum + Number(m.secondaryCount || 0), 0),
      resends: memberRuntimes.reduce((sum, m) => sum + Number(m.resendRequestsCount || 0), 0),
      states,
    }
  })
})
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Clusters')"
      :subtitle="$t('Membership and replication state')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'One card per configured cluster: who its members are, how many of them are alive, and how much session replication is going on between them.',
        )
      "
      @refresh="reload"
    />

    <HelpPanel id="clusters" :title="$t('How to read a cluster card')">
      <ul class="list-disc space-y-1 pl-4">
        <li>{{ $t('Alive is the headline number: members reachable / members configured.') }}</li>
        <li>
          {{
            $t(
              'Primaries and Secondaries are replicated HTTP sessions. Sessions have a primary copy on one member and a backup on another, so a member can fail without logging users out.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Resends should stay near zero. A number that keeps climbing means cluster members are losing each other\'s messages — usually a network or multicast problem.',
            )
          }}
        </li>
        <li>
          {{ $t('The badges at the bottom are the live state of each member; click through to Servers to act on one.') }}
        </li>
      </ul>
      <p>
        {{
          $t(
            'There is no domain-wide cluster runtime in WebLogic: each member reports its own view, and these figures are that view combined.',
          )
        }}
      </p>
    </HelpPanel>

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />
    <div v-else-if="loading && !clusters.length" class="card p-8 text-center text-sm text-zinc-400">
      {{ $t('Loading…') }}
    </div>
    <div v-else-if="!clusters.length" class="card p-8 text-center text-sm text-zinc-400">
      {{ $t('No clusters are configured in this domain.') }}
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <section v-for="cluster in clusters" :key="cluster.name" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">
              <RouterLink
                :to="{ name: 'cluster-detail', params: { name: cluster.name } }"
                class="text-indigo-600 hover:underline dark:text-indigo-400"
                :title="$t('Open this cluster: replication detail and every setting it has')"
              >
                {{ cluster.name }}
              </RouterLink>
            </h2>
            <p class="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ cluster.address }}</p>
          </div>
          <span
            class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            :title="
              $t(
                'How members find and talk to each other: unicast (direct TCP, the usual choice) or multicast (UDP group, needs multicast enabled on the network).',
              )
            "
          >
            {{ cluster.messagingMode }}
          </span>
        </div>

        <dl class="mt-4 grid grid-cols-4 gap-3 text-sm">
          <div>
            <dt class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('Alive') }}
              <InfoTip
                :heading="$t('Alive')"
                :text="
                  $t(
                    'Members currently reachable, out of the members configured for this cluster. Anything below the total means a member is down or cannot be reached.',
                  )
                "
              />
            </dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.alive) }} / {{ cluster.members.length }}</dd>
          </div>
          <div>
            <dt class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('Primaries') }}
              <InfoTip
                :heading="$t('Primaries')"
                :text="
                  $t(
                    'HTTP sessions whose primary copy lives on a member of this cluster. Roughly, the sessions this cluster is actively serving.',
                  )
                "
              />
            </dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.primaries) }}</dd>
          </div>
          <div>
            <dt class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('Secondaries') }}
              <InfoTip
                :heading="$t('Secondaries')"
                :text="
                  $t(
                    'Backup copies of sessions held for other members. Zero across a multi-member cluster means session replication is not working.',
                  )
                "
              />
            </dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.secondaries) }}</dd>
          </div>
          <div>
            <dt class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              {{ $t('Resends') }}
              <InfoTip
                :heading="$t('Resends')"
                :text="
                  $t(
                    'Cluster messages that had to be sent again. It should stay at or near zero; a rising count points at a congested or lossy network.',
                  )
                "
              />
            </dt>
            <dd class="tabular-nums font-medium">{{ num(cluster.resends) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <RouterLink
            v-for="member in cluster.members"
            :key="member"
            :to="{ name: 'server-detail', params: { name: member } }"
            class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
            :title="
              $t('{member} — current state of this cluster member. Click to open it and change its settings.', {
                member,
              })
            "
          >
            {{ member }}
            <StateBadge :state="cluster.states.get(member) || 'SHUTDOWN'" />
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
