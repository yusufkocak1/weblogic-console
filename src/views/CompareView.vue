<script setup>
import { computed, ref, watch } from 'vue'
import * as wls from '@/api/weblogic'
import { describeAttribute } from '@/settings/catalog'
import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { items, targetNames } from '@/utils/format'
import { download, timestampedName } from '@/utils/export'
import { compareResources, resourceProfile } from '@/utils/resources'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import ErrorState from '@/components/ErrorState.vue'
import InfoTip from '@/components/InfoTip.vue'
import CompareResources from '@/components/CompareResources.vue'
import { t } from '@/i18n'

/**
 * Two domains, side by side.
 *
 * "It works in test" is a configuration diff nine times out of ten, and finding
 * it normally means opening two consoles and comparing by eye. Because this
 * console already holds several connections at once and pins every request to
 * one of them, the same read can be done against both domains and subtracted.
 *
 * The page answers two questions, and keeps them apart because they are acted
 * on differently. What is *set* differently is the attribute diff further down:
 * ports, targets, staging modes, flags. How *much* each side has — heap,
 * metaspace, pool sizes, thread ceilings — is the Resources section, where the
 * values are normalised to numbers first, because -Xmx2g and -Xmx2048m are the
 * same heap and a domain that is simply smaller does not show up as a list of
 * mismatched strings.
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

/**
 * `catalog` names the settings categories that describe this kind of object, so
 * a difference can be reported as "Maximum connections" rather than as
 * JDBCResource.JDBCConnectionPoolParams.maxCapacity. A server needs two of
 * them, because its log settings live in their own category.
 */
const categories = () => [
  {
    key: 'servers',
    label: t('Servers'),
    route: 'server-detail',
    catalog: ['servers', 'logging'],
    // The JVM command line is compared argument by argument under Resources,
    // where -Xmx2g and -Xmx2048m count as the same heap. Repeating the raw line
    // here would be a very long string that says less.
    skip: ['serverStart.arguments'],
  },
  { key: 'clusters', label: t('Clusters'), route: 'cluster-detail', catalog: ['clusters'] },
  { key: 'JDBCSystemResources', label: t('Data sources'), route: 'data-source-detail', catalog: ['data-sources'] },
  { key: 'appDeployments', label: t('Applications'), route: 'deployment-detail', catalog: ['deployments'] },
  { key: 'libraries', label: t('Shared libraries'), route: null, catalog: [] },
  { key: 'machines', label: t('Machines'), route: null, catalog: [] },
]

function indexOf(snapshot, key) {
  const map = new Map()
  for (const entry of items(snapshot?.[key])) {
    if (entry?.name) map.set(entry.name, flatten(entry))
  }
  return map
}

function diffMaps(a, b, { catalog = [], skip = [] } = {}) {
  const ignored = new Set(['name', ...skip])
  const differences = []
  for (const attribute of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (ignored.has(attribute)) continue
    const leftValue = a[attribute] ?? ''
    const rightValue = b[attribute] ?? ''
    if (leftValue === rightValue) continue
    const described = describeAttribute(catalog, attribute)
    differences.push({
      attribute,
      label: described?.label || '',
      help: described?.help || '',
      unit: described?.unit || '',
      left: leftValue,
      right: rightValue,
    })
  }
  return differences.sort((x, y) => (x.label || x.attribute).localeCompare(y.label || y.attribute))
}

/** The attributes that are not carved up into per-object sections. */
const DOMAIN_CHILDREN = {
  servers: undefined,
  clusters: undefined,
  JDBCSystemResources: undefined,
  appDeployments: undefined,
  libraries: undefined,
  machines: undefined,
}

