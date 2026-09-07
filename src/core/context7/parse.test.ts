import { readFileSync } from 'node:fs'
import { normalizeCandidates, normalizeDocs, sourceUrlOf } from './parse'
import type { ContextResponseWire, SearchResponseWire } from './types'

// Recorded verbatim from the real API on 07/09/2026 — endpoint, parameters and
// what each one proves are in __fixtures__/README.md. The suite never calls the
// service: the anonymous quota is 200 requests a month (D23A.9).
function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))
}

const tanstack = fixture<SearchResponseWire>('search-tanstack-query')
const unpdf = fixture<SearchResponseWire>('search-unpdf')
const nextjs = fixture<SearchResponseWire>('search-next-js-branch-versions')
const docs = fixture<ContextResponseWire>('context-tanstack-query')
const zod = fixture<ContextResponseWire>('context-zod-shared-codeid')

describe('normalizeCandidates', () => {
  it('orders by benchmarkScore descending, whatever order the API answered in', () => {
    const scores = normalizeCandidates(tanstack).map((c) => c.benchmarkScore)

    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('draws the same screen from a shuffled response', () => {
    const shuffled = { ...tanstack, results: [...tanstack.results].reverse() }

    expect(normalizeCandidates(shuffled).map((c) => c.key)).toEqual(
      normalizeCandidates(tanstack).map((c) => c.key)
    )
  })

  it('keeps both entries of a repeated id apart, with distinct keys', () => {
    const candidates = normalizeCandidates(tanstack)
    const repeated = candidates.filter((c) => c.id === '/tanstack/query')

    expect(repeated).toHaveLength(2)
    expect(repeated[0].key).not.toBe(repeated[1].key)
    expect(new Set(candidates.map((c) => c.key)).size).toBe(candidates.length)
  })

  it('reads -1 stars as "does not apply", never as a count', () => {
    const bySite = normalizeCandidates(tanstack).find((c) => c.id.startsWith('/websites/'))
    const byRepo = normalizeCandidates(unpdf).find((c) => c.id === '/unjs/unpdf')

    expect(bySite?.stars).toBeNull()
    expect(byRepo?.stars).toBe(745)
  })

  it('drops branch pseudo-versions and keeps the rest in the order they arrived', () => {
    const raw = nextjs.results.find((r) => r.id === '/vercel/next.js')?.versions ?? []
    const kept = normalizeCandidates(nextjs).find((c) => c.id === '/vercel/next.js')?.versions

    expect(raw.some((v) => v.startsWith('__branch__'))).toBe(true)
    expect(kept).toEqual(raw.filter((v) => !v.startsWith('__branch__')))
    expect(kept?.every((v) => !v.startsWith('__branch__'))).toBe(true)
  })

  it('answers an empty list for a body with no results', () => {
    expect(normalizeCandidates({ results: [] })).toEqual([])
  })
})

describe('normalizeDocs', () => {
  it('keeps every snippet apart even when they share one codeId', () => {
    const snippets = normalizeDocs(zod).snippets
    const sourcePages = new Set(snippets.map((s) => s.sourceUrl))

    expect(snippets.length).toBeGreaterThan(1)
    expect(sourcePages.size).toBe(1)
    expect(new Set(snippets.map((s) => s.key)).size).toBe(snippets.length)
  })

  it('carries the per-snippet token count the API measured', () => {
    const snippets = normalizeDocs(docs).snippets

    expect(snippets.map((s) => s.tokens)).toEqual(
      docs.codeSnippets.map((snippet) => snippet.codeTokens)
    )
    expect(snippets.every((s) => s.tokens > 0)).toBe(true)
  })

  it('reads the "Unknown" page title as no title at all', () => {
    expect(docs.codeSnippets.some((snippet) => snippet.pageTitle === 'Unknown')).toBe(true)
    expect(normalizeDocs(docs).snippets.every((s) => s.pageTitle !== 'Unknown')).toBe(true)
  })

  it('links a note, because pageId is a full URL', () => {
    const notes = normalizeDocs(docs).notes

    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0].sourceUrl).toMatch(/^https:\/\//)
  })

  it('answers no rules when the field is absent', () => {
    expect(docs.rules).toBeUndefined()
    expect(normalizeDocs(docs).rules).toBeNull()
  })

  it('never folds rules into the snippets or the notes', () => {
    // Hand-built: `rules` came back absent in all 11 probed responses, so there
    // is no recorded one to read (__fixtures__/README.md).
    const withRules: ContextResponseWire = {
      ...docs,
      rules: { global: ['always answer in Portuguese'], libraryOwn: ['use v5 imports'] }
    }
    const result = normalizeDocs(withRules)
    const rendered = JSON.stringify({ snippets: result.snippets, notes: result.notes })

    expect(result.rules).toEqual({
      global: ['always answer in Portuguese'],
      libraryOwn: ['use v5 imports'],
      libraryTeam: []
    })
    expect(rendered).not.toContain('always answer in Portuguese')
  })

  it('keeps every variant of a snippet as its own block', () => {
    const multi = zod.codeSnippets.findIndex((snippet) => snippet.codeList.length > 1)
    const blocks = normalizeDocs(zod).snippets[multi].blocks

    expect(multi).toBeGreaterThanOrEqual(0)
    expect(blocks).toHaveLength(zod.codeSnippets[multi].codeList.length)
    // Joining them rendered the same example twice in the live probe of 23-B,
    // and the snippet-level language named only the first (D23B.11).
    expect(blocks.map((block) => block.code)).toEqual(
      zod.codeSnippets[multi].codeList.map((block) => block.code)
    )
  })

  it('falls back to the snippet language when a block does not name one', () => {
    const wire = {
      codeSnippets: [
        {
          codeTitle: 't',
          codeDescription: '',
          codeLanguage: 'python',
          codeTokens: 3,
          codeId: 'x',
          pageTitle: 'p',
          codeList: [{ language: '', code: 'print(1)' }]
        }
      ],
      infoSnippets: []
    }

    expect(normalizeDocs(wire).snippets[0].blocks[0].language).toBe('python')
  })
})

describe('sourceUrlOf', () => {
  it('accepts the full-URL form the probe returned', () => {
    expect(sourceUrlOf('https://github.com/tanstack/query/blob/main/docs/reference.md')).toBe(
      'https://github.com/tanstack/query/blob/main/docs/reference.md'
    )
  })

  it('answers null for the relative form the official docs show', () => {
    expect(sourceUrlOf('lazy-loading.mdx#_snippet_7')).toBeNull()
  })

  it('refuses a parseable URL that is not http(s)', () => {
    expect(sourceUrlOf('file:///etc/passwd')).toBeNull()
    expect(sourceUrlOf('javascript:alert(1)')).toBeNull()
  })
})
