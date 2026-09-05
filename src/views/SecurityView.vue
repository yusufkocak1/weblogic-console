<script setup>
import { computed, ref, watch } from 'vue'
import * as wls from '@/api/weblogic'
import { useResource } from '@/composables/useResource'
import { useConnectionStore } from '@/stores/connection'
import { items } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import DataTable from '@/components/DataTable.vue'
import FactList from '@/components/FactList.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import ErrorState from '@/components/ErrorState.vue'
import { t } from '@/i18n'

/**
 * The security realm, read-only.
 *
 * "Who can log in, and through what" is a question every operator eventually
 * has to answer, and the answer normally means opening another tool. This page
 * shows the realm, the providers that authenticate against it in the order they
 * are consulted, and the users and groups a provider holds.
 *
 * Nothing here changes anything: creating users and editing role mappings is
 * deliberately left to WLST and the Remote Console, where an audit trail and a
 * second pair of eyes are the norm.
 */
const connection = useConnectionStore()

const { data, error, loading, refreshing, lastUpdated, reload } = useResource(
  ({ signal }) => wls.securityRealm({ signal }),
  // The realm does not change while you watch it, and listing users is not a
  // call to make every fifteen seconds.
  { poll: false },
)

const providers = computed(() =>
  items(data.value?.providers).map((provider) => ({
    name: provider.name,
    type: (provider.type || '').split('.').pop() || '—',
    controlFlag: provider.controlFlag || '—',
    description: provider.description || '',
  })),
)

const provider = ref('')
const users = ref(null)
const groups = ref(null)
const principalsLoading = ref(false)
const principalsError = ref('')

watch(
  providers,
  (list) => {
    if (!provider.value && list.length) provider.value = list[0].name
  },
  { immediate: true },
)

/**
 * Users and groups are exposed differently across releases, and on some not at
 * all — `null` back from the API means "this release does not offer it", which
 * is said plainly rather than drawn as an empty table.
 */
async function loadPrincipals() {
  const realm = data.value?.realm
  if (!realm || !provider.value) return
  principalsLoading.value = true
  principalsError.value = ''
  try {
    const [userList, groupList] = await Promise.all([
      wls.realmPrincipals(realm, provider.value, 'users'),
      wls.realmPrincipals(realm, provider.value, 'groups'),
    ])
    users.value = userList
    groups.value = groupList
    if (userList === null && groupList === null) {
      principalsError.value = t(
        'This WebLogic release does not expose users or groups over the REST management API. The realm and its providers above are still accurate; use WLST or the Remote Console for the accounts themselves.',
      )
    }
  } catch (err) {
    principalsError.value = err.fullText || err.message
    users.value = null
    groups.value = null
  } finally {
    principalsLoading.value = false
  }
}

watch([provider, () => data.value?.realm], loadPrincipals)
watch(() => connection.activeId, () => {
  provider.value = ''
  users.value = null
  groups.value = null
})

const facts = computed(() => [
  {
    label: t('Realm'),
    value: data.value?.realm || '—',
    hint: t('The security realm the domain runs with. Almost every domain has exactly one, called myrealm.'),
  },
  {
    label: t('Providers'),
    value: providers.value.length || '—',
    hint: t('Authentication providers, consulted in the order shown below.'),
  },
  { label: t('Users listed'), value: users.value === null ? t('not exposed') : users.value.length },
  { label: t('Groups listed'), value: groups.value === null ? t('not exposed') : groups.value.length },
  { label: t('Connected as'), value: connection.username },
])

const PROVIDER_COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Provider'),
    hint: t(
      'Providers are consulted in this order when somebody signs in. DefaultAuthenticator is WebLogic’s own store; anything else usually points at LDAP or Active Directory.',
    ),
  },
  { key: 'type', label: t('Type'), hint: t('The provider implementation — what it authenticates against.') },
  {
    key: 'controlFlag',
    label: t('Control flag'),
    hint: t(
      'How a result from this provider affects the chain. REQUIRED must succeed; SUFFICIENT ends the chain on success; OPTIONAL neither; REQUISITE fails the chain immediately on failure.',
    ),
  },
  { key: 'description', label: t('Description') },
])

