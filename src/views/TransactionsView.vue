<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { items, num, percent } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import StatCard from '@/components/StatCard.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import { t } from '@/i18n'

/**
 * JTA and work managers — the two runtimes that sit between "the thread pool
 * looks busy" and "the database is slow".
 *
 * A rollback total climbing while nothing is stuck is a different problem from
 * a queue that will not drain, and neither shows up on the monitoring page.
 */
const { data, error, loading, refreshing, lastUpdated, reload } = useResource(({ signal }) =>
  wls.transactionRuntimes({ signal }),
)

/** Field names moved between releases; take the first one that is present. */
const pick = (source, ...names) => {
  for (const name of names) {
    const value = source?.[name]
    if (value !== undefined && value !== null) return Number(value)
  }
  return 0
}

const rows = computed(() =>
  items(data.value?.serverRuntimes)
    .filter((runtime) => runtime.JTARuntime)
    .map((runtime) => {
      const jta = runtime.JTARuntime || {}
      const total = pick(jta, 'transactionTotalCount')
      const rolledBack = pick(jta, 'transactionRolledBackTotalCount')
      return {
        name: runtime.name,
        state: runtime.state,
        active: pick(jta, 'activeTransactionsTotalCount'),
        total,
        committed: pick(jta, 'transactionCommittedTotalCount'),
        rolledBack,
        rollbackRate: total ? (rolledBack / total) * 100 : 0,
        timeouts: pick(jta, 'transactionRolledBackTimeoutTotalCount'),
        resourceRollbacks: pick(jta, 'transactionRolledBackResourceTotalCount'),
        appRollbacks: pick(jta, 'transactionRolledBackAppTotalCount'),
        systemRollbacks: pick(jta, 'transactionRolledBackSystemTotalCount'),
        heuristics: pick(jta, 'transactionHeuristicsTotalCount'),
        abandoned: pick(jta, 'transactionAbandonedTotalCount'),
        // WebLogic reports the total seconds transactions have been active, so
        // the useful figure is the average over the transactions counted.
        averageSeconds: total ? pick(jta, 'secondsActiveTotalCount') / total : 0,
      }
    }),
)

const workManagers = computed(() => {
  const list = []
  for (const runtime of items(data.value?.serverRuntimes)) {
    for (const manager of items(runtime.workManagerRuntimes)) {
      list.push({
        key: `${runtime.name}/${manager.name}`,
        name: manager.name,
        server: runtime.name,
        pending: pick(manager, 'pendingRequests'),
        completed: pick(manager, 'completedRequests'),
        stuck: pick(manager, 'stuckThreadCount'),
      })
    }
  }
  return list
})

const totals = computed(() => ({
  active: rows.value.reduce((sum, row) => sum + row.active, 0),
  committed: rows.value.reduce((sum, row) => sum + row.committed, 0),
  rolledBack: rows.value.reduce((sum, row) => sum + row.rolledBack, 0),
  heuristics: rows.value.reduce((sum, row) => sum + row.heuristics, 0),
  pending: workManagers.value.reduce((sum, row) => sum + row.pending, 0),
}))

const rollbackRate = computed(() => {
  const total = rows.value.reduce((sum, row) => sum + row.total, 0)
  return total ? (totals.value.rolledBack / total) * 100 : 0
})

const COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Server'),
    hint: t('Each server keeps its own transaction totals, counted since it last started.'),
  },
  {
    key: 'active',
    label: t('Active'),
    align: 'right',
    hint: t(
      'Transactions in flight right now. A number that grows and never falls means transactions are being started and not finished.',
    ),
  },
  {
    key: 'committed',
    label: t('Committed'),
    align: 'right',
    hint: t(
      'Transactions that completed successfully since the server started. Only ever grows; the rate is what matters.',
    ),
  },
  {
    key: 'rolledBack',
    label: t('Rolled back'),
    align: 'right',
    hint: t(
      'Transactions that were undone, with the share of all transactions underneath. A few percent is normal on most systems; a jump is not.',
    ),
  },
  {
    key: 'timeouts',
    label: t('Timeouts'),
    align: 'right',
    hint: t(
      'Rollbacks caused by the transaction taking longer than the JTA timeout. These point at a slow database or a remote call without a limit.',
    ),
  },
  {
    key: 'resourceRollbacks',
    label: t('Resource'),
    align: 'right',
    hint: t(
      'Rollbacks a resource asked for — usually the database refusing to commit. Read the server log for the SQL error behind them.',
    ),
  },
  {
    key: 'appRollbacks',
    label: t('Application'),
    align: 'right',
    hint: t(
      'Rollbacks the application asked for itself, by calling setRollbackOnly or throwing out of a transactional method. Normal in small numbers.',
    ),
  },
  {
    key: 'heuristics',
    label: t('Heuristic'),
    align: 'right',
    hint: t(
      'Participants that decided for themselves rather than following the coordinator, so two systems may now disagree. Anything above zero needs investigating by hand.',
    ),
  },
  {
    key: 'averageSeconds',
    label: t('Avg time'),
    align: 'right',
    hint: t(
      'Average seconds a transaction stayed active, over every transaction since start-up. Compare it between servers rather than against an absolute figure.',
    ),
  },
])

