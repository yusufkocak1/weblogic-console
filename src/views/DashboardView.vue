<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useConnectionStore } from '@/stores/connection'
import { useHistoryStore } from '@/stores/history'
import { bytes, duration, healthOf, items, num, since } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StateBadge from '@/components/StateBadge.vue'
import MeterBar from '@/components/MeterBar.vue'
import SparkLine from '@/components/SparkLine.vue'
import ErrorState from '@/components/ErrorState.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'
import { t } from '@/i18n'

const connection = useConnectionStore()
// Filled in the background by the console process, so a card opened just now
// still has an hour of heap behind it.
const history = useHistoryStore()

const historyWindow = computed(() => {
  const minutes = Math.round(history.span / 60000)
  if (!minutes) return t('no history yet')
  return minutes < 60
    ? t('last {minutes} min', { minutes })
    : t('last {hours} h', { hours: (minutes / 60).toFixed(1) })
})

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(async ({ signal }) => {
  const [snapshot, servers, clusters, deployments] = await Promise.all([
    wls.runtimeSnapshot({ signal }),
    wls.configuredServers({ signal }),
    wls.clusters({ signal }),
    wls.appDeployments({ signal }),
  ])
  return { snapshot, servers, clusters, deployments }
})

/** Merge the configured server list with whatever runtime exists for each one. */
const servers = computed(() => {
  const runtimes = new Map(items(data.value?.snapshot?.serverRuntimes).map((r) => [r.name, r]))
  const lifecycles = new Map(items(data.value?.snapshot?.serverLifeCycleRuntimes).map((r) => [r.name, r.state]))
  return items(data.value?.servers).map((config) => {
    const runtime = runtimes.get(config.name)
    return {
      name: config.name,
      state: runtime?.state || lifecycles.get(config.name) || 'SHUTDOWN',
      health: runtime?.healthState,
      listen: `${config.listenAddress || 'localhost'}:${config.listenPort ?? '—'}`,
      uptime: runtime?.activationTime ? since(runtime.activationTime) : null,
      jvm: runtime?.JVMRuntime || null,
      threads: runtime?.threadPoolRuntime || null,
      sockets: runtime?.openSocketsCurrentCount,
    }
  })
})

const runningCount = computed(() => servers.value.filter((s) => s.state === 'RUNNING').length)
const unhealthy = computed(() => servers.value.filter((s) => s.state === 'RUNNING' && healthOf(s.health) !== 'OK'))
const stuckThreads = computed(() =>
  servers.value.reduce((total, s) => total + Number(s.threads?.stuckThreadCount || 0), 0),
)

