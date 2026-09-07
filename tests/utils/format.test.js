import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appVersion,
  baseAppName,
  bytes,
  datetime,
  duration,
  healthOf,
  isDeploymentRuntime,
  items,
  num,
  percent,
  since,
  targetNames,
} from '@/utils/format'

describe('bytes', () => {
  it('shows an em dash for something that is not a number', () => {
    expect(bytes(null)).toBe('—')
    expect(bytes(undefined)).toBe('—')
    expect(bytes('nonsense')).toBe('—')
  })

  it('leaves whole bytes undecimated', () => {
    expect(bytes(0)).toBe('0 B')
    expect(bytes(512)).toBe('512 B')
  })

  it('climbs to the largest unit that leaves a value above one', () => {
    expect(bytes(1024)).toBe('1.0 KB')
    expect(bytes(2 * 1024 ** 3)).toBe('2.0 GB')
    expect(bytes(1024 ** 4)).toBe('1.0 TB')
  })

  it('does not climb past terabytes', () => {
    expect(bytes(5 * 1024 ** 5)).toBe('5120.0 TB')
  })

  it('honours the requested precision', () => {
    expect(bytes(1536, 2)).toBe('1.50 KB')
  })
})

describe('num', () => {
  it('shows an em dash for nothing at all', () => {
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(num('')).toBe('—')
  })

  it('keeps zero, which is a reading', () => {
    expect(num(0)).toBe('0')
  })

  it('gives back a non-numeric string unchanged', () => {
    expect(num('n/a')).toBe('n/a')
  })
})

describe('duration', () => {
  it('shows an em dash for nothing', () => {
    expect(duration(null)).toBe('—')
    expect(duration(undefined)).toBe('—')
  })

  it('keeps zero', () => {
    expect(duration(0)).toBe('0s')
  })

  it('reads under a minute in seconds', () => {
    expect(duration(45_000)).toBe('45s')
  })

  it('reads minutes with their seconds', () => {
    expect(duration(90_000)).toBe('1m 30s')
  })

  it('drops seconds once there are hours', () => {
    expect(duration(3 * 3_600_000 + 4 * 60_000 + 30_000)).toBe('3h 4m')
  })

  it('drops minutes once there are days', () => {
    expect(duration(2 * 86_400_000 + 5 * 3_600_000)).toBe('2d 5h')
  })
})

describe('since', () => {
  afterEach(() => vi.useRealTimers())

  it('measures back from now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    expect(since(Date.now() - 120_000)).toBe('2m 0s')
  })

  it('shows an em dash when there is no timestamp', () => {
    expect(since(0)).toBe('—')
    expect(since(null)).toBe('—')
  })
})

describe('datetime', () => {
  it('shows an em dash when there is no timestamp', () => {
    expect(datetime(null)).toBe('—')
  })

  it('gives the input back when it is not a date', () => {
    expect(datetime('not-a-date')).toBe('not-a-date')
  })

  it('renders a real epoch', () => {
    expect(datetime(1_700_000_000_000)).toMatch(/\d/)
  })
})

describe('percent', () => {
  it('shows an em dash for nothing', () => {
    expect(percent(null)).toBe('—')
    expect(percent('x')).toBe('—')
  })

  it('rounds to the requested precision', () => {
    expect(percent(91.44)).toBe('91%')
    expect(percent(91.44, 1)).toBe('91.4%')
  })
})

describe('targetNames', () => {
  it('is empty when there are no targets', () => {
    expect(targetNames(null)).toEqual([])
    expect(targetNames(undefined)).toEqual([])
  })

  it('keeps plain strings', () => {
    expect(targetNames(['ms1', 'ms2'])).toEqual(['ms1', 'ms2'])
  })

  it('takes the last segment of an identity', () => {
    expect(targetNames([{ identity: ['servers', 'ms1'] }])).toEqual(['ms1'])
  })

  it('falls back to a name property', () => {
    expect(targetNames([{ name: 'cluster1' }])).toEqual(['cluster1'])
  })

  it('accepts a single target that is not in an array', () => {
    expect(targetNames({ identity: ['clusters', 'c1'] })).toEqual(['c1'])
  })

  it('drops entries it cannot name', () => {
    expect(targetNames([{ nothing: true }, 'ms1'])).toEqual(['ms1'])
  })
})

describe('baseAppName and appVersion', () => {
  it('splits a versioned deployment name', () => {
    expect(baseAppName('myapp#V1')).toBe('myapp')
    expect(appVersion('myapp#V1')).toBe('V1')
  })

  it('leaves an unversioned name alone', () => {
    expect(baseAppName('myapp')).toBe('myapp')
    expect(appVersion('myapp')).toBe('')
  })

  it('tolerates nothing at all', () => {
    expect(baseAppName(null)).toBe('')
    expect(appVersion(undefined)).toBe('')
  })
})

describe('isDeploymentRuntime', () => {
  it('matches an unversioned deployment against its runtime', () => {
    expect(isDeploymentRuntime('myapp', { applicationName: 'myapp' })).toBe(true)
  })

  it('lets an unversioned deployment match a runtime that picked up a version', () => {
    // The archive's manifest can carry a version the configuration name lacks.
    expect(isDeploymentRuntime('myapp', { name: 'myapp#V2', applicationName: 'myapp' })).toBe(true)
  })

  it('keeps a retired version from borrowing the active one’s runtime', () => {
    expect(isDeploymentRuntime('myapp#V1', { applicationName: 'myapp', applicationVersion: 'V2' })).toBe(false)
  })

  it('matches a versioned deployment against its own version', () => {
    expect(isDeploymentRuntime('myapp#V1', { applicationName: 'myapp', applicationVersion: 'V1' })).toBe(true)
  })

  it('reads the version off the runtime name when it reports none separately', () => {
    expect(isDeploymentRuntime('myapp#V1', { name: 'myapp#V1' })).toBe(true)
  })

  it('does not match a different application', () => {
    expect(isDeploymentRuntime('myapp', { applicationName: 'other' })).toBe(false)
  })

  it('is false when there is no runtime', () => {
    expect(isDeploymentRuntime('myapp', null)).toBe(false)
  })
})

describe('healthOf', () => {
  it('reads the object form of recent releases', () => {
    expect(healthOf({ state: 'ok' })).toBe('OK')
  })

  it('reads the string form of older ones, without its prefix', () => {
    expect(healthOf('HEALTH_WARN')).toBe('WARN')
  })

  it('falls back to the nested symptom state', () => {
    expect(healthOf({ symptoms: { state: 'CRITICAL' } })).toBe('CRITICAL')
  })

  it('is UNKNOWN when the server said nothing', () => {
    expect(healthOf(null)).toBe('UNKNOWN')
    expect(healthOf(undefined)).toBe('UNKNOWN')
  })
})

describe('items', () => {
  it('unwraps a WebLogic collection', () => {
    expect(items({ items: [1, 2] })).toEqual([1, 2])
  })

  it('passes an array straight through', () => {
    expect(items([1, 2])).toEqual([1, 2])
  })

  it('is empty for a singleton or for nothing', () => {
    expect(items({ name: 'ms1' })).toEqual([])
    expect(items(null)).toEqual([])
    expect(items(undefined)).toEqual([])
  })
})
