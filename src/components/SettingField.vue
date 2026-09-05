<script setup>
import { computed } from 'vue'
import { impacts } from '@/settings/catalog'
import InfoTip from '@/components/InfoTip.vue'
import { t } from '@/i18n'

/**
 * One configurable attribute: what it is called in plain language, what it
 * does, what it is set to now, and when a new value would take effect.
 *
 * The explanation sits under the input rather than behind a tooltip on
 * purpose — this page exists so that nobody has to keep the WebLogic MBean
 * reference open in another tab.
 */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Number, Boolean], default: '' },
  /** The value the AdminServer reported, used to show what would change. */
  original: { type: [String, Number, Boolean], default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const impact = computed(() => (props.field.readonly ? null : impacts()[props.field.impact] || null))

const changed = computed(() => !props.field.readonly && String(props.modelValue ?? '') !== String(props.original ?? ''))

const IMPACT_TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
}

/** A value the AdminServer returned that is not in our option list still has to be selectable. */
const options = computed(() => {
  const list = props.field.options || []
  const current = props.modelValue
  if (current === null || current === '' || list.some((o) => o.value === current)) return list
  return [{ value: current, label: t('{value} — current value', { value: current }) }, ...list]
})

const display = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? t('On') : t('Off')
  return String(value)
}

const inputClass = computed(() => [
  'input',
  props.field.mono && 'font-mono text-xs',
  changed.value && 'border-amber-400 ring-1 ring-amber-400 dark:border-amber-500 dark:ring-amber-500',
])
</script>

<template>
  <div class="min-w-0">
    <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <label :for="`f-${field.attr}`" class="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {{ field.label }}
      </label>

      <span
        v-if="impact"
        :class="['rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset', IMPACT_TONES[impact.tone]]"
      >
        {{ impact.label }}
      </span>
      <InfoTip
        v-if="impact"
        :heading="impact.label"
        :text="impact.help"
        :label="$t('When this change takes effect')"
      />

      <span
        v-if="field.readonly"
        class="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400"
      >
        {{ $t('Read-only') }}
      </span>

      <span
        v-if="changed"
        class="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
      >
        {{ $t('Edited') }}
      </span>
    </div>

    <!-- Read-only values are shown as text: an input you cannot use is a lie. -->
    <p
      v-if="field.readonly"
      :class="[
        'rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300',
        field.mono && 'break-all font-mono text-xs',
      ]"
    >
      {{ display(modelValue) }}
    </p>

    <!-- Booleans read as a word, not as a lone tick box. -->
    <button
      v-else-if="field.type === 'boolean'"
      :id="`f-${field.attr}`"
      type="button"
      role="switch"
      :aria-checked="modelValue === true"
      :disabled="disabled"
      :class="[
        'flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        changed
          ? 'border-amber-400 ring-1 ring-amber-400 dark:border-amber-500 dark:ring-amber-500'
          : 'border-zinc-300 dark:border-zinc-700',
        'bg-white dark:bg-zinc-950',
      ]"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        :class="[
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          modelValue ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700',
        ]"
      >
        <span
          :class="[
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            modelValue ? 'left-3.5' : 'left-0.5',
          ]"
        />
      </span>
      <span class="font-medium text-zinc-800 dark:text-zinc-100">
        {{ modelValue ? $t('On') : $t('Off') }}
      </span>
    </button>

    <select
      v-else-if="field.type === 'select'"
      :id="`f-${field.attr}`"
      :class="inputClass"
      :value="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
    </select>

    <textarea
      v-else-if="field.type === 'textarea'"
      :id="`f-${field.attr}`"
      rows="2"
      :class="inputClass"
      :value="modelValue"
      :placeholder="field.placeholder"
      :disabled="disabled"
      @input="emit('update:modelValue', $event.target.value)"
    />

    <div v-else class="relative">
      <input
        :id="`f-${field.attr}`"
        :type="field.type === 'number' ? 'number' : 'text'"
        :class="[inputClass, field.unit && 'pr-16']"
        :value="modelValue"
        :min="field.min"
        :max="field.max"
        :placeholder="field.placeholder"
        :disabled="disabled"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <span
        v-if="field.unit"
        class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400 dark:text-zinc-500"
      >
        {{ field.unit }}
      </span>
    </div>

    <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ field.help }}</p>

    <p class="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-400 dark:text-zinc-500">
      <span class="font-mono">{{ field.attr }}</span>
      <span v-if="changed" class="font-medium text-amber-600 dark:text-amber-400">
        {{ $t('currently {value} on the AdminServer', { value: display(original) }) }}
      </span>
    </p>
  </div>
</template>