const USER_COLUMNS = computed(() => [
  { key: 'name', label: t('User'), hint: t('The account name used to sign in.') },
  { key: 'description', label: t('Description'), hint: t('Whatever the provider records about the account.') },
])

const GROUP_COLUMNS = computed(() => [
  {
    key: 'name',
    label: t('Group'),
    hint: t(
      'Groups are what roles are granted to. Administrators, Deployers, Operators and Monitors are the built-in ones that decide what this console can do for a given user.',
    ),
  },
  { key: 'description', label: t('Description') },
])
</script>

<template>
  <div>
    <PageHeader
      :title="$t('Security')"
      :subtitle="$t('The realm, its authentication providers, and the accounts they hold')"
      :last-updated="lastUpdated"
      :refreshing="refreshing"
      :help="
        $t(
          'A read-only view of who can sign in to this domain and through which provider. Creating accounts and changing role mappings is left to WLST or the Remote Console on purpose.',
        )
      "
      @refresh="reload"
    />

    <HelpPanel id="security" :title="$t('What decides whether a user can do something here')">
      <ol class="list-decimal space-y-1 pl-4">
        <li>
          {{
            $t(
              'Signing in goes through the providers below, in order. The control flag decides whether one provider\'s answer is enough.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'What the account may then do comes from the groups it belongs to: Administrators may change anything, Deployers may deploy, Operators may start and stop servers, Monitors may only read.',
            )
          }}
        </li>
        <li>
          {{
            $t(
              'This console enforces nothing of its own — WebLogic refuses what the signed-in user may not do, and the error is shown as it comes back.',
            )
          }}
        </li>
      </ol>
      <p>
        {{
          $t(
            'Connecting with a Monitor account is a good way to look around a production domain without being able to change it by accident.',
          )
        }}
      </p>
    </HelpPanel>

    <ErrorState v-if="error && !data" :error="error" @retry="reload" />

    <template v-else>
      <div class="card mb-4 p-4">
        <FactList :facts="facts" />
      </div>

      <DataTable
        :columns="PROVIDER_COLUMNS"
        :rows="providers"
        state-key="main"
        export-name="auth-providers"
        :loading="loading"
        :empty-text="$t('No authentication providers were returned for this realm.')"
        :search-placeholder="$t('Filter providers…')"
        :search-hint="$t('Matches the provider name, type and control flag.')"
      >
        <template #cell:name="{ row }">
          <button
            :class="[
              'font-medium',
              provider === row.name
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-700 hover:text-indigo-600 dark:text-zinc-200 dark:hover:text-indigo-400',
            ]"
            :title="$t('Show the users and groups this provider holds')"
            @click="provider = row.name"
          >
            {{ row.name }}
          </button>
        </template>
        <template #cell:description="{ row }">
          <span class="text-xs text-zinc-500 dark:text-zinc-400">{{ row.description || '—' }}</span>
        </template>
      </DataTable>

      <div v-if="provider" class="mt-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {{ $t('Accounts in {provider}', { provider }) }}
          <span v-if="principalsLoading" class="ml-1 font-normal normal-case tracking-normal text-zinc-400">
            {{ $t('— reading…') }}
          </span>
        </h2>

        <p
          v-if="principalsError"
          class="card p-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
        >
          {{ principalsError }}
        </p>

        <div v-else class="grid gap-4 xl:grid-cols-2">
          <div>
            <DataTable
              :columns="USER_COLUMNS"
              :rows="users || []"
              state-key="users"
              export-name="realm-users"
              dense
              :loading="principalsLoading"
              :empty-text="$t('This provider returned no users.')"
              :search-placeholder="$t('Filter users…')"
              :search-hint="$t('Matches the user name and description of the accounts already loaded.')"
            />
          </div>
          <div>
            <DataTable
              :columns="GROUP_COLUMNS"
              :rows="groups || []"
              state-key="groups"
              export-name="realm-groups"
              dense
              :loading="principalsLoading"
              :empty-text="$t('This provider returned no groups.')"
              :search-placeholder="$t('Filter groups…')"
              :search-hint="$t('Matches the group name and description of the groups already loaded.')"
            />
          </div>
        </div>
      </div>
    </template>

    <p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
      {{ $t('Read-only by design. Adding a user or changing a role mapping is a WLST or Remote Console operation.') }}
    </p>
  </div>
</template>
