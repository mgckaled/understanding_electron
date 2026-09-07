import { UpstreamError } from '@core/ai/types'
import type { Context7Fetch, HttpResponse } from '@core/context7/types'
import { fetchDocs, searchDocs } from './handlers'

// Hand-built, never the 23-A fixtures: what this level proves is the wrapping,
// and reaching across to core/'s recordings would make a parse change fail
// here too, hiding which layer broke (D23B.8).
function reply(body: string, status = 200): HttpResponse {
  return { status, headers: { get: () => null }, text: async () => body }
}

const FOUND = JSON.stringify({
  results: [
    {
      id: '/tanstack/query',
      title: 'TanStack Query',
      description: '',
      branch: 'main',
      lastUpdateDate: '2026-09-01',
      state: 'finalized',
      totalTokens: 10,
      totalSnippets: 2,
      stars: 45,
      trustScore: 10,
      benchmarkScore: 89.5,
      versions: []
    }
  ]
})

type Stub = {
  sent: { url: string; headers: Record<string, string> }[]
  fetchFn: Context7Fetch
  getApiKey: () => string | null
}

function deps(response: HttpResponse | (() => never), apiKey: string | null = null): Stub {
  const sent: { url: string; headers: Record<string, string> }[] = []
  // No guard against the real host here, unlike the level-1 tests: at this
  // level the production URL is exactly what must show up, and nothing
  // reaches the network because fetchFn is the seam (D23A.1).
  const fetchFn: Context7Fetch = async (url, init) => {
    sent.push({ url, headers: init.headers })
    if (typeof response === 'function') return response()
    return response
  }
  return { sent, fetchFn, getApiKey: () => apiKey }
}

describe('searchDocs', () => {
  it('wraps a hit in ok', async () => {
    const d = deps(reply(FOUND))

    const result = await searchDocs({ query: 'tanstack query' }, d)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('found')
  })

  it('keeps a miss inside the value, never as an AppError', async () => {
    const d = deps(reply('{"error":"no_libraries_found","message":"nada"}', 404))

    const result = await searchDocs({ query: 'xqzvwrt' }, d)

    expect(result).toEqual({ ok: true, value: { status: 'no-libraries', message: 'nada' } })
  })

  it('hands the key to the client, so the 429 text knows which one it is', async () => {
    const d = deps(reply(FOUND), 'ctx7sk-abc')

    await searchDocs({ query: 'x' }, d)

    expect(d.sent[0]!.headers.authorization).toBe('Bearer ctx7sk-abc')
  })

  it('asks the production service, since the handler passes no baseUrl', async () => {
    const d = deps(reply(FOUND))

    await searchDocs({ query: 'x' }, d)

    expect(d.sent[0]!.url.startsWith('https://context7.com/api/v2/libs/search')).toBe(true)
  })

  it('sends no authorization header when no key is stored', async () => {
    const d = deps(reply(FOUND))

    await searchDocs({ query: 'x' }, d)

    expect(d.sent[0]!.headers.authorization).toBeUndefined()
  })
})

describe('fetchDocs', () => {
  const args = { libraryId: '/tanstack/query', query: 'invalidar cache' }

  it('keeps every screen state inside the value', async () => {
    const indexing = await fetchDocs(args, deps(reply('{"state":"parsing"}', 202)))
    const gone = await fetchDocs(args, deps(reply('{}', 404)))
    const empty = await fetchDocs(args, deps(reply('{"codeSnippets":[],"infoSnippets":[]}')))

    expect(indexing).toEqual({ ok: true, value: { status: 'indexing', state: 'parsing' } })
    expect(gone).toEqual({ ok: true, value: { status: 'library-not-found' } })
    expect(empty).toEqual({ ok: true, value: { status: 'empty' } })
  })

  it('pins the version the caller asked for', async () => {
    const d = deps(reply('{"codeSnippets":[],"infoSnippets":[]}'))

    await fetchDocs({ ...args, version: 'v5.90.3' }, d)

    expect(d.sent[0]!.url).toContain('%2Ftanstack%2Fquery%2Fv5.90.3')
  })
})

describe('o que vira AppError', () => {
  const args = { libraryId: '/tanstack/query', query: 'x' }

  it('classifies an UpstreamError as upstream, carrying the client text', async () => {
    const d = deps(reply('{"error":"rate_limited"}', 429))

    const result = await fetchDocs(args, d)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('upstream')
    expect(result.error).toMatchObject({ service: 'context7', status: 429 })
  })

  it('classifies a fetch that never landed as unavailable', async () => {
    const d = deps(() => {
      throw new TypeError('fetch failed')
    })

    const result = await searchDocs({ query: 'x' }, d)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unavailable', service: 'context7', hint: expect.any(String) }
    })
  })

  it('tells the 30 s ceiling apart from an outage', async () => {
    const d = deps(() => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })

    const result = await searchDocs({ query: 'x' }, d)

    expect(result).toEqual({ ok: false, error: { kind: 'timeout', afterMs: 30_000 } })
  })

  it('never lets an UpstreamError escape as an exception', async () => {
    const d = deps(() => {
      throw new UpstreamError(500, 'boom')
    })

    await expect(searchDocs({ query: 'x' }, d)).resolves.toMatchObject({ ok: false })
  })
})
