import { describe, expect, it } from 'vitest'
import { parseTarget } from '@/utils/target'

describe('parseTarget', () => {
  it('is null for nothing at all', () => {
    expect(parseTarget('')).toBeNull()
    expect(parseTarget('   ')).toBeNull()
    expect(parseTarget(null)).toBeNull()
    expect(parseTarget(undefined)).toBeNull()
  })

  it('takes a bare hostname, stating neither port nor SSL', () => {
    expect(parseTarget('adminhost')).toEqual({ host: 'adminhost' })
  })

  it('splits host and port', () => {
    expect(parseTarget('adminhost:7001')).toEqual({ host: 'adminhost', port: 7001 })
  })

  it('carries a t3 port straight over, since t3 and HTTP share the listen port', () => {
    expect(parseTarget('t3://adminhost:7001')).toEqual({ host: 'adminhost', port: 7001, ssl: false })
  })

  it('reads SSL off the secure schemes', () => {
    expect(parseTarget('t3s://adminhost:7002').ssl).toBe(true)
    expect(parseTarget('https://adminhost:7002').ssl).toBe(true)
    expect(parseTarget('ldaps://adminhost:636').ssl).toBe(true)
  })

  it('reads no SSL off the plain schemes', () => {
    expect(parseTarget('http://adminhost:7001').ssl).toBe(false)
    expect(parseTarget('t3://adminhost:7001').ssl).toBe(false)
  })

  it('says nothing about SSL for a scheme it does not recognise', () => {
    const out = parseTarget('weird://adminhost:7001')
    expect(out).toEqual({ host: 'adminhost', port: 7001 })
    expect('ssl' in out).toBe(false)
  })

  it('takes the first member of a cluster address', () => {
    expect(parseTarget('t3://ms1:7001,ms2:7001')).toEqual({ host: 'ms1', port: 7001, ssl: false })
  })

  it('drops a path, a query and a fragment', () => {
    expect(parseTarget('http://adminhost:7001/console?x=1#top')).toEqual({
      host: 'adminhost',
      port: 7001,
      ssl: false,
    })
  })

  it('drops credentials written inside the URL', () => {
    expect(parseTarget('t3://weblogic:secret@adminhost:7001')).toEqual({
      host: 'adminhost',
      port: 7001,
      ssl: false,
    })
  })

  it('drops a user written in front of the scheme', () => {
    expect(parseTarget('weblogic@t3://adminhost:7001')).toEqual({ host: 'adminhost', port: 7001, ssl: false })
  })

  it('unwraps a bracketed IPv6 address with its port', () => {
    expect(parseTarget('[2001:db8::1]:7001')).toEqual({ host: '2001:db8::1', port: 7001 })
  })

  it('unwraps a bracketed IPv6 address without a port', () => {
    expect(parseTarget('t3://[::1]')).toEqual({ host: '::1', ssl: false })
  })

  it('keeps a bare IPv6 address whole, since it has no port to split off', () => {
    expect(parseTarget('2001:db8::1')).toEqual({ host: '2001:db8::1' })
  })

  it('drops a suffix that is not a port rather than reading one', () => {
    // Note the asymmetry with the bare-IPv6 case above: a single colon is
    // always treated as a host/port separator, so the garbage after it is
    // discarded silently instead of being reported back to the caller.
    expect(parseTarget('adminhost:abc')).toEqual({ host: 'adminhost' })
  })

  it('trims what an operator pasted', () => {
    expect(parseTarget('  t3://adminhost:7001  ')).toEqual({ host: 'adminhost', port: 7001, ssl: false })
  })

  it('is null when the scheme was all there was', () => {
    expect(parseTarget('t3://')).toBeNull()
    expect(parseTarget('http:///console')).toBeNull()
  })
})
