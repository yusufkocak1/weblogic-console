<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * Small "i" affordance that explains a label, metric or field in place.
 *
 * The bubble is teleported to the body and positioned with fixed coordinates so
 * it is never clipped by the scrolling table wrappers and card overflows it
 * usually sits inside.
 */
const props = defineProps({
  text: { type: String, default: '' },
  heading: { type: String, default: '' },
  /** Empty falls back to a translated default at render time. */
  label: { type: String, default: '' },
  width: { type: Number, default: 268 },
  tone: { type: String, default: 'muted' }, // muted | accent | warn
})

const ui = useUiStore()

const trigger = ref(null)
const bubble = ref(null)
const open = ref(false)
const position = ref({ top: '0px', left: '0px', width: '268px' })
let closeTimer = null

const TONES = {
  muted: 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
  accent: 'text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300',
  warn: 'text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300',
}

const MARGIN = 8

async function place() {
  await nextTick()
  const anchor = trigger.value?.getBoundingClientRect()
  if (!anchor) return
  const height = bubble.value?.getBoundingClientRect().height ?? 0

  // Prefer above the trigger, flip below when the top would be cut off.
  let top = anchor.top - height - MARGIN
  if (top < MARGIN) top = anchor.bottom + MARGIN
  top = Math.min(top, window.innerHeight - height - MARGIN)

  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width / 2 - props.width / 2),
    window.innerWidth - props.width - MARGIN,
  )

  position.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, width: `${props.width}px` }
}

function onDismissEvent() {
  hide()
}

function show() {
  clearTimeout(closeTimer)
  if (open.value) return
  open.value = true
  place()
  // A tooltip that scrolls away from its anchor is worse than no tooltip.
  window.addEventListener('scroll', onDismissEvent, true)
  window.addEventListener('resize', onDismissEvent)
}

function hide() {
  clearTimeout(closeTimer)
  if (!open.value) return
  open.value = false
  window.removeEventListener('scroll', onDismissEvent, true)
  window.removeEventListener('resize', onDismissEvent)
}

/** Leaving the trigger keeps the bubble alive briefly so it can be moused into. */
function scheduleHide() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(hide, 120)
}

function toggle() {
  if (open.value) hide()
  else show()
}

onBeforeUnmount(hide)
</script>

<template>
  <span v-if="ui.helpVisible" class="relative inline-flex align-middle">
    <button
      ref="trigger"
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      :class="TONES[tone] || TONES.muted"
      :aria-label="label || $t('What is this?')"
      :aria-expanded="open"
      @click.stop.prevent="toggle"
      @mousedown.prevent
      @mouseenter="show"
      @mouseleave="scheduleHide"
      @focus="show"
      @blur="hide"
      @keydown.esc="hide"
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5v.01" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="translate-y-0.5 opacity-0"
        leave-active-class="transition duration-75 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          ref="bubble"
          role="tooltip"
          :style="position"
          class="fixed z-50 rounded-lg border border-zinc-200 bg-white p-2.5 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          @mouseenter="show"
          @mouseleave="scheduleHide"
        >
          <p v-if="heading" class="mb-1 text-xs font-semibold text-zinc-900 dark:text-zinc-50">{{ heading }}</p>
          <p class="whitespace-normal text-xs font-normal leading-relaxed text-zinc-600 dark:text-zinc-300">
            <slot>{{ text }}</slot>
          </p>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>
