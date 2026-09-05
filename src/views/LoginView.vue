<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useReconnect } from '@/composables/useReconnect'
import { parseTarget } from '@/utils/target'
import ErrorState from '@/components/ErrorState.vue'
import PasswordPrompt from '@/components/PasswordPrompt.vue'
import HelpPanel from '@/components/HelpPanel.vue'
import InfoTip from '@/components/InfoTip.vue'

const connection = useConnectionStore()
const router = useRouter()
const route = useRoute()

const prompt = ref(null)
const reconnect = useReconnect(prompt)

/** Reached from "Add connection…" while other domains are already open. */
const addingAnother = computed(() => Boolean(route.query.add) && connection.connections.length > 0)

const last = connection.profiles[0]
const form = reactive({
  name: '',
  host: last?.host ?? 'localhost',
  port: last?.port ?? 7001,
  ssl: last?.ssl ?? false,
  insecure: last?.insecure ?? false,
  username: last?.username ?? 'weblogic',
  password: '',
  save: true,
})

const error = ref(null)
const passwordVisible = ref(false)
const showForm = ref(false)

const previewUrl = computed(() => {
  const host = form.host?.trim() || 'host'
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `${form.ssl ? 'https' : 'http'}://${bracketed}:${form.port || '?'}/management/weblogic/latest`
})

/** Show the form straight away when there is nothing saved to pick from. */
const formVisible = computed(() => showForm.value || !connection.profiles.length)

function done() {
  router.replace(addingAnother.value ? { name: 'dashboard' } : route.query.redirect || { name: 'dashboard' })
}

/**
 * Operators paste the address they already have, which is almost always a t3
 * URL from a WLST script. Split it into the fields instead of making them do it.
 */
function normalizeHost() {
  const parsed = parseTarget(form.host)
  if (!parsed) return
  form.host = parsed.host
  if (parsed.port) form.port = parsed.port
  if (parsed.ssl !== undefined) form.ssl = parsed.ssl
}

async function submit() {
  normalizeHost()
  error.value = null
  try {
    await connection.connect(form)
    form.password = ''
    done()
  } catch (err) {
    error.value = err
  }
}

async function openProfile(profile) {
  if (await reconnect(profile)) done()
}

