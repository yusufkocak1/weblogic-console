<script setup>
import { computed, ref } from 'vue'
import { formatAmount } from '@/utils/resources'
import InfoTip from '@/components/InfoTip.vue'

/**
 * The amounts side of a domain comparison: memory, threads, connections.
 *
 * Kept apart from the attribute diff because it answers a different question.
 * The attribute diff says "these two are set differently"; this says how much
 * each side has, in units a person can act on — 2 GB against 4 GB, with the
 * difference already worked out.
 */
const props = defineProps({
  /** Groups as `compareResources` returns them. */
  groups: { type: Array, default: () => [] },
  leftName: { type: String, default: '' },
  rightName: { type: String, default: '' },
})

/** Off by default: on a real domain the matching rows outnumber the rest. */
const showSame = ref(false)

const visible = computed(() =>
  props.groups
    .map((group) => ({
      ...group,
      objects: group.objects
        .map((object) => ({ ...object, visibleRows: object.rows.filter((row) => showSame.value || !row.same) }))
        .filter((object) => object.visibleRows.length),
    }))
    .filter((group) => group.objects.length),
)

const differing = computed(() =>
  props.groups.reduce((total, group) => total + group.objects.reduce((sub, object) => sub + object.differing, 0), 0),
)
</script>

<template>
  <section class="card mt-4 p-4">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {{ $t('Resources') }}
        <InfoTip
          :heading="$t('Resources')"
          :text="
            $t(
              'How much each domain is given: heap and metaspace from the JVM command line, connection pool sizes, work manager ceilings, and what the running JVMs report. Sizes are normalised before they are compared, so -Xmx2g and -Xmx2048m count as the same heap.',
            )
          "
        />
      </h2>
      <div class="flex items-center gap-3">
        <p class="text-xs text-zinc-400 dark:text-zinc-500">
          {{ $t('{count} amounts differ', { count: differing }) }}
        </p>
        <label class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <input v-model="showSame" type="checkbox" />
          {{ $t('Show matching amounts too') }}
        </label>
      </div>
    </div>

    <p v-if="!visible.length" class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('Both domains are sized the same on every amount compared.') }}
    </p>

    <div v-for="group in visible" :key="group.key" class="mt-5">
      <h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {{ group.label }}
        <InfoTip v-if="group.hint" :heading="group.label" :text="group.hint" />
      </h3>

      <div v-for="object in group.objects" :key="object.name" class="mt-2 overflow-x-auto">
        <p v-if="object.name" class="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          <RouterLink
            v-if="group.route"
            :to="{ name: group.route, params: { name: object.name } }"
            class="text-indigo-600 hover:underline dark:text-indigo-400"
            :title="$t('Open this object in the active domain')"
          >
            {{ object.name }}
          </RouterLink>
          <span v-else>{{ object.name }}</span>
          <span
            v-if="object.onlyLeft || object.onlyRight"
            class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25"
          >
            {{ $t('Only in {domain}', { domain: object.onlyLeft ? leftName : rightName }) }}
          </span>
        </p>

        <table class="mt-1 w-full min-w-96 text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <th class="py-1 pr-3 font-semibold">{{ $t('Amount') }}</th>
              <th class="py-1 pr-3 text-right font-semibold">{{ leftName }}</th>
              <th class="py-1 pr-3 text-right font-semibold">{{ rightName }}</th>
              <th class="py-1 text-right font-semibold">{{ $t('Change') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in object.visibleRows"
              :key="row.key"
              class="border-t border-zinc-100 dark:border-zinc-800"
              :class="row.same && 'text-zinc-400 dark:text-zinc-500'"
            >
              <td class="py-1.5 pr-3">
                <span class="inline-flex items-center gap-1.5">
                  {{ row.label }}
                  <InfoTip v-if="row.help" :heading="row.label" :text="row.help" />
                </span>
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums" :class="!row.same && 'font-medium'">
                {{ formatAmount(row.kind, row.left) }}
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums" :class="!row.same && 'font-medium'">
                {{ formatAmount(row.kind, row.right) }}
              </td>
              <td class="py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{{ row.delta || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
