/**
 * The Java command line, read as amounts rather than as one long string.
 *
 * Heap size is the resource operators ask about first, and in WebLogic it is
 * not an MBean attribute at all: it lives in the arguments Node Manager passes
 * to java, as -Xmx. Comparing those arguments as text is close to useless —
 * `-Xmx2g` and `-Xmx2048m` are the same heap written two ways, and two
 * identical command lines in a different order look entirely different.
 *
 * So the line is parsed into three buckets: the named amounts (heap, metaspace,
 * stack, collector), the -D system properties as a map, and everything left
 * over as a set. Each bucket can then be compared on its own terms.
 */

const MULTIPLIERS = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }
const SIZE = /^(\d+(?:\.\d+)?)([kmgt]?)b?$/i

/** '2g', '2048m', '2097152k' and '2147483648' all come back as the same number. */
export function parseSize(text) {
  const match = SIZE.exec(String(text ?? '').trim())
  if (!match) return null
  return Math.round(Number(match[1]) * MULTIPLIERS[match[2].toLowerCase()])
}

/** Which collector a flag selects. Only one of these is ever in force. */
const COLLECTORS = {
  UseG1GC: 'G1',
  UseParallelGC: 'Parallel',
  UseParallelOldGC: 'Parallel',
  UseConcMarkSweepGC: 'CMS',
  UseSerialGC: 'Serial',
  UseZGC: 'Z',
  UseShenandoahGC: 'Shenandoah',
  UseEpsilonGC: 'Epsilon',
}

/** -XX options whose value is a size, mapped to the amount they set. */
const SIZED = {
  MaxMetaspaceSize: 'metaspaceMax',
  MetaspaceSize: 'metaspaceMin',
  MaxPermSize: 'permMax',
  PermSize: 'permMin',
  ReservedCodeCacheSize: 'codeCache',
  MaxDirectMemorySize: 'directMemory',
  NewSize: 'youngMin',
  MaxNewSize: 'youngMax',
}

/** -XX options whose value is a plain count. */
const COUNTED = {
  ParallelGCThreads: 'gcThreads',
  ConcGCThreads: 'concurrentGcThreads',
  MaxGCPauseMillis: 'maxGcPause',
  NewRatio: 'newRatio',
  SurvivorRatio: 'survivorRatio',
}

/**
 * Splits a command line the way a shell would, keeping a quoted value together
 * so `-Dpath="C:/Program Files/x"` stays one argument.
 */
function tokenise(text) {
  const matches = String(text ?? '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []
  return matches.map((token) => token.replace(/["']/g, ''))
}

/**
 * @returns {{
 *   heapMin: number|null, heapMax: number|null, youngMin: number|null, youngMax: number|null,
 *   threadStack: number|null, metaspaceMax: number|null, metaspaceMin: number|null,
 *   permMax: number|null, permMin: number|null, codeCache: number|null, directMemory: number|null,
 *   collector: string, gcThreads: number|null, concurrentGcThreads: number|null,
 *   maxGcPause: number|null, newRatio: number|null, survivorRatio: number|null,
 *   properties: Record<string,string>, options: string[], empty: boolean
 * }}
 */
export function parseJvmArgs(text) {
  const out = {
    heapMin: null,
    heapMax: null,
    youngMin: null,
    youngMax: null,
    threadStack: null,
    metaspaceMax: null,
    metaspaceMin: null,
    permMax: null,
    permMin: null,
    codeCache: null,
    directMemory: null,
    collector: '',
    gcThreads: null,
    concurrentGcThreads: null,
    maxGcPause: null,
    newRatio: null,
    survivorRatio: null,
    properties: {},
    options: [],
    empty: true,
  }

  const tokens = tokenise(text)
  out.empty = tokens.length === 0

  for (const token of tokens) {
    let match

    if ((match = /^-Xm([sxn])(.+)$/.exec(token))) {
      const size = parseSize(match[2])
      if (size !== null) {
        out[{ s: 'heapMin', x: 'heapMax', n: 'youngMin' }[match[1]]] = size
        continue
      }
    }

    if ((match = /^-Xss(.+)$/.exec(token))) {
      const size = parseSize(match[1])
      if (size !== null) {
        out.threadStack = size
        continue
      }
    }

    if ((match = /^-XX:([+-])(\w+)$/.exec(token))) {
      const collector = COLLECTORS[match[2]]
      // A collector turned off says nothing about which one is on instead.
      if (collector && match[1] === '+') {
        out.collector = collector
        continue
      }
      out.options.push(token)
      continue
    }

    if ((match = /^-XX:(\w+)=(.+)$/.exec(token))) {
      const [, name, value] = match
      if (SIZED[name]) {
        const size = parseSize(value)
        if (size !== null) {
          out[SIZED[name]] = size
          continue
        }
      }
      // A bare number here means kilobytes, the way -Xss without a unit does not.
      if (name === 'ThreadStackSize') {
        const size = /^\d+$/.test(value) ? Number(value) * 1024 : parseSize(value)
        if (size !== null) {
          out.threadStack = size
          continue
        }
      }
      if (COUNTED[name] && /^\d+$/.test(value)) {
        out[COUNTED[name]] = Number(value)
        continue
      }
      out.options.push(token)
      continue
    }

    if ((match = /^-D([^=]+)(?:=(.*))?$/.exec(token))) {
      out.properties[match[1]] = match[2] ?? ''
      continue
    }

    out.options.push(token)
  }

  out.options.sort()
  return out
}
