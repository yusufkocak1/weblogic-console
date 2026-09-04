/**
 * The browser tab title, which two things want to write to: the router, which
 * names the page, and the alert watcher, which puts the number of unread alerts
 * in front of it so a console in a background tab can still say "look at me".
 */

const SUFFIX = 'WebLogic Console'

let base = SUFFIX
let badge = 0

function apply() {
  const prefix = badge > 0 ? `(${badge}) ` : ''
  document.title = `${prefix}${base}`
}

/** Called by the router on every navigation. */
export function setTitleBase(page) {
  base = page ? `${page} · ${SUFFIX}` : SUFFIX
  apply()
}

/** Called by the alerts store whenever the unread count changes. */
export function setTitleBadge(count) {
  badge = Number(count) || 0
  apply()
}
