<script setup>
import { computed } from 'vue'
import { healthOf } from '@/utils/format'
import { t } from '@/i18n'

const props = defineProps({
  state: { type: String, default: '' },
  health: { type: [String, Object], default: null },
  kind: { type: String, default: 'state' }, // 'state' | 'health'
})

const STATE_TONES = {
  RUNNING: 'emerald',
  ACTIVE: 'emerald',
  ADMIN: 'amber',
  STANDBY: 'amber',
  PREPARED: 'amber',
  DISTRIBUTED: 'amber',
  NEW: 'zinc',
  RETIRED: 'zinc',
  NONEXISTENT: 'zinc',
  UPDATE_PENDING: 'sky',
  STARTING: 'sky',
  RESUMING: 'sky',
  SUSPENDING: 'amber',
  SHUTTING_DOWN: 'amber',
  SHUTDOWN: 'zinc',
  UNKNOWN: 'zinc',
  FAILED: 'red',
  FAILED_NOT_RESTARTABLE: 'red',
  FORCE_SUSPENDING: 'amber',
}

const HEALTH_TONES = {
  OK: 'emerald',
  WARN: 'amber',
  CRITICAL: 'red',
  FAILED: 'red',
  OVERLOADED: 'red',
  UNKNOWN: 'zinc',
}

const TONE_CLASSES = {
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber: 'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  sky: 'bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  red: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-400 dark:ring-zinc-500/30',
}

/**
 * Plain-language meaning of each badge, shown on hover. Built on each lookup so
 * the text follows a language change; the state names themselves are WebLogic's
 * and stay as they are.
 */
const stateDescriptions = () => ({
  RUNNING: t('Serving application traffic normally.'),
  ACTIVE: t('Deployed and serving requests.'),
  PREPARED: t('Deployed and loaded on its targets, but not serving requests yet. Start it to make it active.'),
  DISTRIBUTED: t('The archive has reached its targets but has not been prepared or started there.'),
  NEW: t('Configured in the domain but not distributed to any target yet.'),
  RETIRED: t('A newer version took over. This one still finishes the sessions it already had, so it may show running instances — it is not serving new requests.'),
  NONEXISTENT: t('WebLogic knows no deployment by this name on its targets.'),
  UPDATE_PENDING: t('A deployment change is being applied. The state settles once it finishes.'),
  ADMIN: t('Started, but only administration requests are accepted — application traffic is refused. Resume to bring it back.'),
  STANDBY: t('Started and listening on the administration port only. It holds no application work yet.'),
  STARTING: t('Booting. It moves to RUNNING on its own if startup succeeds.'),
  RESUMING: t('Coming back from ADMIN or STANDBY into RUNNING.'),
  SUSPENDING: t('Finishing in-flight work before moving to ADMIN.'),
  FORCE_SUSPENDING: t('Moving to ADMIN without waiting for in-flight work to finish.'),
  SHUTTING_DOWN: t('Stopping gracefully. In-flight requests are allowed to complete.'),
  SUSPENDED: t('Present but not handing out work — a data source in this state refuses connections.'),
  OVERLOADED: t('Beyond its configured limits and refusing further work.'),
  SHUTDOWN: t('Stopped. Starting it needs a running Node Manager on its machine.'),
  FAILED: t('The server started but could not reach a usable state. Check the log for the first error.'),
  FAILED_NOT_RESTARTABLE: t('Failed and will not restart itself. It has to be started deliberately.'),
  UNKNOWN: t('No state was reported when asked — for a server that usually means it is unreachable.'),
})

const healthDescriptions = () => ({
  OK: t('Reporting itself healthy.'),
  WARN: t('Working, but reporting a problem — worth reading the log.'),
  CRITICAL: t('A subsystem has failed. Traffic is likely affected.'),
  FAILED: t('The component has failed and is not serving.'),
  OVERLOADED: t('Refusing work because it is beyond its configured limits.'),
  UNKNOWN: t('No health was reported. Normal for a component that is not running.'),
})

const label = computed(() => {
  if (props.kind === 'health') return healthOf(props.health)
  return (props.state || 'UNKNOWN').toUpperCase()
})

const tone = computed(() => {
  const table = props.kind === 'health' ? HEALTH_TONES : STATE_TONES
  return TONE_CLASSES[table[label.value] || 'zinc']
})

const description = computed(() => {
  const table = props.kind === 'health' ? healthDescriptions() : stateDescriptions()
  const readable = label.value.replaceAll('_', ' ')
  const text = table[label.value]
  return text ? `${readable} — ${text}` : readable
})

const pulsing = computed(() => ['STARTING', 'RESUMING', 'SHUTTING_DOWN', 'SUSPENDING'].includes(label.value))
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tone]"
    :title="description"
  >
    <span :class="['h-1.5 w-1.5 rounded-full bg-current', pulsing && 'animate-pulse']" />
    {{ label.replaceAll('_', ' ') }}
  </span>
</template>
