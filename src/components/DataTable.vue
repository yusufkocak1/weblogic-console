<script setup>
import { computed, reactive, ref } from 'vue'
import ErrorState from '@/components/ErrorState.vue'
import InfoTip from '@/components/InfoTip.vue'
import { useUrlState } from '@/composables/useUrlState'
import { downloadCsv, downloadJson } from '@/utils/export'

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key, label, align, sortable, width, hint }]
  rows: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'name' },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  /** Empty falls back to a translated default at render time. */
  emptyText: { type: String, default: '' },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: '' },
  /** Explains what the filter box matches on this particular table. */
  searchHint: { type: String, default: '' },
  dense: { type: Boolean, default: false },
  /**
   * Puts the filter and the sort in the page's URL under this name, so the
   * view can be linked to, reloaded and stepped back through. 'main' owns the
   * plain q/sort/dir parameters; any other name prefixes its own.
   */
  stateKey: { type: String, default: '' },
  /** Adds a checkbox column and drives `selected`. */
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  /** Base file name for the CSV / JSON buttons. Empty hides them. */
  exportName: { type: String, default: '' },
  /**
   * Dropdowns beside the filter box, for the columns an operator picks from
   * rather than types into — state, target, cluster.
   *
   *   { key, label, hint?, allLabel?, options?, value?, format? }
   *
   * `value(row)` returns what the row should match on: one value, or an array
   * when a row belongs to several of them (its targets). Without it the row's
   * column of the same key is used. `options` fixes the list and its order;
   * without it the values present in the loaded rows are offered, sorted.
   */
  filters: { type: Array, default: () => [] },
})

const emit = defineEmits(['retry', 'update:selected'])

const query = ref('')
const sortKey = ref('')
const sortDir = ref('asc')

/** Filter key -> the chosen value; '' means "all", and is what the URL leaves out. */
const chosen = reactive(Object.fromEntries(props.filters.map((filter) => [filter.key, ''])))

const anyFilter = computed(() => props.filters.some((filter) => chosen[filter.key]))

function clearFilters() {
  for (const filter of props.filters) chosen[filter.key] = ''
}

if (props.stateKey) {
  const name = (suffix) => (props.stateKey === 'main' ? suffix : `${props.stateKey}_${suffix}`)
  const refs = { [name('q')]: query, [name('sort')]: sortKey, [name('dir')]: sortDir }
  const defaults = { [name('q')]: '', [name('sort')]: '', [name('dir')]: 'asc' }
  // A chosen state or target belongs in the URL for the same reason the search
  // text does: "the stopped applications on ms2" should be a link.
  for (const filter of props.filters) {
    refs[name(filter.key)] = computed({
      get: () => chosen[filter.key] ?? '',
      set: (value) => {
        chosen[filter.key] = value
      },
    })
    defaults[name(filter.key)] = ''
  }
  useUrlState(refs, defaults)
}

function keyOf(row, index) {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  return row?.[props.rowKey] ?? index
}

function toggleSort(column) {
  if (column.sortable === false) return
  if (sortKey.value === column.key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = column.key
    sortDir.value = 'asc'
  }
}

/** What a row matches on for one filter, always as a list of strings. */
function valuesOf(filter, row) {
  const raw = filter.value ? filter.value(row) : row?.[filter.key]
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter((value) => value !== null && value !== undefined && value !== '').map(String)
}

/**
 * The options one dropdown offers. A value that has gone from the rows but is
 * still chosen stays on the list — otherwise the select would go blank while
 * quietly hiding every row.
 */
function optionsFor(filter) {
  const label = (value) => (filter.format ? filter.format(value) : value)
  const seen = new Map()
  if (filter.options) {
    for (const option of filter.options) {
      const value = String(typeof option === 'object' ? option.value : option)
      seen.set(value, { value, label: typeof option === 'object' ? option.label : label(value) })
    }
  } else {
    for (const row of props.rows) {
      for (const value of valuesOf(filter, row)) if (!seen.has(value)) seen.set(value, { value, label: label(value) })
    }
  }
  const current = chosen[filter.key]
  if (current && !seen.has(current)) seen.set(current, { value: current, label: label(current) })
  const list = [...seen.values()]
  // An explicit list is already in the order the view meant it to be read in.
  if (filter.options) return list
  return list.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }))
}

/** The dropdowns narrow the rows first; the search box runs over what is left. */
const chosenRows = computed(() => {
  const active = props.filters.filter((filter) => chosen[filter.key])
  if (!active.length) return props.rows
  return props.rows.filter((row) => active.every((filter) => valuesOf(filter, row).includes(chosen[filter.key])))
})

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return chosenRows.value
  return chosenRows.value.filter((row) =>
    props.columns.some((column) => {
      const value = row?.[column.key]
      return value !== null && value !== undefined && String(value).toLowerCase().includes(needle)
    }),
  )
})

const sorted = computed(() => {
  if (!sortKey.value) return filtered.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const av = a?.[sortKey.value]
    const bv = b?.[sortKey.value]
    if (av === bv) return 0
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
  })
})

const alignClass = (column) =>
  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'

// ------------------------------------------------------------------ selection

/**
 * Selection is by row key, and only over the rows the filter is showing:
 * "select all" on a filtered table has to mean what it looks like it means.
 */
const selectedSet = computed(() => new Set(props.selected))

const visibleKeys = computed(() => sorted.value.map((row, index) => keyOf(row, index)))

const allSelected = computed(
  () => visibleKeys.value.length > 0 && visibleKeys.value.every((key) => selectedSet.value.has(key)),
)

const someSelected = computed(
  () => !allSelected.value && visibleKeys.value.some((key) => selectedSet.value.has(key)),
)

