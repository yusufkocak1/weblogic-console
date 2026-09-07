import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { del, get, history, post, postForm, search, session, setActiveConnectionId, WlsError } from '@/api/client'

/** A fetch answer, in the two shapes the console has to read. */
const jsonResponse = (status, payload) => ({
  ok: status < 400,
  status,
  headers: { get: () => 'application/json; charset=utf-8' },
  json: () => Promise.resolve(payload),
  text: () => Promise.resolve(JSON.stringify(payload)),
})

const textResponse = (status, body) => ({
  ok: status < 400,
  status,
  headers: { get: () => 'text/html' },
  json: () => Promise.reject(new Error('not json')),
  text: () => Promise.resolve(body),
})

const noContent = () => ({ ok: true, status: 204, headers: { get: () => null }, text: () => Promise.resolve('') })

let fetchMock

beforeEach(() => {
  setActiveConnectionId(null)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1]

describe('WlsError', () => {
  it('knows a dead console session from a WebLogic refusal', () => {
    expect(new WlsError('x', { status: 401 }).isAuthError).toBe(true)
    expect(new WlsError('x', { status: 403 }).isForbidden).toBe(true)
    expect(new WlsError('x', { status: 500 }).isAuthError).toBe(false)
  })

  it('reads as one sentence, skipping the parts that are empty', () => {
    const error = new WlsError('Failed', { detail: 'because', messages: ['and also'] })
    expect(error.fullText).toBe('Failed — because — and also')
    expect(new WlsError('Failed').fullText).toBe('Failed')
  })
})

describe('building the request', () => {
  it('routes a WebLogic call through the local proxy', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { name: 'ms1' }))
    await get('/domainConfig/servers/ms1')
    expect(lastCall()[0]).toBe('/api/wls/domainConfig/servers/ms1')
  })

  it('adds a leading slash to a path given without one', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('domainConfig')
    expect(lastCall()[0]).toBe('/api/wls/domainConfig')
  })

  it('writes parameters as a query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/domainConfig', { links: 'none', fields: 'name' })
    expect(lastCall()[0]).toBe('/api/wls/domainConfig?links=none&fields=name')
  })

  it('joins an array parameter with commas, the way the REST API wants it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/domainConfig', { fields: ['name', 'state'] })
    expect(lastCall()[0]).toBe('/api/wls/domainConfig?fields=name%2Cstate')
  })

  it('leaves out a parameter that was not set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/domainConfig', { links: 'none', fields: undefined, filter: null, q: '' })
    expect(lastCall()[0]).toBe('/api/wls/domainConfig?links=none')
  })

  it('keeps a parameter that is deliberately zero or false', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/x', { since: 0, expanded: false })
    expect(lastCall()[0]).toBe('/api/wls/x?since=0&expanded=false')
  })

  it('sends credentials so the session cookie goes with it, and never caches', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/x')
    expect(lastCall()[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })

  it('sends a JSON body with a JSON content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await post('/x', { a: 1 })
    expect(lastCall()[1].body).toBe('{"a":1}')
    expect(lastCall()[1].headers['Content-Type']).toBe('application/json')
  })

  it('posts an empty object rather than nothing, which WebLogic requires', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await post('/x')
    expect(lastCall()[1].body).toBe('{}')
  })

  it('sends no body at all on a delete', async () => {
    fetchMock.mockResolvedValue(noContent())
    await del('/x')
    expect(lastCall()[1].body).toBeUndefined()
    expect(lastCall()[1].headers['Content-Type']).toBeUndefined()
  })

  it('lets the browser write the content type of a multipart upload', async () => {
    // Overriding it drops the boundary and makes the body unparseable.
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    const form = new FormData()
    await postForm('/edit/appDeployments', form)
    expect(lastCall()[1].headers['Content-Type']).toBeUndefined()
    expect(lastCall()[1].body).toBe(form)
  })

  it('posts a bulk read to the tree’s own search endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await search('domainRuntime', { fields: [] })
    expect(lastCall()[0]).toBe('/api/wls/domainRuntime/search')
    expect(lastCall()[1].method).toBe('POST')
  })
})

describe('pinning a call to one connection', () => {
  it('sends no connection header until one is active', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/x')
    expect(lastCall()[1].headers['X-Connection-Id']).toBeUndefined()
  })

  it('names the active connection on every call', async () => {
    setActiveConnectionId('conn-1')
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/x')
    expect(lastCall()[1].headers['X-Connection-Id']).toBe('conn-1')
  })

  it('lets one call go to another domain, which is how Compare reads two', async () => {
    setActiveConnectionId('conn-1')
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await get('/x', null, { connectionId: 'conn-2' })
    expect(lastCall()[1].headers['X-Connection-Id']).toBe('conn-2')
  })

  it('pins a history poll the same way', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { samples: [] }))
    await history(0, { connectionId: 'conn-2' })
    expect(lastCall()[0]).toBe('/api/history')
    expect(lastCall()[1].headers['X-Connection-Id']).toBe('conn-2')
  })

  it('asks only for what is newer than the timestamp it was given', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { samples: [] }))
    await history(1_700_000_000_000)
    expect(lastCall()[0]).toBe('/api/history?since=1700000000000')
  })
})