const report = computed(() => {
  if (!snapshots.value) return null
  const a = snapshots.value[0].config
  const b = snapshots.value[1].config

  const sections = categories().map((category) => {
    const leftIndex = indexOf(a, category.key)
    const rightIndex = indexOf(b, category.key)
    const onlyLeft = [...leftIndex.keys()].filter((name) => !rightIndex.has(name)).sort()
    const onlyRight = [...rightIndex.keys()].filter((name) => !leftIndex.has(name)).sort()
    const changed = []
    let same = 0
    for (const [name, values] of leftIndex) {
      if (!rightIndex.has(name)) continue
      const differences = diffMaps(values, rightIndex.get(name), category)
      if (differences.length) changed.push({ name, differences })
      else same += 1
    }
    return { ...category, onlyLeft, onlyRight, changed: changed.sort((x, y) => x.name.localeCompare(y.name)), same }
  })

  // The domain's own attributes, minus the ones that are meant to differ.
  const domainDifferences = diffMaps(
    flatten({ ...a, ...DOMAIN_CHILDREN }),
    flatten({ ...b, ...DOMAIN_CHILDREN }),
    { catalog: ['domain'] },
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

/** The same two domains measured rather than diffed: how much each one has. */
const resources = computed(() => {
  if (!snapshots.value) return null
  const [a, b] = snapshots.value
  return compareResources(
    resourceProfile(a.config, a.runtime, a.tuning),
    resourceProfile(b.config, b.runtime, b.tuning),
  )
})

/** A side whose running servers could not be read compares configuration only. */
const withoutLiveAmounts = computed(() => {
  if (!snapshots.value) return []
  return [
    [snapshots.value[0], left.value],
    [snapshots.value[1], right.value],
  ]
    .filter(([side]) => !side.runtime)
    .map(([, id]) => nameOf(id))
})

/**
 * Everything one domain contributes to the comparison. The configuration is the
 * part that must succeed; the running JVMs and the self-tuning tree are extras,
 * so a server that is down or a release without `selfTuning` costs those rows
 * rather than the whole page.
 */
async function readSide(connectionId) {
  const [config, runtime, tuning] = await Promise.all([
    wls.configSnapshot({ connectionId }),
    wls.runtimeSnapshot({ connectionId }).catch(() => null),
    wls.tuningSnapshot({ connectionId }).catch(() => null),
  ])
  return { config, runtime, tuning }
}

async function compare() {
  if (!left.value || !right.value || left.value === right.value) return
  loading.value = true
  error.value = null
  try {
    // Each read is pinned to its own connection, so the two never cross.
    snapshots.value = await Promise.all([readSide(left.value), readSide(right.value)])
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
      {
        left: nameOf(left.value),
        right: nameOf(right.value),
        comparedAt: comparedAt.value,
        ...report.value,
        resources: resources.value,
      },
      null,
      2,
    ),
    'application/json;charset=utf-8',
  )
  ui.success(t('Comparison saved'), t('The full difference report has been downloaded as JSON.'))
}

const canCompare = computed(() => left.value && right.value && left.value !== right.value)
const enoughConnections = computed(() => connection.connections.length > 1)
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Compare domains')"
      :subtitle="$t('What differs between two open domains')"
      :last-updated="comparedAt"
      :refreshing="loading"
      :help="
        $t(
          'Reads the configuration of two domains you have open and subtracts one from the other: what exists on one side only, where the same object is set up differently, and how much memory, threads and connections each side is given. Nothing is changed by comparing.',
        )
      "
      @refresh="compare"
    >
      <template #actions>
        <button
          v-if="report"
          class="btn btn-ghost"
          :title="$t('Download the whole comparison as JSON, for a ticket or a review')"
          @click="save"
        >
          {{ $t('Save report') }}
        </button>
      </template>
    </PageHeader>

    <HelpPanel
      id="compare"
      :title="$t('How to use this when something works in one environment and not the other')"
    >
      <ol class="list-decimal space-y-1 pl-4">
        <li>{{ $t('Open both domains — the connection switcher at the top of the sidebar adds a second one.') }}</li>
        <li>{{ $t('Pick them below, left and right, and press Compare.') }}</li>
        <li>
          {{
            $t(
              'Read Only in first: a data source or an application that exists on one side and not the other explains most works-in-test reports on its own.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Then read Resources. It is where "the same application is slower there" usually ends: half the heap, a smaller connection pool, a different garbage collector, a work manager ceiling that only one side has.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'Then read the changed objects. Pool sizes, listen ports, timeouts and targets are where domains drift fastest.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'Heap and metaspace are read from the JVM arguments Node Manager passes to each server, next to what the running JVM reports. A server started from a shell script instead takes its sizes from that script, and then only the running value is the true one.',
          )
        }}
      </p>
      <p>
        {{
          $t(
            'Both sides are read with the credentials of their own connection, so a Monitor account is enough for this page.',
          )
        }}
      </p>
    </HelpPanel>

    <div v-if="!enoughConnections" class="card p-6 text-sm text-zinc-600 dark:text-zinc-300">
      {{
        $t(
          'Comparing needs two domains open at once. Use the connection switcher at the top of the sidebar to connect to a second AdminServer — production and test, say — and this page will compare them.',
        )
      }}
    </div>

    <template v-else>
      <div class="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div class="min-w-48 flex-1">
          <label class="label-row" for="compare-left">
            {{ $t('Left') }}
            <InfoTip
              :heading="$t('Left')"
              :text="
                $t(
                  'The domain treated as the baseline. Differences are described as left versus right; swapping them changes nothing but the reading order.',
                )
              "
            />
          </label>
          <select id="compare-left" v-model="left" class="input">
            <option v-for="entry in connection.connections" :key="entry.id" :value="entry.id">
              {{ entry.name }} — {{ entry.host }}:{{ entry.port }}
            </option>
          </select>
        </div>
        <button class="btn btn-ghost" :title="$t('Swap the two sides')" @click="swap">⇄</button>
        <div class="min-w-48 flex-1">
          <label class="label-row" for="compare-right">
            {{ $t('Right') }}
            <InfoTip :heading="$t('Right')" :text="$t('The domain compared against the baseline.')" />
          </label>
          <select id="compare-right" v-model="right" class="input">
            <option v-for="entry in connection.connections" :key="entry.id" :value="entry.id">
              {{ entry.name }} — {{ entry.host }}:{{ entry.port }}
            </option>
          </select>
        </div>
        <button class="btn btn-primary" :disabled="!canCompare || loading" @click="compare">
          {{ loading ? $t('Reading both domains…') : $t('Compare') }}
        </button>
      </div>

      <p v-if="left === right" class="mb-4 text-sm text-amber-600 dark:text-amber-400">
        {{ $t('Pick two different domains — comparing one with itself has nothing to show.') }}
      </p>

      <ErrorState v-if="error" :error="error" :title="$t('Could not read both domains')" @retry="compare" />

      <template v-else-if="report">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            :label="$t('Only in {domain}', { domain: nameOf(left) })"
            :value="report.totals.onlyLeft"
            :tone="report.totals.onlyLeft ? 'warn' : 'good'"
            :info="$t('Objects that exist on the left and have no counterpart on the right.')"
          />
          <StatCard
            :label="$t('Only in {domain}', { domain: nameOf(right) })"
            :value="report.totals.onlyRight"
            :tone="report.totals.onlyRight ? 'warn' : 'good'"
            :info="$t('Objects that exist on the right and have no counterpart on the left.')"
          />
          <StatCard
            :label="$t('Configured differently')"
            :value="report.totals.changed"
            :tone="report.totals.changed ? 'warn' : 'good'"
            :info="$t('Objects with the same name on both sides but at least one attribute that differs.')"
          />
          <StatCard
            :label="$t('Sized differently')"
            :value="resources ? resources.differing : 0"
            :tone="resources && resources.differing ? 'warn' : 'good'"
            :info="
              $t(
                'Amounts that differ: heap, metaspace, pool sizes, thread ceilings and the totals across the domain. Listed under Resources.',
              )
            "
          />
          <StatCard
            :label="$t('Identical')"
            :value="report.totals.same"
            tone="good"
            :info="$t('Objects that match on every attribute compared.')"
          />
        </div>

        <CompareResources
          v-if="resources"
          :groups="resources.groups"
          :left-name="nameOf(left)"
          :right-name="nameOf(right)"
        />

        <p v-if="withoutLiveAmounts.length" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {{
            $t(
              'The running JVMs of {domains} could not be read, so only its configured amounts are compared. Servers that are down report nothing.',
              { domains: withoutLiveAmounts.join(', ') },
            )
          }}
        </p>

        <section v-if="report.domainDifferences.length" class="card mt-4 p-4">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{ $t('Domain') }}</h2>
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <th class="py-1 pr-3 font-semibold">{{ $t('Attribute') }}</th>
                <th class="py-1 pr-3 font-semibold">{{ nameOf(left) }}</th>
                <th class="py-1 font-semibold">{{ nameOf(right) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="difference in report.domainDifferences" :key="difference.attribute" class="border-t border-zinc-100 dark:border-zinc-800">
                <td class="py-1.5 pr-3">
                  <span v-if="difference.label" class="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-100">
                    {{ difference.label }}
                    <InfoTip v-if="difference.help" :heading="difference.label" :text="difference.help" />
                  </span>
                  <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ difference.attribute }}</span>
                </td>
                <td class="py-1.5 pr-3 break-all">{{ difference.left || '—' }}</td>
                <td class="py-1.5 break-all">{{ difference.right || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div class="mt-4 flex items-center gap-2">
          <label class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <input v-model="showSame" type="checkbox" />
            {{ $t('Also list the sections where everything matches') }}
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
              {{ $t('{count} identical', { count: section.same }) }} ·
              {{ $t('{count} different', { count: section.changed.length }) }} ·
              {{ $t('{count} unmatched', { count: section.onlyLeft.length + section.onlyRight.length }) }}
            </p>
          </div>

          <div v-if="section.onlyLeft.length || section.onlyRight.length" class="mt-3 grid gap-3 sm:grid-cols-2">
            <div v-if="section.onlyLeft.length">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {{ $t('Only in {domain}', { domain: nameOf(left) }) }}
              </p>
              <p class="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{{ section.onlyLeft.join(', ') }}</p>
            </div>
            <div v-if="section.onlyRight.length">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {{ $t('Only in {domain}', { domain: nameOf(right) }) }}
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
                :title="$t('Open this object in the active domain')"
              >
                {{ object.name }}
              </RouterLink>
              <span v-else>{{ object.name }}</span>
            </p>
            <table class="mt-1 w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  <th class="py-1 pr-3 font-semibold">{{ $t('Attribute') }}</th>
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
                  <td class="py-1.5 pr-3">
                    <span v-if="difference.label" class="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-100">
                      {{ difference.label }}
                      <InfoTip v-if="difference.help" :heading="difference.label" :text="difference.help" />
                    </span>
                    <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{{ difference.attribute }}</span>
                  </td>
                  <td class="py-1.5 pr-3 break-all">
                    {{ difference.left || '—' }}
                    <span v-if="difference.left && difference.unit" class="text-xs text-zinc-400 dark:text-zinc-500">{{ difference.unit }}</span>
                  </td>
                  <td class="py-1.5 break-all">
                    {{ difference.right || '—' }}
                    <span v-if="difference.right && difference.unit" class="text-xs text-zinc-400 dark:text-zinc-500">{{ difference.unit }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-if="!section.onlyLeft.length && !section.onlyRight.length && !section.changed.length"
            class="mt-2 text-sm text-zinc-500 dark:text-zinc-400"
          >
            {{ $t('Everything matches.') }}
          </p>
        </section>
      </template>

      <div v-else-if="!loading" class="card p-6 text-sm text-zinc-500 dark:text-zinc-400">
        {{
          $t(
            'Pick two domains and press Compare. Both are read with their own credentials; nothing is written to either.',
          )
        }}
      </div>
    </template>
  </div>
</template>
