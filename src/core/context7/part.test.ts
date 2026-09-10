import { describe, expect, it } from 'vitest'
import type { DocNote, DocSnippet, DocsResult } from '@shared/ipc'
import { docsPartFrom, noteTitle } from './part'

function snippet(key: string, title: string, tokens: number): DocSnippet {
  return {
    key,
    title,
    description: '',
    tokens,
    blocks: [{ language: 'ts', code: 'queryClient.invalidateQueries()' }],
    pageTitle: null,
    sourceUrl: null
  }
}

function note(key: string, breadcrumb: string | null, tokens: number): DocNote {
  return { key, breadcrumb, content: 'O cache é por chave.', tokens, sourceUrl: null }
}

const DOCS: DocsResult = {
  snippets: [snippet('a#0', 'invalidateQueries', 182), snippet('b#1', 'onSuccess', 96)],
  notes: [note('n#0', 'Reference > QueryClient', 22)],
  rules: null
}

const META = {
  id: 'part-1',
  libraryId: '/tanstack/query',
  libraryTitle: 'TanStack Query',
  version: null,
  query: 'invalidar cache'
}

describe('docsPartFrom', () => {
  it('keeps the checked snippets and notes', () => {
    const part = docsPartFrom({ ...META, docs: DOCS, offKeys: new Set() })

    expect(part.snippets.map((one) => one.key)).toEqual(['a#0', 'b#1'])
    expect(part.notes.map((one) => one.key)).toEqual(['n#0'])
    expect(part.omitted).toEqual([])
  })

  // The whole point of `omitted` (D23C.3): the transcript records the choice,
  // and recording the code alongside it would make re-marking an attached
  // consultation merely forbidden instead of unexpressable.
  it('records what was left out as title and cost, never the code', () => {
    const part = docsPartFrom({ ...META, docs: DOCS, offKeys: new Set(['b#1']) })

    expect(part.snippets.map((one) => one.key)).toEqual(['a#0'])
    expect(part.omitted).toEqual([{ key: 'b#1', kind: 'snippet', title: 'onSuccess', tokens: 96 }])
    expect(JSON.stringify(part.omitted)).not.toContain('invalidateQueries()')
  })

  it('addresses an omitted note by its trail', () => {
    const part = docsPartFrom({ ...META, docs: DOCS, offKeys: new Set(['n#0']) })

    expect(part.omitted).toEqual([
      { key: 'n#0', kind: 'note', title: 'Reference > QueryClient', tokens: 22 }
    ])
  })

  it('falls back when a note has no trail', () => {
    expect(noteTitle(note('n#1', null, 10))).toBe('sem trilha')
  })

  // Rules are shown and never sent (DM-17), so they do not follow the
  // selection: dropping them with the last unchecked snippet would end the
  // record of what the service tried to inject at the next app start (D23C.4).
  it('keeps the rules even when nothing was checked', () => {
    const rules = { global: [], libraryOwn: ['Use o hook oficial.'], libraryTeam: [] }
    const part = docsPartFrom({
      ...META,
      docs: { ...DOCS, rules },
      offKeys: new Set(['a#0', 'b#1', 'n#0'])
    })

    expect(part.snippets).toEqual([])
    expect(part.notes).toEqual([])
    expect(part.rules).toEqual(rules)
  })

  it('is enabled on arrival — turning it off belongs to the transcript', () => {
    expect(docsPartFrom({ ...META, docs: DOCS, offKeys: new Set() }).enabled).toBe(true)
  })
})