describe('reading the answer', () => {
  it('parses a JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { name: 'ms1' }))
    await expect(get('/x')).resolves.toEqual({ name: 'ms1' })
  })

  it('is null for a 204, which carries nothing', async () => {
    fetchMock.mockResolvedValue(noContent())
    await expect(del('/x')).resolves.toBeNull()
  })

  it('hands back the text of a non-JSON answer', async () => {
    fetchMock.mockResolvedValue(textResponse(200, 'plain text'))
    await expect(get('/x')).resolves.toBe('plain text')
  })

  it('does not fail on a body that claims to be JSON and is not', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.reject(new Error('unexpected token')),
    })
    await expect(get('/x')).resolves.toBeNull()
  })
})

describe('reading a failure', () => {
  const failing = async (response) => {
    fetchMock.mockResolvedValue(response)
    return get('/x').catch((err) => err)
  }

  it('reads the backend’s own error shape', async () => {
    const error = await failing(jsonResponse(500, { status: 500, title: 'Console backend error', detail: 'boom' }))
    expect(error).toBeInstanceOf(WlsError)
    expect(error).toMatchObject({ status: 500, message: 'Console backend error', detail: 'boom' })
  })

  it('reads WebLogic’s own error shape, messages and all', async () => {
    const error = await failing(
      jsonResponse(400, { title: 'Bad request', messages: [{ message: 'listenPort must be a number' }] }),
    )
    expect(error.messages).toEqual(['listenPort must be a number'])
    expect(error.fullText).toContain('listenPort must be a number')
  })

  it('accepts a message list of plain strings too', async () => {
    const error = await failing(jsonResponse(400, { messages: ['first', 'second'] }))
    expect(error.messages).toEqual(['first', 'second'])
    // With no title of its own, the first message becomes the sentence.
    expect(error.message).toBe('first')
  })

  it('says what a 401 means, which is that the console session is gone', async () => {
    const error = await failing(jsonResponse(401, {}))
    expect(error.message).toBe('Not connected')
    expect(error.isAuthError).toBe(true)
  })

  it('says what a 403 means in the console’s own words', async () => {
    // WebLogic answers "Forbidden", or a security-policy sentence that reads
    // like a bug; neither tells an operator what to do next.
    const error = await failing(jsonResponse(403, { title: 'Not authorized for this operation' }))
    expect(error.message).toBe('You are not authorized to do this')
    expect(error.detail).toContain('domain administrator')
    expect(error.isForbidden).toBe(true)
  })

  it('keeps whatever the server did say underneath a 403', async () => {
    const error = await failing(jsonResponse(403, { title: 'Access denied', detail: 'user lacks Admin role' }))
    expect(error.message).toBe('You are not authorized to do this')
    expect(error.detail).toBe('Access denied — user lacks Admin role')
  })

  it('does not repeat itself when the server said the same thing twice', async () => {
    const error = await failing(jsonResponse(403, { title: 'Access denied', detail: 'Access denied' }))
    expect(error.detail).toBe('Access denied')
  })

  it('names the status when the server explained nothing at all', async () => {
    const error = await failing(jsonResponse(503, {}))
    expect(error.message).toBe('Request failed with status 503')
  })

  it('does not repeat a detail that is the same as the title', async () => {
    const error = await failing(jsonResponse(500, { title: 'boom', detail: 'boom' }))
    expect(error.detail).toBe('')
  })

  it('carries an HTML error body through as trimmed detail', async () => {
    const error = await failing(textResponse(502, '<html>Bad gateway</html>'))
    expect(error.status).toBe(502)
    expect(error.detail || error.message).toContain('Bad gateway')
  })

  it('says the backend is not running when the fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await get('/x').catch((err) => err)
    expect(error).toBeInstanceOf(WlsError)
    expect(error.message).toBe('The console backend is not responding')
    expect(error.detail).toContain('npm run dev')
  })

  it('lets a caller’s own cancellation through rather than dressing it up', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    const error = await get('/x', null, { signal: controller.signal }).catch((err) => err)
    expect(error.name).toBe('AbortError')
  })
})

describe('the console backend’s own endpoints', () => {
  it('reads the session with a short timeout, since it gates the whole UI', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { connected: false }))
    await session()
    expect(lastCall()[0]).toBe('/api/session')
  })
})