function toggleRow(row, index) {
  const key = keyOf(row, index)
  const next = new Set(props.selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  emit('update:selected', [...next])
}

function toggleAll() {
  if (allSelected.value) {
    const visible = new Set(visibleKeys.value)
    emit('update:selected', props.selected.filter((key) => !visible.has(key)))
  } else {
    emit('update:selected', [...new Set([...props.selected, ...visibleKeys.value])])
  }
}

// --------------------------------------------------------------------- export

/** What is on screen, in the order it is on screen — filter and sort included. */
const exportColumns = computed(() => props.columns.filter((column) => column.key !== 'actions' && column.label))

const saveCsv = () => downloadCsv(props.exportName, exportColumns.value, sorted.value)
const saveJson = () => downloadJson(props.exportName, exportColumns.value, sorted.value)
</script>

<template>
  <div class="card overflow-hidden">
    <div
      v-if="searchable || exportName || $slots.toolbar"
      class="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800"
    >
      <div v-if="searchable" class="relative max-w-xs flex-1">
        <input
          v-model="query"
          class="input pl-8 pr-8"
          :placeholder="searchPlaceholder || $t('Filter…')"
          type="search"
        />
        <span class="absolute right-2.5 top-2">
          <InfoTip
            :heading="$t('Filter')"
            :text="
              searchHint ||
              $t(
                'Type to keep only the rows containing this text. It matches every column shown here and filters the rows already loaded — it does not query the server.',
              )
            "
            :label="$t('How the filter box works')"
          />
        </span>
        <svg
          class="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-zinc-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <div v-for="filter in filters" :key="filter.key" class="flex items-center gap-1">
        <select
          v-model="chosen[filter.key]"
          class="max-w-[14rem] rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700
                 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          :aria-label="$t('Filter by {label}', { label: filter.label })"
          :title="$t('Show only the rows with this {label}', { label: filter.label })"
        >
          <option value="">{{ filter.allLabel || $t('Any {label}', { label: filter.label }) }}</option>
          <option v-for="option in optionsFor(filter)" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <InfoTip
          v-if="filter.hint"
          :heading="filter.label"
          :text="filter.hint"
          :label="$t('What the {label} filter does', { label: filter.label })"
        />
      </div>

      <button
        v-if="anyFilter"
        class="btn btn-ghost px-2 py-1 text-xs"
        :title="$t('Drop every dropdown filter and show all the rows again')"
        @click="clearFilters"
      >
        {{ $t('Clear filters') }}
      </button>

      <slot name="toolbar" :rows="sorted" />

      <div v-if="exportName" class="flex items-center gap-1">
        <button
          class="btn btn-ghost px-2 py-1 text-xs"
          :title="$t('Save the rows shown here as a CSV file — the filter and sort you have applied are kept')"
          @click="saveCsv"
        >
          CSV
        </button>
        <button
          class="btn btn-ghost px-2 py-1 text-xs"
          :title="$t('Save the rows shown here as JSON, for a script or a diff')"
          @click="saveJson"
        >
          JSON
        </button>
      </div>

      <span class="ml-auto text-xs text-zinc-400 dark:text-zinc-500" :title="$t('Rows shown / rows loaded')">
        {{ sorted.length }}<template v-if="sorted.length !== rows.length"> / {{ rows.length }}</template>
      </span>
    </div>

    <ErrorState v-if="error" :error="error" class="m-4" @retry="emit('retry')" />

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60">
            <th v-if="selectable" class="w-9 px-3 py-2">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                :aria-label="allSelected ? $t('Clear the selection') : $t('Select every row shown')"
                :title="allSelected ? $t('Clear the selection') : $t('Select every row the filter is showing')"
                @change="toggleAll"
              />
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :style="column.width ? { width: column.width } : null"
              :class="[
                'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
                alignClass(column),
                column.sortable !== false && 'cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200',
              ]"
              :title="
                column.sortable !== false && !column.hint
                  ? $t('Click to sort by {column}', { column: column.label })
                  : null
              "
              @click="toggleSort(column)"
            >
              <span class="inline-flex items-center gap-1">
                {{ column.label }}
                <InfoTip
                  v-if="column.hint"
                  :heading="column.label"
                  :text="column.hint"
                  :label="$t('What the {column} column shows', { column: column.label })"
                />
              </span>
              <span v-if="sortKey === column.key" class="ml-0.5 text-[10px]">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length">
            <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-3 py-10 text-center text-sm text-zinc-400">
              {{ $t('Loading…') }}
            </td>
          </tr>
          <tr v-else-if="!sorted.length">
            <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-3 py-10 text-center text-sm text-zinc-400">
              {{ query || anyFilter ? $t('No rows match this filter.') : emptyText || $t('Nothing to show.') }}
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="(row, index) in sorted"
              :key="keyOf(row, index)"
              :class="[
                'border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40',
                selectable && selectedSet.has(keyOf(row, index)) && 'bg-indigo-50/60 dark:bg-indigo-500/10',
              ]"
            >
              <td v-if="selectable" class="px-3 align-middle">
                <input
                  type="checkbox"
                  :checked="selectedSet.has(keyOf(row, index))"
                  :aria-label="$t('Select {name}', { name: keyOf(row, index) })"
                  @change="toggleRow(row, index)"
                />
              </td>
              <td
                v-for="column in columns"
                :key="column.key"
                :class="['px-3 align-middle', dense ? 'py-1.5' : 'py-2.5', alignClass(column), column.class]"
              >
                <slot :name="`cell:${column.key}`" :row="row" :value="row?.[column.key]">
                  {{ row?.[column.key] ?? '—' }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
