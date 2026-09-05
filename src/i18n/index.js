/**
 * Translation for the console's own words.
 *
 * The key is the English string itself. That keeps every template as readable
 * as it was before translation arrived — `:title="$t('Refresh')"` still says
 * what it renders — and it means a missing translation degrades to English
 * rather than to a bare `page.header.refresh` key on screen.
 *
 * `scripts/i18n-check.mjs` lists the keys a catalogue is missing, because the
 * cost of this scheme is that editing an English string silently orphans its
 * translation.
 *
 * What is NOT translated is as deliberate as what is. WebLogic's vocabulary —
 * server, cluster, deployment, data source, heap, JMS, JTA, work manager, MBean,
 * WLST — is the vocabulary Turkish operators use at the keyboard, and it is what
 * Oracle's documentation, WLST and every log line say. Translating it invents a
 * second glossary nobody uses and makes the console harder to map onto the
 * product it drives. So: the console's own sentences become Turkish, the
 * product's nouns stay as they are. See `tr.js` for the full glossary.
 */

import { reactive } from 'vue'
import tr from './tr'

export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
]

/** English is the source text, so it needs no catalogue of its own. */
const CATALOGUES = { tr }

const STORAGE_KEY = 'wl-console.locale'

const supported = (value) => LOCALES.some((entry) => entry.value === value)

/** A saved choice wins; otherwise the browser decides, then English. */
function readLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (supported(saved)) return saved
  } catch {
    /* storage disabled — fall through to the browser's language */
  }
  const preferred = [navigator.language, ...(navigator.languages || [])]
    .filter(Boolean)
    .map((tag) => String(tag).slice(0, 2).toLowerCase())
    .find(supported)
  return preferred || 'en'
}

const state = reactive({ locale: readLocale() })

const PARAMS = /\{(\w+)\}/g

/**
 * `t('Close {name}', { name })` — the parameter form keeps names, counts and
 * hosts out of the catalogue, so one entry covers every row that uses it.
 */
export function t(text, params) {
  const catalogue = CATALOGUES[state.locale]
  const translated = (catalogue && catalogue[text]) || text
  if (!params) return translated
  return translated.replace(PARAMS, (match, name) => (name in params ? String(params[name]) : match))
}

export function locale() {
  return state.locale
}

export function setLocale(next) {
  if (!supported(next)) return
  state.locale = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage disabled — the language resets next visit */
  }
  applyLocale()
}

/** Screen readers and `lang`-sensitive CSS need the document to agree. */
export function applyLocale() {
  document.documentElement.lang = state.locale
}

/** Makes `$t` available in every template without a per-file import. */
export function installI18n(app) {
  app.config.globalProperties.$t = t
  applyLocale()
}

/** For the odd component that wants the locale itself, not just `t`. */
export function useI18n() {
  return { t, locale, setLocale, LOCALES }
}
