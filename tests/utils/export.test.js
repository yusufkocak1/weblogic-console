import { afterEach, describe, expect, it, vi } from 'vitest'
import { timestampedName, toCsv, toJson } from '@/utils/export'

const BOM = '﻿'
const COLUMNS = [
  { key: 'name', label: 'Server' },
  { key: 'state', label: 'State' },
]

describe('toCsv', () => {
  it('writes a BOM so Excel opens UTF-8 correctly', () => {
    expect(toCsv(COLUMNS, [])).toMatch(new RegExp(`^${BOM}`))
  })

  it('writes the header even when there are no rows', () => {
    expect(toCsv(COLUMNS, [])).toBe(`${BOM}Server,State\r\n`)
  })

  it('separates rows with CRLF and ends with one', () => {
    const csv = toCsv(COLUMNS, [{ name: 'ms1', state: 'RUNNING' }])
    expect(csv).toBe(`${BOM}Server,State\r\nms1,RUNNING\r\n`)
  })

  it('quotes a cell containing a comma', () => {
    expect(toCsv([{ key: 'a', label: 'A' }], [{ a: 'x,y' }])).toContain('"x,y"')
  })

  it('doubles a quote inside a quoted cell, per RFC 4180', () => {
    expect(toCsv([{ key: 'a', label: 'A' }], [{ a: 'say "hi"' }])).toContain('"say ""hi"""')
  })

  it('quotes a cell containing a newline', () => {
    expect(toCsv([{ key: 'a', label: 'A' }], [{ a: 'one\ntwo' }])).toContain('"one\ntwo"')
  })

  it('quotes a label that needs it too', () => {
    expect(toCsv([{ key: 'a', label: 'A, B' }], [])).toContain('"A, B"')
  })

  it('writes nothing at all for a missing value', () => {
    const csv = toCsv(COLUMNS, [{ name: 'ms1' }])
    expect(csv).toBe(`${BOM}Server,State\r\nms1,\r\n`)
  })

  it('tolerates a row that is not an object', () => {
    expect(toCsv(COLUMNS, [null])).toBe(`${BOM}Server,State\r\n,\r\n`)
  })

  it('keeps the columns in the order they were given', () => {
    const csv = toCsv([COLUMNS[1], COLUMNS[0]], [{ name: 'ms1', state: 'RUNNING' }])
    expect(csv).toBe(`${BOM}State,Server\r\nRUNNING,ms1\r\n`)
  })

  it('leaves out a column with no key, such as an actions column', () => {
    const csv = toCsv([...COLUMNS, { label: 'Actions' }], [{ name: 'ms1', state: 'RUNNING' }])
    expect(csv).toBe(`${BOM}Server,State\r\nms1,RUNNING\r\n`)
  })

  it('leaves out a column whose label is deliberately blank', () => {
    const csv = toCsv([...COLUMNS, { key: 'icon', label: '' }], [{ name: 'ms1', state: 'RUNNING', icon: '*' }])
    expect(csv).not.toContain('*')
  })
})

describe('toJson', () => {
  it('emits one object per row, with only the exported keys', () => {
    const json = JSON.parse(toJson(COLUMNS, [{ name: 'ms1', state: 'RUNNING', secret: 'x' }]))
    expect(json).toEqual([{ name: 'ms1', state: 'RUNNING' }])
  })

  it('writes a missing value as null rather than leaving the key out', () => {
    expect(JSON.parse(toJson(COLUMNS, [{ name: 'ms1' }]))).toEqual([{ name: 'ms1', state: null }])
  })

  it('is an empty array when there are no rows', () => {
    expect(JSON.parse(toJson(COLUMNS, []))).toEqual([])
  })

  it('keeps zero and false, which are readings rather than absences', () => {
    const columns = [
      { key: 'count', label: 'Count' },
      { key: 'on', label: 'On' },
    ]
    expect(JSON.parse(toJson(columns, [{ count: 0, on: false }]))).toEqual([{ count: 0, on: false }])
  })
})

describe('timestampedName', () => {
  afterEach(() => vi.useRealTimers())

  it('sorts by name because the stamp runs from year to minute', () => {
    vi.useFakeTimers()
    // Local time, since that is what an operator reading the filename expects.
    vi.setSystemTime(new Date(2026, 8, 4, 14, 32))
    expect(timestampedName('servers', 'csv')).toBe('servers-2026-09-04-1432.csv')
  })

  it('pads every field to a fixed width', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4))
    expect(timestampedName('monitoring', 'json')).toBe('monitoring-2026-01-02-0304.json')
  })
})
