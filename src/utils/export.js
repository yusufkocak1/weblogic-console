/**
 * Saving what is on screen to a file.
 *
 * A table in a console is often the answer to somebody else's question — an
 * audit, a capacity review, a ticket — and retyping it is where mistakes come
 * from. Every table can therefore be saved as CSV for a spreadsheet, or as JSON
 * for a script, with exactly the rows the filter has left showing.
 */

/** RFC 4180: quote anything containing a comma, quote or newline. */
function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * @param {{key: string, label: string}[]} columns the columns to keep, in order
 * @param {object[]} rows
 */
export function toCsv(columns, rows) {
  const wanted = columns.filter((column) => column.key && column.label !== '')
  const head = wanted.map((column) => csvCell(column.label)).join(',')
  const body = rows.map((row) => wanted.map((column) => csvCell(row?.[column.key])).join(','))
  // A BOM so Excel opens UTF-8 correctly, and CRLF because that is what
  // spreadsheet software expects from a .csv.
  return '﻿' + [head, ...body].join('\r\n') + '\r\n'
}

export function toJson(columns, rows) {
  const keys = columns.filter((column) => column.key && column.label !== '').map((column) => column.key)
  return JSON.stringify(
    rows.map((row) => Object.fromEntries(keys.map((key) => [key, row?.[key] ?? null]))),
    null,
    2,
  )
}

/** Hands the browser a file to save. Nothing leaves the machine. */
export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `servers-2026-09-04-1432.csv` — sortable, and unique enough per download. */
export function timestampedName(base, extension) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${base}-${stamp}.${extension}`
}

export function downloadCsv(base, columns, rows) {
  download(timestampedName(base, 'csv'), toCsv(columns, rows), 'text/csv;charset=utf-8')
}

export function downloadJson(base, columns, rows) {
  download(timestampedName(base, 'json'), toJson(columns, rows), 'application/json;charset=utf-8')
}
