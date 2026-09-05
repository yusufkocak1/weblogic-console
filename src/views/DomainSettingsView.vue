<script setup>
import { computed } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useConnectionStore } from '@/stores/connection'
import PageHeader from '@/components/PageHeader.vue'
import FactList from '@/components/FactList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { t } from '@/i18n'

/**
 * The domain itself: the settings that have no single server, cluster or
 * application to belong to. Reached from the Dashboard rather than from the
 * navigation, because it is the whole domain's own page.
 */
const connection = useConnectionStore()

const { data, refreshing, lastUpdated, reload } = useResource(({ signal }) => wls.domainSummary({ signal }))

const facts = computed(() => [
  { label: t('Domain'), value: data.value?.name || connection.domainName },
  {
    label: t('Mode'),
    value: data.value?.productionModeEnabled ? t('Production') : t('Development'),
    hint: t(
      'Production mode requires the configuration lock for every change and turns off auto-deployment. Changing it needs every server in the domain restarted.',
    ),
  },
  { label: t('AdminServer'), value: data.value?.adminServerName || '—' },
  {
    label: t('Configuration version'),
    value: data.value?.configurationVersion || '—',
    hint: t('The WebLogic version this domain’s configuration was written for.'),
  },
  { label: t('Domain directory'), value: data.value?.rootDirectory || '—', mono: true },
  { label: t('Connected as'), value: connection.username },
])
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Domain settings')"
      :subtitle="$t('Settings that apply to the whole domain')"
      :back="{ name: 'dashboard' }"
      :back-label="$t('Dashboard')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'The domain-wide switches: the administration port, change auditing, and the combined domain log that every server broadcasts into.',
        )
      "
      @refresh="reload"
    />

    <div class="card mb-4 p-4">
      <FactList :facts="facts" />
    </div>

    <SettingsPanel :sections="['domain']" />
  </div>
</template>
