import { describe, expect, it } from 'vitest'
import { parseJvmArgs, parseSize } from '@/utils/jvm'

const GB = 1024 ** 3
const MB = 1024 ** 2

describe('parseSize', () => {
  it('reads the same heap written four ways as one number', () => {
    expect(parseSize('2g')).toBe(2 * GB)
    expect(parseSize('2048m')).toBe(2 * GB)
    expect(parseSize('2097152k')).toBe(2 * GB)
    expect(parseSize('2147483648')).toBe(2 * GB)
  })

  it('is case insensitive and tolerates a trailing b', () => {
    expect(parseSize('2G')).toBe(2 * GB)
    expect(parseSize('512MB')).toBe(512 * MB)
  })

  it('accepts a fraction', () => {
    expect(parseSize('1.5g')).toBe(1.5 * GB)
  })

  it('ignores surrounding whitespace', () => {
    expect(parseSize('  4g  ')).toBe(4 * GB)
  })

  it('is null for anything that is not a size', () => {
    expect(parseSize('')).toBeNull()
    expect(parseSize(null)).toBeNull()
    expect(parseSize('abc')).toBeNull()
    expect(parseSize('2x')).toBeNull()
  })
})

describe('parseJvmArgs', () => {
  it('reports an empty command line as empty', () => {
    const out = parseJvmArgs('')
    expect(out.empty).toBe(true)
    expect(out.heapMax).toBeNull()
    expect(out.properties).toEqual({})
    expect(out.options).toEqual([])
  })

  it('tolerates nothing at all', () => {
    expect(parseJvmArgs(null).empty).toBe(true)
    expect(parseJvmArgs(undefined).empty).toBe(true)
  })

  it('reads the heap and young generation flags', () => {
    const out = parseJvmArgs('-Xms1g -Xmx4g -Xmn512m -Xss256k')
    expect(out.heapMin).toBe(GB)
    expect(out.heapMax).toBe(4 * GB)
    expect(out.youngMin).toBe(512 * MB)
    expect(out.threadStack).toBe(256 * 1024)
    expect(out.empty).toBe(false)
  })

  it('reads two command lines that mean the same thing as the same amounts', () => {
    const a = parseJvmArgs('-Xmx2g -XX:+UseG1GC -Dweblogic.Name=ms1')
    const b = parseJvmArgs('-Dweblogic.Name=ms1 -XX:+UseG1GC -Xmx2048m')
    expect(a.heapMax).toBe(b.heapMax)
    expect(a.collector).toBe(b.collector)
    expect(a.properties).toEqual(b.properties)
    expect(a.options).toEqual(b.options)
  })

  it('names the collector a +flag selects', () => {
    expect(parseJvmArgs('-XX:+UseG1GC').collector).toBe('G1')
    expect(parseJvmArgs('-XX:+UseParallelOldGC').collector).toBe('Parallel')
    expect(parseJvmArgs('-XX:+UseZGC').collector).toBe('Z')
  })

  it('does not read a collector out of a flag that turns one off', () => {
    const out = parseJvmArgs('-XX:-UseG1GC')
    expect(out.collector).toBe('')
    expect(out.options).toEqual(['-XX:-UseG1GC'])
  })

  it('reads the sized -XX options', () => {
    const out = parseJvmArgs('-XX:MaxMetaspaceSize=512m -XX:ReservedCodeCacheSize=256m -XX:MaxDirectMemorySize=1g')
    expect(out.metaspaceMax).toBe(512 * MB)
    expect(out.codeCache).toBe(256 * MB)
    expect(out.directMemory).toBe(GB)
  })

  it('reads the counted -XX options', () => {
    const out = parseJvmArgs('-XX:ParallelGCThreads=8 -XX:MaxGCPauseMillis=200 -XX:NewRatio=3')
    expect(out.gcThreads).toBe(8)
    expect(out.maxGcPause).toBe(200)
    expect(out.newRatio).toBe(3)
  })

  it('reads a bare ThreadStackSize as kilobytes, unlike -Xss', () => {
    expect(parseJvmArgs('-XX:ThreadStackSize=512').threadStack).toBe(512 * 1024)
    expect(parseJvmArgs('-XX:ThreadStackSize=1m').threadStack).toBe(MB)
  })

  it('collects -D properties into a map', () => {
    const out = parseJvmArgs('-Dweblogic.Name=ms1 -Dweblogic.security.SSL.ignoreHostnameVerification=true')
    expect(out.properties).toEqual({
      'weblogic.Name': 'ms1',
      'weblogic.security.SSL.ignoreHostnameVerification': 'true',
    })
  })

  it('records a -D with no value as an empty string, not as an option', () => {
    const out = parseJvmArgs('-Dsome.flag')
    expect(out.properties).toEqual({ 'some.flag': '' })
    expect(out.options).toEqual([])
  })

  it('keeps a quoted value together', () => {
    const out = parseJvmArgs('-Djava.io.tmpdir="C:/Program Files/tmp"')
    expect(out.properties['java.io.tmpdir']).toBe('C:/Program Files/tmp')
  })

  it('puts everything it does not recognise in options, sorted', () => {
    const out = parseJvmArgs('-server -verbose:gc -XX:+PrintGCDetails')
    expect(out.options).toEqual(['-XX:+PrintGCDetails', '-server', '-verbose:gc'])
  })

  it('keeps an unparseable size out of the amounts', () => {
    const out = parseJvmArgs('-Xmxbogus')
    expect(out.heapMax).toBeNull()
    expect(out.options).toEqual(['-Xmxbogus'])
  })

  it('keeps an -XX size it cannot parse as an option', () => {
    const out = parseJvmArgs('-XX:MaxMetaspaceSize=unlimited')
    expect(out.metaspaceMax).toBeNull()
    expect(out.options).toEqual(['-XX:MaxMetaspaceSize=unlimited'])
  })

  it('reads a realistic Node Manager command line whole', () => {
    const out = parseJvmArgs(
      '-Xms2g -Xmx2g -XX:MaxMetaspaceSize=512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 ' +
        '-Dweblogic.Name=ms1 -Djava.security.egd=file:/dev/./urandom -server',
    )
    expect(out).toMatchObject({
      heapMin: 2 * GB,
      heapMax: 2 * GB,
      metaspaceMax: 512 * MB,
      collector: 'G1',
      maxGcPause: 200,
      empty: false,
    })
    expect(out.properties['weblogic.Name']).toBe('ms1')
    expect(out.options).toEqual(['-server'])
  })
})
