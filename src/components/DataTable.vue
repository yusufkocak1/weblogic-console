<script setup>
import { computed, ref } from 'vue'
import ErrorState from '@/components/ErrorState.vue'

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key, label, align, sortable, width }]
  rows: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'name' },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  emptyText: { type: String, default: 'Nothing to show.' },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Filter…' },
  dense: { type: Boolean, default: false },
})

const emit = defineEmits(['retry'])

const query = ref('')
const sortKey = ref(null)
const sortDir = ref('asc')

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

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.rows
  return props.rows.filter((row) =>
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
</script>

<template>
  <div class="card overflow-hidden">
    <div v-if="searchable || $slots.toolbar" class="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
      <div v-if="searchable" class="relative max-w-xs flex-1">
        <input v-model="query" class="input pl-8" :placeholder="searchPlaceholder" type="search" />
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
      <slot name="toolbar" />
      <span class="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
        {{ sorted.length }}<template v-if="sorted.length !== rows.length"> / {{ rows.length }}</template>
      </span>
    </div>

    <ErrorState v-if="error" :error="error" class="m-4" @retry="emit('retry')" />

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60">
            <th
              v-for="column in columns"
              :key="column.key"
              :style="column.width ? { width: column.width } : null"
              :class="[
                'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
                alignClass(column),
                column.sortable !== false && 'cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200',
              ]"
              @click="toggleSort(column)"
            >
              {{ column.label }}
              <span v-if="sortKey === column.key" class="ml-0.5 text-[10px]">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length">
            <td :colspan="columns.length" class="px-3 py-10 text-center text-sm text-zinc-400">Loading…</td>
          </tr>
          <tr v-else-if="!sorted.length">
            <td :colspan="columns.length" class="px-3 py-10 text-center text-sm text-zinc-400">
              {{ query ? 'No rows match this filter.' : emptyText }}
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="(row, index) in sorted"
              :key="keyOf(row, index)"
              class="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40"
            >
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
