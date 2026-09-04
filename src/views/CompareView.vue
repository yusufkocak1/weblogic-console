<script setup>
import { computed, ref, watch } from 'vue'
import * as wls from '@/api/weblogic'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { items, targetNames } from '@/utils/format'
import { download, timestampedName } from '@/utils/export'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import ErrorState from '@/components/ErrorState.vue'
import InfoTip from '@/components/InfoTip.vue'

/**
 * Two domains, side by side.
 *
 * "It works in test" is a configuration diff nine times out of ten, and finding
 * it normally means opening two consoles and comparing by eye. Because this
 * console already holds several connections at once and pins every request to
 * one of them, the same read can be done against both domains and subtracted.
 *
 * Nothing here writes: it answers what differs, and leaves fixing it to the
 * page for the object concerned.
 */
const connection = useConnectionStore()
const ui = useUiStore()

const left = ref('')
const right = ref('')
const snapshots = ref(null)
const loading = ref(false)
const error = ref(null)
const comparedAt = ref(null)
const showSame = ref(false)

/** Sensible defaults: the domain you are on, and the next one you have open. */
watch(
  () => connection.connections.map((entry) => entry.id).join(','),
  () => {
    const open = connection.connections
    if (!left.value || !open.some((entry) => entry.id === left.value)) left.value = connection.activeId || open[0]?.id || ''
    if (!right.value || !open.some((entry) => entry.id === right.value)) {
      right.value = open.find((entry) => entry.id !== left.value)?.id || ''
    }
  },
  { immediate: true },
)

const nameOf = (id) => connection.connections.find((entry) => entry.id === id)?.name || '—'

/**
 * One object as a flat map of attribute -> comparable text. Nested MBeans keep
 * their path in the key, so a pool size reads as
 * JDBCResource.JDBCConnectionPoolParams.maxCapacity.
 */
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node || {})) {
    if (key === 'links' || key === 'identity') continue
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      const names = targetNames(value)
      out[path] = (names.length ? names : value.map((entry) => String(entry))).sort().join(', ')
    } else if (value && typeof value === 'object') {
      flatten(value, path, out)
    } else {
      out[path] = value === null || value === undefined ? '' : String(value)
    }
  }
  return out
}

const CATEGORIES = [
  { key: 'servers', label: 'Servers', route: 'server-detail' },
  { key: 'clusters', label: 'Clusters', route: 'cluster-detail' },
  { key: 'JDBCSystemResources', label: 'Data sources', route: 'data-source-detail' },
  { key: 'appDeployments', label: 'Applications', route: 'deployment-detail' },
  { key: 'libraries', label: 'Shared libraries', route: null },
  { key: 'machines', label: 'Machines', route: null },
]

function indexOf(snapshot, key) {
  const map = new Map()
  for (const entry of items(snapshot?.[key])) {
    if (entry?.name) map.set(entry.name, flatten(entry))
  }
  return map
}

function diffMaps(a, b) {
  const differences = []
  for (const attribute of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (attribute === 'name') continue
    const leftValue = a[attribute] ?? ''
    const rightValue = b[attribute] ?? ''
    if (leftValue !== rightValue) differences.push({ attribute, left: leftValue, right: rightValue })
  }
  return differences.sort((x, y) => x.attribute.localeCompare(y.attribute))
}

const report = computed(() => {
  if (!snapshots.value) return null
  const [a, b] = snapshots.value

  const sections = CATEGORIES.map((category) => {
    const leftIndex = indexOf(a, category.key)
    const rightIndex = indexOf(b, category.key)
    const onlyLeft = [...leftIndex.keys()].filter((name) => !rightIndex.has(name)).sort()
    const onlyRight = [...rightIndex.keys()].filter((name) => !leftIndex.has(name)).sort()
    const changed = []
    let same = 0
    for (const [name, values] of leftIndex) {
      if (!rightIndex.has(name)) continue
      const differences = diffMaps(values, rightIndex.get(name))
      if (differences.length) changed.push({ name, differences })
      else same += 1
    }
    return { ...category, onlyLeft, onlyRight, changed: changed.sort((x, y) => x.name.localeCompare(y.name)), same }
  })

  // The domain's own attributes, minus the ones that are meant to differ.
  const domainDifferences = diffMaps(
    flatten({ ...a, servers: undefined, clusters: undefined, JDBCSystemResources: undefined, appDeployments: undefined, libraries: undefined, machines: undefined }),
    flatten({ ...b, servers: undefined, clusters: undefined, JDBCSystemResources: undefined, appDeployments: undefined, libraries: undefined, machines: undefined }),
  ).filter((difference) => !difference.attribute.includes('.'))

  const totals = sections.reduce(
    (sum, section) => ({
      onlyLeft: sum.onlyLeft + section.onlyLeft.length,
      onlyRight: sum.onlyRight + section.onlyRight.length,
      changed: sum.changed + section.changed.length,
      same: sum.same + section.same,
    }),
    { onlyLeft: 0, onlyRight: 0, changed: 0, same: 0 },
  )

  return { sections, domainDifferences, totals }
})

