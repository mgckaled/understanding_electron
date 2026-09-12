import { readFileSync } from 'node:fs'
import { UpstreamError } from '@core/ai/types'
import { fetchLibraryContext, searchLibraries } from './client'
import type { Context7Fetch, HttpResponse } from './types'

function fixtureText(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8')
}

function reply(
  body: string,
  init?: { status?: number; headers?: Record<string, string> }
): HttpResponse {
  const headers = init?.headers ?? {}
  return {
    status: init?.status ?? 200,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body
  }
}

// Every test injects this. A call reaching the real service would spend the
// monthly quota, so reaching the network is itself the failure (D23A.9).
function stub(response: HttpResponse): { fetchFn: Context7Fetch; urls: string[] } {
  const urls: string[] = []
  return {
    urls,
    fetchFn: async (url) => {
      if (url.includes('context7.com')) throw new Error(`o teste chamou a API real: ${url}`)
      urls.push(url)
      return response
    }
  }
}

const BASE = 'https://stub.invalid/api/v2'

function deps(
  response: HttpResponse,
  apiKey?: string
): ReturnType<typeof stub> & { baseUrl: string; apiKey?: string } {
  return { ...stub(response), baseUrl: BASE, apiKey }
}

describe('searchLibraries', () => {
  it('asks with the query as written and answers ordered candidates', async () => {
    const d = deps(reply(fixtureText('search-tanstack-query')))

    const outcome = await searchLibraries('tanstack query', d)

    expect(d.urls[0]).toBe(`${BASE}/libs/search?query=tanstack+query`)
    expect(outcome.status).toBe('found')
    if (outcome.status !== 'found') return
    expect(outcome.candidates).toHaveLength(5)
    expect(outcome.candidates[0].benchmarkScore).toBeGreaterThanOrEqual(
      outcome.candidates[4].benchmarkScore
    )
  })

  it('reads a 404 as a screen state, never as a service failure', async () => {
    const outcome = await searchLibraries(
      'xqzvwrt',
      deps(reply(fixtureText('search-no-libraries-404'), { status: 404 }))
    )

    expect(outcome).toEqual({
      status: 'no-libraries',
      message: 'No libraries found for "xqzvwrt". Try a different search term.'
    })
  })

  it('reads an empty result list the same way as a 404', async () => {
    const outcome = await searchLibraries('nada', deps(reply('{"results":[]}')))

    expect(outcome.status).toBe('no-libraries')
  })

  it('sends no authorization header when there is no key', async () => {
    const d = deps(reply(fixtureText('search-unpdf')))
    let sent: Record<string, string> = {}
    const spied: Context7Fetch = async (url, init) => {
      sent = init.headers
      return d.fetchFn(url, init)
    }

    await searchLibraries('unpdf', { ...d, fetchFn: spied })

    expect(sent.authorization).toBeUndefined()
    expect(sent.accept).toBe('application/json')
  })

  it('sends the key as a bearer token when there is one', async () => {
    const d = deps(reply(fixtureText('search-unpdf')), 'ctx7sk-abc')
    let sent: Record<string, string> = {}
    const spied: Context7Fetch = async (url, init) => {
      sent = init.headers
      return d.fetchFn(url, init)
    }

    await searchLibraries('unpdf', { ...d, fetchFn: spied })

    expect(sent.authorization).toBe('Bearer ctx7sk-abc')
  })
})

describe('fetchLibraryContext', () => {
  const args = { libraryId: '/tanstack/query', query: 'invalidar cache' }

  it('asks for json and for the reranked answer', async () => {
    const d = deps(reply(fixtureText('context-tanstack-query')))

    const outcome = await fetchLibraryContext(args, d)

    expect(d.urls[0]).toContain('libraryId=%2Ftanstack%2Fquery')
    expect(d.urls[0]).toContain('type=json')
    expect(d.urls[0]).toContain('fast=false')
    expect(outcome.status).toBe('ready')
    if (outcome.status !== 'ready') return
    expect(outcome.docs.snippets).toHaveLength(3)
    expect(outcome.docs.rules).toBeNull()
  })

  it('pins the version by appending it to the library id', async () => {
    const d = deps(reply(fixtureText('context-tanstack-query')))

    await fetchLibraryContext({ ...args, version: 'v5.90.3' }, d)

    expect(d.urls[0]).toContain('libraryId=%2Ftanstack%2Fquery%2Fv5.90.3')
  })

  it('answers empty when the library exists but nothing matched', async () => {
    const outcome = await fetchLibraryContext(
      args,
      deps(reply('{"codeSnippets":[],"infoSnippets":[]}'))
    )

    expect(outcome).toEqual({ status: 'empty' })
  })

  it('reads a 202 as still indexing, carrying the state it reported', async () => {
    const outcome = await fetchLibraryContext(
      args,
      deps(reply('{"state":"parsing"}', { status: 202 }))
    )

    expect(outcome).toEqual({ status: 'indexing', state: 'parsing' })
  })

  it('reads a 404 as a library that is gone, not as a failure', async () => {
    const outcome = await fetchLibraryContext(
      args,
      deps(reply('{"error":"library_not_found"}', { status: 404 }))
    )

    expect(outcome).toEqual({ status: 'library-not-found' })
  })
})

