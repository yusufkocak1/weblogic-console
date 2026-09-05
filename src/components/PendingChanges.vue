<script setup>
import { computed, ref } from 'vue'
import { useChangesStore } from '@/stores/changes'
import { useConnectionStore } from '@/stores/connection'
import InfoTip from '@/components/InfoTip.vue'

/**
 * The state of the domain's configuration lock, in one bar.
 *
 * WebLogic stages configuration changes: they are written into a pending set
 * under a domain-wide lock and only become real when they are activated. That
 * is the single most surprising thing about editing a WebLogic domain, so it
 * gets a permanent place on the page rather than a dialog that appears once.
 */
const changes = useChangesStore()
const connection = useConnectionStore()

defineEmits(['activate', 'discard'])

const showList = ref(false)

/** The lock is domain-wide, so it may well belong to somebody else. */
const heldByOther = computed(
  () => changes.locked && changes.lockOwner && changes.lockOwner !== connection.username,
)

const count = computed(() => changes.pending.length)
</script>

<template>
  <!-- Nothing to say about a lock this user is not allowed to reach. -->
  <section v-if="changes.loaded && !changes.forbidden" class="mb-4">
    <!-- Someone else has the lock: nothing here can be saved until they finish. -->
    <div
      v-if="heldByOther"
      class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/5"
    >
      <p class="text-sm font-medium text-red-900 dark:text-red-200">
        {{ $t('{owner} is editing this domain right now', { owner: changes.lockOwner }) }}
      </p>
      <p class="mt-1 text-sm text-red-900/80 dark:text-red-200/80">
        {{
          $t(
            'WebLogic allows one editor at a time. You can read every setting on this page, but saving will be refused until they activate or discard their changes.',
          )
        }}
      </p>
    </div>

    <!-- Our own staged changes: saved on the AdminServer, but not yet live. -->
    <div
      v-else-if="changes.hasChanges"
      class="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/30">
          <svg class="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 8v5M12 16v.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
          {{ $t('Saved, but not live yet') }}
          <InfoTip
            :heading="$t('Why two steps?')"
            :text="
              $t(
                'WebLogic writes your changes into a pending set first. The domain keeps running with its old values until you activate them, so a half-finished set of edits never reaches a live server.',
              )
            "
            :label="$t('Why changes have to be activated')"
            tone="warn"
          />
        </p>

        <div class="ml-auto flex items-center gap-2">
          <button
            class="btn btn-ghost"
            :disabled="Boolean(changes.busy)"
            :title="
              $t(
                'Throw the pending changes away and release the configuration lock. The domain keeps the values it is running with.',
              )
            "
            @click="$emit('discard')"
          >
            {{ changes.busy === 'discarding' ? $t('Discarding…') : $t('Discard') }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="Boolean(changes.busy)"
            :title="$t('Apply every pending change to the domain now.')"
            @click="$emit('activate')"
          >
            {{ changes.busy === 'activating' ? $t('Activating…') : $t('Activate changes') }}
          </button>
        </div>
      </div>

      <p class="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
        <template v-if="changes.pendingKnown && count">
          {{ count === 1 ? $t('1 change is waiting.') : $t('{count} changes are waiting.', { count }) }}
        </template>
        <template v-else>{{ $t('Changes are waiting.') }}</template>
        {{ $t('Activate them to apply them to the running domain, or discard them to leave the domain as it is.') }}
      </p>

      <p v-if="changes.mergeNeeded" class="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
        {{
          $t(
            'The configuration on disk changed while these edits were open, so WebLogic will merge them on activation.',
          )
        }}
      </p>

      <template v-if="changes.pendingKnown && count">
        <button
          class="mt-2 text-xs font-medium text-amber-800 underline underline-offset-2 dark:text-amber-300"
          @click="showList = !showList"
        >
          {{ showList ? $t('Hide what is waiting') : $t('Show what is waiting') }}
        </button>
        <ul v-if="showList" class="mt-2 space-y-1">
          <li
            v-for="(change, index) in changes.pending"
            :key="index"
            class="rounded-lg bg-amber-100/70 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <span class="font-medium">{{ change.text }}</span>
            <span v-if="change.detail" class="ml-1 font-mono opacity-80">{{ change.detail }}</span>
          </li>
        </ul>
      </template>
    </div>

    <!-- The lock is held with nothing in it: normal right after activating. -->
    <div
      v-else-if="changes.locked"
      class="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <span>{{ $t('You hold the configuration lock, but nothing is waiting to be activated.') }}</span>
      <button
        class="btn btn-ghost ml-auto"
        :disabled="Boolean(changes.busy)"
        :title="$t('Release the configuration lock so another operator can edit the domain.')"
        @click="$emit('discard')"
      >
        {{ $t('Release the lock') }}
      </button>
    </div>

    <!-- Idle: say what will happen, so the two-step model is no surprise later. -->
    <p v-else class="text-sm text-zinc-500 dark:text-zinc-400">
      {{ $t('Nothing is waiting to be activated — every value below is what the domain is running with.') }}
      <span class="text-zinc-400 dark:text-zinc-500">
        {{ $t('Changes you save are held here first, and only reach the domain when you activate them.') }}
      </span>
    </p>
  </section>
</template>