async function compare() {
  if (!left.value || !right.value || left.value === right.value) return
  loading.value = true
  error.value = null
  try {
    // Each read is pinned to its own connection, so the two never cross.
    snapshots.value = await Promise.all([
      wls.configSnapshot({ connectionId: left.value }),
      wls.configSnapshot({ connectionId: right.value }),
    ])
    comparedAt.value = Date.now()
  } catch (err) {
    error.value = err
    snapshots.value = null
  } finally {
    loading.value = false
  }
}

function swap() {
  const previous = left.value
  left.value = right.value
  right.value = previous
  if (snapshots.value) compare()
}

function save() {
  if (!report.value) return
  download(
    timestampedName('domain-comparison', 'json'),
    JSON.stringify(
      { left: nameOf(left.value), right: nameOf(right.value), comparedAt: comparedAt.value, ...report.value },
      null,
      2,
    ),
    'application/json;charset=utf-8',
  )
  ui.success('Comparison saved', 'The full difference report has been downloaded as JSON.')
}

const canCompare = computed(() => left.value && right.value && left.value !== right.value)
const enoughConnections = computed(() => connection.connections.length > 1)
</script>

<template>
  <div>
    <PageHeader
      title="Compare domains"
      subtitle="What differs between two open domains"
      :last-updated="comparedAt"
      :refreshing="loading"
      help="Reads the configuration of two domains you have open and subtracts one from the other: what exists on one side only, and where the same object is set up differently. Nothing is changed by comparing."
      @refresh="compare"
    >
      <template #actions>
        <button
          v-if="report"
          class="btn btn-ghost"
          title="Download the whole comparison as JSON, for a ticket or a review"
          @click="save"
        >
          Save report
        </button>
      </template>
    </PageHeader>

    <HelpPanel id="compare" title="How to use this when something works in one environment and not the other">
      <ol class="list-decimal space-y-1 pl-4">
        <li>Open both domains — the connection switcher at the top of the sidebar adds a second one.</li>
        <li>Pick them below, left and right, and press <strong>Compare</strong>.</li>
        <li>
          Read <strong>Only in</strong> first: a data source or an application that exists on one side and not the
          other explains most "works in test" reports on its own.
        </li>
        <li>
          Then read the changed objects. Pool sizes, listen ports, timeouts and targets are where domains drift
          fastest.
        </li>
      </ol>
      <p>Both sides are read with the credentials of their own connection, so a Monitor account is enough for this page.</p>
    </HelpPanel>

    <div v-if="!enoughConnections" class="card p-6 text-sm text-zinc-600 dark:text-zinc-300">
      Comparing needs two domains open at once. Use the connection switcher at the top of the sidebar to connect to a
      second AdminServer — production and test, say — and this page will compare them.
    </div>

    <template v-else>
      <div class="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div class="min-w-48 flex-1">
          <label class="label-row" for="compare-left">
            Left
            <InfoTip heading="Left" text="The domain treated as the baseline. Differences are described as left versus right; swapping them changes nothing but the reading order." />
          </label>
          <select id="compare-left" v-model="left" class="input">
            <option v-for="entry in connection.connections" :key="entry.id" :value="entry.id">
              {{ entry.name }} — {{ entry.host }}:{{ entry.port }}
            </option>
          </select>
        </div>
        <button class="btn btn-ghost" title="Swap the two sides" @click="swap">⇄</button>
        <div class="min-w-48 flex-1">
          <label class="label-row" for="compare-right">
            Right
            <InfoTip heading="Right" text="The domain compared against the baseline." />
          </label>
          <select id="compare-right" v-model="right" class="input">
            <option v-for="entry in connection.connections" :key="entry.id" :value="entry.id">
              {{ entry.name }} — {{ entry.host }}:{{ entry.port }}
            </option>
          </select>
        </div>
        <button class="btn btn-primary" :disabled="!canCompare || loading" @click="compare">
          {{ loading ? 'Reading both domains…' : 'Compare' }}
        </button>
      </div>

      <p v-if="left === right" class="mb-4 text-sm text-amber-600 dark:text-amber-400">
        Pick two different domains — comparing one with itself has nothing to show.
      </p>

      <ErrorState v-if="error" :error="error" title="Could not read both domains" @retry="compare" />

      <template v-else-if="report">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            :label="`Only in ${nameOf(left)}`"
            :value="report.totals.onlyLeft"
            :tone="report.totals.onlyLeft ? 'warn' : 'good'"
            info="Objects that exist on the left and have no counterpart on the right."
          />
          <StatCard
            :label="`Only in ${nameOf(right)}`"
            :value="report.totals.onlyRight"
            :tone="report.totals.onlyRight ? 'warn' : 'good'"
            info="Objects that exist on the right and have no counterpart on the left."
          />
          <StatCard
            label="Configured differently"
            :value="report.totals.changed"
            :tone="report.totals.changed ? 'warn' : 'good'"
            info="Objects with the same name on both sides but at least one attribute that differs."
          />
          <StatCard
            label="Identical"
            :value="report.totals.same"
            tone="good"
            info="Objects that match on every attribute compared."
          />
        </div>

        <section v-if="report.domainDifferences.length" class="card mt-4 p-4">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Domain</h2>
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <th class="py-1 pr-3 font-semibold">Attribute</th>
                <th class="py-1 pr-3 font-semibold">{{ nameOf(left) }}</th>
                <th class="py-1 font-semibold">{{ nameOf(right) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="difference in report.domainDifferences" :key="difference.attribute" class="border-t border-zinc-100 dark:border-zinc-800">
                <td class="py-1.5 pr-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ difference.attribute }}</td>
                <td class="py-1.5 pr-3 break-all">{{ difference.left || '—' }}</td>
                <td class="py-1.5 break-all">{{ difference.right || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div class="mt-4 flex items-center gap-2">
          <label class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <input v-model="showSame" type="checkbox" />
            Also list the sections where everything matches
          </label>
        </div>

        <section
          v-for="section in report.sections"
          v-show="showSame || section.onlyLeft.length || section.onlyRight.length || section.changed.length"
          :key="section.key"
          class="card mt-4 p-4"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{ section.label }}</h2>
            <p class="text-xs text-zinc-400 dark:text-zinc-500">
              {{ section.same }} identical · {{ section.changed.length }} different ·
              {{ section.onlyLeft.length + section.onlyRight.length }} unmatched
            </p>
          </div>

          <div v-if="section.onlyLeft.length || section.onlyRight.length" class="mt-3 grid gap-3 sm:grid-cols-2">
            <div v-if="section.onlyLeft.length">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Only in {{ nameOf(left) }}
              </p>
              <p class="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{{ section.onlyLeft.join(', ') }}</p>
            </div>
            <div v-if="section.onlyRight.length">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Only in {{ nameOf(right) }}
              </p>
              <p class="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{{ section.onlyRight.join(', ') }}</p>
            </div>
          </div>

          <div v-for="object in section.changed" :key="object.name" class="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              <RouterLink
                v-if="section.route"
                :to="{ name: section.route, params: { name: object.name } }"
                class="text-indigo-600 hover:underline dark:text-indigo-400"
                title="Open this object in the active domain"
              >
                {{ object.name }}
              </RouterLink>
              <span v-else>{{ object.name }}</span>
            </p>
            <table class="mt-1 w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  <th class="py-1 pr-3 font-semibold">Attribute</th>
                  <th class="py-1 pr-3 font-semibold">{{ nameOf(left) }}</th>
                  <th class="py-1 font-semibold">{{ nameOf(right) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="difference in object.differences"
                  :key="difference.attribute"
                  class="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td class="py-1.5 pr-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {{ difference.attribute }}
                  </td>
                  <td class="py-1.5 pr-3 break-all">{{ difference.left || '—' }}</td>
                  <td class="py-1.5 break-all">{{ difference.right || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-if="!section.onlyLeft.length && !section.onlyRight.length && !section.changed.length"
            class="mt-2 text-sm text-zinc-500 dark:text-zinc-400"
          >
            Everything matches.
          </p>
        </section>
      </template>

      <div v-else-if="!loading" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Pick two domains and press Compare. Both are read with their own credentials; nothing is written to either.
      </div>
    </template>
  </div>
</template>