describe('o que falha de verdade', () => {
  const args = { libraryId: '/tanstack/query', query: 'x' }

  it('names the day the quota comes back, and the way out, when there is no key', async () => {
    const response = reply('{"error":"rate_limited"}', {
      status: 429,
      headers: { 'ratelimit-limit': '200', 'ratelimit-reset': '1790812800' }
    })

    const error = await fetchLibraryContext(args, deps(response)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UpstreamError)
    expect((error as UpstreamError).status).toBe(429)
    expect((error as UpstreamError).message).toContain('As 200 consultas mensais gratuitas')
    // 2026-10-01T00:00:00Z is the evening of the 30th here: naming the UTC
    // date would send the user away for a day of quota they already have.
    expect((error as UpstreamError).message).toContain(
      new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(1790812800 * 1000))
    )
    expect((error as UpstreamError).message).toContain('Uma chave do Context7 aumenta o limite.')
  })

  it('offers no way out on the same status when a key is already in use', async () => {
    const response = reply('{"error":"rate_limited"}', {
      status: 429,
      headers: { 'ratelimit-limit': '1000', 'ratelimit-reset': '1790812800' }
    })

    const error = await fetchLibraryContext(args, deps(response, 'ctx7sk-abc')).catch(
      (e: unknown) => e
    )

    expect((error as UpstreamError).message).toContain('da sua chave do Context7')
    expect((error as UpstreamError).message).not.toContain('aumenta o limite')
  })

  it('falls back to the turn of the month when the reset header is missing', async () => {
    const error = await fetchLibraryContext(args, deps(reply('{}', { status: 429 }))).catch(
      (e: unknown) => e
    )

    expect((error as UpstreamError).message).toContain('na virada do mês')
  })

  it.each([401, 403, 500, 503])('classifies %i as an upstream failure', async (status) => {
    const error = await fetchLibraryContext(
      args,
      deps(reply('{"error":"nope"}', { status }))
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UpstreamError)
    expect((error as UpstreamError).status).toBe(status)
  })

  it('refuses a 200 that is not json instead of answering an empty result', async () => {
    const error = await fetchLibraryContext(args, deps(reply('<html>oops</html>'))).catch(
      (e: unknown) => e
    )

    expect(error).toBeInstanceOf(UpstreamError)
    expect((error as UpstreamError).message).toContain('formato inesperado')
  })

  it('lets the caller abort', async () => {
    const controller = new AbortController()
    const d = deps(reply('{}'))
    const aborting: Context7Fetch = async (_url, init) => {
      controller.abort()
      init.signal.throwIfAborted()
      return reply('{}')
    }

    await expect(
      searchLibraries('x', { ...d, fetchFn: aborting, signal: controller.signal })
    ).rejects.toThrow()
  })
})

// D23I.9: the header is the only report of the quota there is — no endpoint
// answers it without spending a call — so the client hands it over for EVERY
// answer, not only the ones that produce an outcome.
describe('a cota no header', () => {
  const HEADERS = {
    'ratelimit-limit': '1000',
    'ratelimit-remaining': '146',
    'ratelimit-reset': '1790000000'
  }

  it('hands over what a good answer reported', async () => {
    const seen: unknown[] = []
    const d = { ...deps(reply(fixtureText('search-tanstack-query'), { headers: HEADERS })) }

    await searchLibraries('tanstack query', { ...d, onQuota: (q) => seen.push(q) })

    expect(seen).toEqual([{ limit: 1000, remaining: 146, resetAt: 1790000000 }])
  })

  it('hands over the 429 too, which is where the number matters most', async () => {
    const seen: unknown[] = []
    const d = deps(reply('{}', { status: 429, headers: { ...HEADERS, 'ratelimit-remaining': '0' } }))

    await searchLibraries('tanstack query', { ...d, onQuota: (q) => seen.push(q) }).catch(
      (error: unknown) => error
    )

    expect(seen).toHaveLength(1)
    expect((seen[0] as { remaining: number }).remaining).toBe(0)
  })

  it('reports nulls rather than zeros when the header is absent', async () => {
    const seen: { limit: number | null }[] = []
    const d = deps(reply(fixtureText('search-tanstack-query')))

    await searchLibraries('tanstack query', { ...d, onQuota: (q) => seen.push(q) })

    expect(seen[0]).toEqual({ limit: null, remaining: null, resetAt: null })
  })
})