const WM_COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Work manager'),
    hint: t(
      'A named queue of work with its own rules. Applications get their own; the WebLogic internal ones handle housekeeping.',
    ),
  },
  { key: 'server', label: t('Server'), hint: t('The server this work manager belongs to.') },
  {
    key: 'pending',
    label: t('Pending'),
    align: 'right',
    hint: t(
      'Requests waiting for a thread in this work manager. This is where a saturated thread pool shows which application is causing it.',
    ),
  },
  {
    key: 'completed',
    label: t('Completed'),
    align: 'right',
    hint: t('Requests this work manager has finished since the server started.'),
  },
  {
    key: 'stuck',
    label: t('Stuck'),
    align: 'right',
    hint: t(
      'Threads in this work manager busy longer than the stuck-thread timeout. Narrows a domain-wide stuck count down to one application.',
    ),
  },
])
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Transactions')"
      :subtitle="$t('JTA totals and work manager queues per server')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'What the transaction manager has been doing since each server started, and how much work is queued behind each work manager. Only running servers report these numbers.',
        )
      "
      @refresh="reload"
    />

    <HelpPanel id="transactions" :title="$t('How to read a rising rollback count')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          {{
            $t(
              'Timeouts climbing means transactions are running past the JTA timeout — nearly always a slow query or a remote call with no limit of its own. Check Data Sources for waiting connections next.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Resource rollbacks are the database refusing to commit: a constraint, a deadlock or a lost connection. The server log carries the actual SQL error.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Application rollbacks are deliberate — the code asked for them. A jump usually means a validation or downstream failure rather than an infrastructure problem.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Heuristic above zero means a participant decided on its own and two systems may now disagree. That one is investigated by hand, not fixed from a console.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'Totals only ever grow. Turn auto-refresh on and watch how fast they move — the rate tells you far more than the number.',
          )
        }}
      </p>
    </HelpPanel>

    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        :label="$t('Active now')"
        :value="num(totals.active)"
        :info="$t('Transactions in flight across every running server at this moment.')"
      />
      <StatCard
        :label="$t('Committed')"
        :value="num(totals.committed)"
        :info="$t('Transactions that completed successfully since each server started.')"
      />
      <StatCard
        :label="$t('Rollback rate')"
        :value="percent(rollbackRate, 1)"
        :tone="rollbackRate > 5 ? 'warn' : 'good'"
        :hint="$t('{count} rolled back', { count: num(totals.rolledBack) })"
        :info="
          $t(
            'Rolled back as a share of all transactions since start-up. A steady low percentage is normal; a rise is the signal worth acting on.',
          )
        "
      />
      <StatCard
        :label="$t('Heuristic outcomes')"
        :value="num(totals.heuristics)"
        :tone="totals.heuristics > 0 ? 'bad' : 'good'"
        :info="
          $t(
            'Participants that committed or rolled back against the coordinator\'s decision, leaving two systems possibly out of step. Anything above zero deserves a manual check.',
          )
        "
      />
    </div>

    <DataTable
      :columns="COLUMNS"
      :rows="rows"
      state-key="main"
      export-name="transactions"
      :loading="loading"
      :error="error && !data ? error : null"
      :empty-text="$t('No server is running, so there are no transaction runtimes to read.')"
      :search-placeholder="$t('Filter servers…')"
      :search-hint="$t('Matches the server name of the rows already loaded.')"
      @retry="reload"
    >
      <template #cell:name="{ row }">
        <RouterLink
          :to="{ name: 'server-detail', params: { name: row.name } }"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {{ row.name }}
        </RouterLink>
      </template>
      <template #cell:active="{ row }"><span class="tabular-nums">{{ num(row.active) }}</span></template>
      <template #cell:committed="{ row }"><span class="tabular-nums">{{ num(row.committed) }}</span></template>
      <template #cell:rolledBack="{ row }">
        <span :class="['tabular-nums', row.rollbackRate > 5 && 'font-semibold text-amber-600 dark:text-amber-400']">
          {{ num(row.rolledBack) }}
        </span>
        <div class="text-xs text-zinc-400 dark:text-zinc-500">{{ percent(row.rollbackRate, 1) }}</div>
      </template>
      <template #cell:timeouts="{ row }">
        <span :class="['tabular-nums', row.timeouts > 0 && 'text-amber-600 dark:text-amber-400']">
          {{ num(row.timeouts) }}
        </span>
      </template>
      <template #cell:resourceRollbacks="{ row }">
        <span class="tabular-nums">{{ num(row.resourceRollbacks) }}</span>
      </template>
      <template #cell:appRollbacks="{ row }"><span class="tabular-nums">{{ num(row.appRollbacks) }}</span></template>
      <template #cell:heuristics="{ row }">
        <span :class="['tabular-nums', row.heuristics > 0 && 'font-semibold text-red-600 dark:text-red-400']">
          {{ num(row.heuristics) }}
        </span>
      </template>
      <template #cell:averageSeconds="{ row }">
        <span class="tabular-nums">
          {{ row.averageSeconds ? $t('{count}s', { count: row.averageSeconds.toFixed(2) }) : '—' }}
        </span>
      </template>
    </DataTable>

    <template v-if="workManagers.length">
      <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {{ $t('Work managers') }}
        <span class="ml-1 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          {{ $t('— which queue the pending requests are actually sitting in') }}
        </span>
      </h2>
      <DataTable
        :columns="WM_COLUMNS"
        :rows="workManagers"
        row-key="key"
        state-key="wm"
        export-name="work-managers"
        dense
        :search-placeholder="$t('Filter work managers…')"
        :search-hint="$t('Matches the work manager name and the server it belongs to.')"
      >
        <template #cell:pending="{ row }">
          <span :class="['tabular-nums', row.pending > 0 && 'font-semibold text-amber-600 dark:text-amber-400']">
            {{ num(row.pending) }}
          </span>
        </template>
        <template #cell:completed="{ row }"><span class="tabular-nums">{{ num(row.completed) }}</span></template>
        <template #cell:stuck="{ row }">
          <span :class="['tabular-nums', row.stuck > 0 && 'font-semibold text-red-600 dark:text-red-400']">
            {{ num(row.stuck) }}
          </span>
        </template>
      </DataTable>
    </template>
  </div>
</template>
