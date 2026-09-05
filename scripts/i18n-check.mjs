/**
 * Which strings are still waiting for a translation, and which translations no
 * longer match any string in the source.
 *
 * The catalogues are keyed by the English text itself (see src/i18n/index.js),
 * which buys readable templates at one cost: editing an English string orphans
 * its translation silently. This script is that cost paid back — run it after
 * touching UI text.
 *
 *   npm run i18n:check          list what is missing
 *   npm run i18n:check -- --all also list orphaned entries
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')

/** `t('…')` and `$t('…')`, single- or double-quoted, escapes included. */
const CALL = /(?<![\w.$])\$?t\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.(vue|js)$/.test(path) ? [path] : []
  })
}

/** Where each key is used, so a missing one can be found without grepping. */
const used = new Map()
for (const file of walk(src)) {
  if (file.includes(join('src', 'i18n'))) continue
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(CALL)) {
    const key = (match[1] ?? match[2]).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    if (!used.has(key)) used.set(key, new Set())
    used.get(key).add(relative(root, file))
  }
}

// Every catalogue beside index.js. English is the source text, so it has none.
const catalogues = readdirSync(join(src, 'i18n'))
  .filter((entry) => entry.endsWith('.js') && entry !== 'index.js')
  .map((entry) => entry.replace(/\.js$/, ''))

let failed = false

for (const value of catalogues) {
  const catalogue = (await import(`../src/i18n/${value}.js`)).default
  const missing = [...used.keys()].filter((key) => !(key in catalogue))
  const orphaned = Object.keys(catalogue).filter((key) => !used.has(key))

  console.log(`\n${value} — ${used.size - missing.length}/${used.size} translated`)

  if (missing.length) {
    failed = true
    console.log(`\n  ${missing.length} missing:`)
    for (const key of missing) {
      console.log(`    ${JSON.stringify(key)}`)
      console.log(`      ${[...used.get(key)].join(', ')}`)
    }
  }

  if (orphaned.length && process.argv.includes('--all')) {
    console.log(`\n  ${orphaned.length} orphaned (no longer in the source):`)
    for (const key of orphaned) console.log(`    ${JSON.stringify(key)}`)
  } else if (orphaned.length) {
    console.log(`  ${orphaned.length} orphaned — re-run with --all to list them`)
  }
}

if (failed) process.exitCode = 1
else console.log('\nEvery string is translated.')