const serversTone = computed(() => {
  if (!servers.value.length) return 'default'
  if (runningCount.value === servers.value.length) return 'good'
  return runningCount.value === 0 ? 'bad' : 'warn'
})
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Dashboard')"
      :subtitle="`${connection.domainName} · ${connection.baseUrl}`"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'A single screen for the whole domain: the four counters summarise it, and each card below is one configured server. Click a card to open that server, or Domain settings for what applies to the domain as a whole.',
        )
      "
      @refresh="reload"
    >
      <template #actions>
        <RouterLink
          class="btn btn-ghost"
          :to="{ name: 'domain-settings' }"
          :title="
            $t(
              'Settings that belong to no single server: the administration port, change auditing and the domain-wide log',
            )
          "
        >
          {{ $t('Domain settings') }}
        </RouterLink>
      </template>
    </PageHeader>

    <HelpPanel id="dashboard" :title="$t('New here? Start with these three steps')" default-open>
      <ol class="list-decimal space-y-1 pl-4">
        <li>{{ $t('Check the counters: a green Servers running means every configured server is up.') }}</li>
        <li>{{ $t('Scan the server cards for a red or amber heap bar, or a state that is not RUNNING.') }}</li>
        <li>
          {{
            $t(
              'Click a card to open that server — its runtime detail, the buttons to start, suspend or stop it, and every setting it has.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'Numbers refresh on the interval set in the top bar. Hover any ⓘ for an explanation; the ⓘ button up there hides all hints once you no longer need them.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'The line under each heap bar is that server\'s recent history, collected in the background whether or not this page is open. The bell in the top bar says when a threshold has been crossed, and Ctrl-K jumps straight to any server, application or data source by name.',
          )
        }}
      </p>
    </HelpPanel>

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          :label="$t('Servers running')"
          :value="`${runningCount} / ${servers.length}`"
          :tone="serversTone"
          :hint="loading && !data ? $t('Loading…') : $t('Configured servers in this domain')"
          :info="
            $t(
              'Servers reporting RUNNING out of every server configured in the domain. Amber means some are down, red means none are up. A server only reports runtime data while it is running.',
            )
          "
        />
        <StatCard
          :label="$t('Clusters')"
          :value="num(items(data?.clusters).length)"
          :hint="$t('Configured clusters')"
          :info="
            $t(
              'Groups of servers that share work and replicate sessions. Open the Clusters page to see which members are alive.',
            )
          "
        />
        <StatCard
          :label="$t('Deployments')"
          :value="num(items(data?.deployments).length)"
          :hint="$t('Applications and modules')"
          :info="
            $t(
              'Applications deployed to this domain (EAR, WAR and similar). Shared libraries are counted separately on the Deployments page.',
            )
          "
        />
        <StatCard
          :label="$t('Stuck threads')"
          :value="num(stuckThreads)"
          :tone="stuckThreads > 0 ? 'bad' : 'good'"
          :hint="$t('Across all running servers')"
          :info="
            $t(
              'Request threads that have been busy longer than the configured stuck-thread timeout (600s by default). Anything above zero usually means a slow database call, a remote call without a timeout, or a deadlock — check Monitoring and Logs next.',
            )
          "
        />
      </div>

      <div
        v-if="unhealthy.length"
        class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong>{{ unhealthy.length }}</strong>
        {{
          unhealthy.length === 1
            ? $t('running server is not reporting healthy:')
            : $t('running servers are not reporting healthy:')
        }}
        {{ unhealthy.map((s) => s.name).join(', ') }}
      </div>

      <h2 class="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {{ $t('Servers') }}
      </h2>

      <div v-if="!servers.length && loading" class="card p-8 text-center text-sm text-zinc-400">
        {{ $t('Loading servers…') }}
      </div>
      <div v-else-if="!servers.length" class="card p-8 text-center text-sm text-zinc-400">
        {{ $t('No servers are configured in this domain.') }}
      </div>

      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="server in servers"
          :key="server.name"
          :to="{ name: 'server-detail', params: { name: server.name } }"
          class="card p-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-semibold text-zinc-900 dark:text-zinc-50">{{ server.name }}</p>
              <p class="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ server.listen }}</p>
            </div>
            <StateBadge :state="server.state" />
          </div>

          <div v-if="server.jvm" class="mt-4 space-y-3">
            <MeterBar
              :tip="
                $t(
                  'Java heap in use against the JVM maximum (-Xmx). The bar turns amber past 75% and red past 90%. Brief peaks are normal; a bar that stays red points at a memory problem.',
                )
              "
              :value="Number(server.jvm.heapSizeCurrent || 0) - Number(server.jvm.heapFreeCurrent || 0)"
              :max="Number(server.jvm.heapSizeMax || server.jvm.heapSizeCurrent || 1)"
              :label="
                $t('Heap {used} of {max}', {
                  used: bytes(Number(server.jvm.heapSizeCurrent || 0) - Number(server.jvm.heapFreeCurrent || 0)),
                  max: bytes(server.jvm.heapSizeMax),
                })
              "
            />

            <!-- The shape matters more than the reading: a sawtooth is healthy
                 garbage collection, a staircase is a leak. -->
            <SparkLine
              :values="history.heapPercentSeries(server.name)"
              :max="100"
              :height="26"
              :tone="history.heapPercentSeries(server.name).at(-1) >= 90 ? 'bad' : 'default'"
              :title="$t('Heap used, {window}', { window: historyWindow })"
              :empty-text="$t('heap history builds up as the console runs')"
            />
            <dl class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Uptime') }}
                  <InfoTip
                    :heading="$t('Uptime')"
                    :text="
                      $t(
                        'How long this server\'s JVM has been running. A value that keeps resetting means the process is restarting.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums text-zinc-700 dark:text-zinc-200">{{ duration(server.jvm.uptime) }}</dd>
              </div>
              <div>
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Threads') }}
                  <InfoTip
                    :heading="$t('Threads')"
                    :text="
                      $t(
                        'Total execute threads in the self-tuning pool. WebLogic grows and shrinks this number with load; the split between busy and idle is on the Monitoring page.',
                      )
                    "
                  />
                </dt>
                <dd class="tabular-nums text-zinc-700 dark:text-zinc-200">
                  {{ num(server.threads?.executeThreadTotalCount) }}
                </dd>
              </div>
              <div>
                <dt class="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                  {{ $t('Health') }}
                  <InfoTip
                    :heading="$t('Health')"
                    :text="
                      $t(
                        'The server\'s self-reported health: OK, WARN, CRITICAL, FAILED or OVERLOADED. A running server can still be unhealthy — that is what this field is for.',
                      )
                    "
                  />
                </dt>
                <dd class="text-zinc-700 dark:text-zinc-200">{{ healthOf(server.health) }}</dd>
              </div>
            </dl>
          </div>
          <p v-else class="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
            {{ $t('No runtime data — the server is not running.') }}
          </p>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
