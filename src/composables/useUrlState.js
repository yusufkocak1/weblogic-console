import { onScopeDispose, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Keeps a handful of refs in the page's URL.
 *
 * A filter you cannot link to is a filter you have to describe over the phone.
 * With the state in the query string, "the errors on ms2 in the last six hours"
 * is a URL: it survives a reload, it goes in a ticket, and the back button
 * takes you to the view you were just looking at.
 *
 * Values that equal their default are left out of the URL, so a page nobody has
 * touched still has a clean address.
 *
 * @param {Record<string, import('vue').Ref>} refs  query key -> ref
 * @param {Record<string, any>} defaults  the value that means "not in the URL";
 *   its type also decides how the string from the URL is read back.
 */
export function useUrlState(refs, defaults = {}) {
  const route = useRoute()
  const router = useRouter()

  const entries = Object.entries(refs)
  /** Guards the two watchers below from answering each other. */
  let applying = false

  function fromUrl() {
    applying = true
    for (const [key, ref] of entries) {
      const raw = route.query[key]
      const fallback = defaults[key]
      if (raw === undefined || raw === null) {
        ref.value = fallback === undefined ? ref.value : fallback
        continue
      }
      const text = Array.isArray(raw) ? raw[0] : raw
      if (typeof fallback === 'number') {
        const parsed = Number(text)
        ref.value = Number.isNaN(parsed) ? fallback : parsed
      } else if (typeof fallback === 'boolean') {
        ref.value = text === '1' || text === 'true'
      } else {
        ref.value = String(text)
      }
    }
    applying = false
  }

  function toUrl() {
    if (applying) return
    const query = { ...route.query }
    for (const [key, ref] of entries) {
      const value = ref.value
      const isDefault =
        value === defaults[key] ||
        value === null ||
        value === undefined ||
        value === '' ||
        String(value) === String(defaults[key] ?? '')
      if (isDefault) delete query[key]
      else query[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
    }
    // replace, not push: typing in a filter box must not fill the history.
    if (JSON.stringify(query) !== JSON.stringify(route.query)) router.replace({ query }).catch(() => {})
  }

  fromUrl()

  const stopRefs = watch(
    entries.map(([, ref]) => ref),
    toUrl,
  )

  // Back and forward move through filter states as well as through pages.
  const stopRoute = watch(
    () => route.query,
    () => fromUrl(),
  )

  onScopeDispose(() => {
    stopRefs()
    stopRoute()
  })
}