async function switchTo(item) {
  await connection.activate(item.id)
  done()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
    <div class="w-full max-w-md">
      <div class="mb-6 flex items-center gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">W</span>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">WebLogic Console</h1>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            {{ addingAnother ? $t('Add another AdminServer') : $t('Connect to an AdminServer') }}
          </p>
        </div>
      </div>

      <!-- Saved and open connections first: the common case is coming back to
           a domain you already work with. -->
      <div v-if="connection.profiles.length || connection.connections.length" class="card mb-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        <button
          v-for="item in connection.connections"
          :key="item.id"
          class="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          @click="switchTo(item)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{{ item.name }}</span>
            <span class="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {{ item.username }}@{{ item.host }}:{{ item.port }}
            </span>
          </span>
          <span class="text-xs text-zinc-400 dark:text-zinc-500">
            {{ item.active ? $t('active') : $t('open') }}
          </span>
        </button>

        <button
          v-for="profile in connection.offlineProfiles"
          :key="profile.id"
          class="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          @click="openProfile(profile)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{{ profile.name }}</span>
            <span class="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {{ profile.username }}@{{ profile.host }}:{{ profile.port }}<span v-if="profile.ssl"> · SSL</span>
            </span>
          </span>
          <span class="text-xs text-zinc-400 dark:text-zinc-500">{{ $t('connect') }}</span>
        </button>
      </div>

      <button
        v-if="!formVisible"
        class="btn btn-ghost w-full"
        @click="showForm = true"
      >
        {{ $t('New connection…') }}
      </button>

      <HelpPanel v-if="formVisible" id="login" :title="$t('What to enter here')" default-open>
        <p>
          {{
            $t(
              'Connect with the AdminServer of the domain, not a managed server. Everything in this console goes through it.',
            )
          }}
        </p>
        <ul class="list-disc space-y-1 pl-4">
          <li>
            {{
              $t(
                'Host and port are the AdminServer\'s admin listen address, usually port 7001 (7002 with SSL). Already have a t3://host:port address from a WLST script? Paste it into the host box and it splits itself into the fields.',
              )
            }}
          </li>
          <li>
            {{
              $t(
                'Username needs a role that can read the management API — Monitor is enough to look around, Operator or Admin to start and stop things.',
              )
            }}
          </li>
          <li>
            {{
              $t(
                'Save this connection keeps the host, port and username on this machine for next time. The password is never stored.',
              )
            }}
          </li>
        </ul>
        <p>
          {{
            $t(
              'If connecting fails, check that the AdminServer is up on that port and that the REST management interface is enabled for the domain.',
            )
          }}
        </p>
      </HelpPanel>

      <form v-if="formVisible" class="card space-y-4 p-5" @submit.prevent="submit">
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="label-row" for="host">
              {{ $t('Host or IP') }}
              <InfoTip
                :heading="$t('Host or IP')"
                :text="
                  $t(
                    'Where the AdminServer listens. A hostname, an IPv4 or IPv6 address, or a whole t3:// URL pasted from a WLST script — a URL is split into host, port and SSL automatically.',
                  )
                "
              />
            </label>
            <input
              id="host"
              v-model="form.host"
              class="input"
              required
              autocomplete="off"
              :placeholder="$t('10.0.0.12 or t3://10.0.0.12:7001')"
              @blur="normalizeHost"
              @paste="$nextTick(normalizeHost)"
            />
          </div>
          <div>
            <label class="label-row" for="port">
              {{ $t('Port') }}
              <InfoTip
                :heading="$t('Port')"
                :text="
                  $t(
                    'The AdminServer\'s admin port: 7001 by default, or 7002 when the SSL port is used. T3 and HTTP share the same port, so a t3:// address gives you the right number.',
                  )
                "
              />
            </label>
            <input id="port" v-model.number="form.port" class="input" required type="number" min="1" max="65535" />
          </div>
        </div>

        <div>
          <label class="label-row" for="username">
            {{ $t('Username') }}
            <InfoTip
              :heading="$t('Username')"
              :text="
                $t(
                  'A WebLogic account, not an operating-system one. It needs a role with access to the management API: Monitor to view, Operator or Admin to start and stop servers and applications.',
                )
              "
            />
          </label>
          <input id="username" v-model="form.username" class="input" required autocomplete="username" />
        </div>

        <div>
          <label class="label-row" for="password">
            {{ $t('Password') }}
            <InfoTip
              :heading="$t('Password')"
              :text="
                $t(
                  'Held by the local console process for this session only, so it can talk to the AdminServer for you. It is never written to disk and never saved with a profile.',
                )
              "
            />
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="form.password"
              class="input pr-16"
              :type="passwordVisible ? 'text' : 'password'"
              required
              autocomplete="current-password"
            />
            <button
              type="button"
              class="absolute right-2 top-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              @click="passwordVisible = !passwordVisible"
            >
              {{ passwordVisible ? $t('Hide') : $t('Show') }}
            </button>
          </div>
        </div>

        <div>
          <label class="label-row" for="name">
            {{ $t('Name') }} <span class="font-normal text-zinc-400">{{ $t('(optional)') }}</span>
            <InfoTip
              :heading="$t('Name')"
              :text="
                $t(
                  'A label for this connection, so several open domains are easy to tell apart in the switcher. Defaults to the domain name reported by the AdminServer.',
                )
              "
            />
          </label>
          <input
            id="name"
            v-model="form.name"
            class="input"
            :placeholder="$t('Production · Ankara')"
            autocomplete="off"
          />
        </div>

        <div class="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/60">
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input v-model="form.ssl" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900" />
            {{ $t('Use SSL (https)') }}
            <InfoTip
              :heading="$t('Use SSL')"
              :text="
                $t(
                  'Talk to the admin port over https instead of http. Turn it on only if the domain has its SSL listen port enabled — usually 7002. The address preview below shows the URL that will be called.',
                )
              "
            />
          </label>
          <label
            v-if="form.ssl"
            class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            :title="$t('Accept self-signed or otherwise untrusted certificates')"
          >
            <input v-model="form.insecure" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900" />
            {{ $t('Trust self-signed certificate') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input v-model="form.save" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900" />
            {{ $t('Save this connection') }}
            <InfoTip
              :heading="$t('Save this connection')"
              :text="
                $t(
                  'Stores the host, port, username and name on this machine so the domain is one click away next time. The password is never included — you enter it once per console restart.',
                )
              "
            />
          </label>
          <p
            class="break-all font-mono text-xs text-zinc-400 dark:text-zinc-500"
            :title="$t('The management API URL these fields build. This is exactly what the console will call.')"
          >
            {{ previewUrl }}
          </p>
          <p class="text-xs text-zinc-400 dark:text-zinc-500">
            {{
              $t(
                'Paste a t3:// address and it is split into these fields — T3 and HTTP share the admin port.',
              )
            }}
          </p>
        </div>

        <ErrorState v-if="error" :error="error" @retry="submit" />

        <button class="btn btn-primary w-full py-2" type="submit" :disabled="connection.busy">
          {{ connection.busy ? $t('Connecting…') : $t('Connect') }}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        {{
          $t(
            'Saved connections keep the host, port and username — never the password. Credentials are held by the local console process for this session only.',
          )
        }}
      </p>
    </div>

    <PasswordPrompt ref="prompt" />
  </div>
</template>
