/**
 * Runs the two halves of the dev setup together: the local backend that proxies
 * to the AdminServer, and Vite for the UI. Vite forwards /api to the backend
 * (see vite.config.js), so the browser only ever talks to the Vite origin.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

const children = []

function run(name, args, color) {
  // Spawning node directly avoids the .cmd/.sh shim differences across platforms.
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `
  const write = (stream) => (chunk) => {
    const text = chunk.toString().replace(/\n$/, '')
    if (text.trim()) stream.write(text.split('\n').map((l) => prefix + l).join('\n') + '\n')
  }
  child.stdout.on('data', write(process.stdout))
  child.stderr.on('data', write(process.stderr))
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`${prefix}exited with code ${code}`)
      shutdown(code ?? 1)
    }
  })
  children.push(child)
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('server', [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], '36')
run('ui', [viteBin], '35')
