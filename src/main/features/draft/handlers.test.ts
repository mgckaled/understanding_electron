import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../../db/open'
import { createDraft, listDrafts, removeDraft } from './handlers'

function withConversation(): DatabaseSync {
  const db = openDatabase(':memory:')
  db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run('c1', 'Vendas', 1000, 1000)
  return db
}

function draft(id: string, createdAt: number, conversationId = 'c1'): void {
  createDraft(
    {
      id,
      conversationId,
      sourceMessageId: `m-${id}`,
      title: `Rascunho ${id}`,
      content: '# Vendas\n\nTexto.',
      createdAt
    },
    db
  )
}

let db: DatabaseSync

beforeEach(() => {
  db = withConversation()
})

afterEach(() => db.close())

describe('draft handlers', () => {
  it('stores what it receives and reads it back whole', () => {
    draft('d1', 1000)

    expect(listDrafts({ conversationId: 'c1' }, db)).toEqual([
      {
        id: 'd1',
        conversationId: 'c1',
        sourceMessageId: 'm-d1',
        title: 'Rascunho d1',
        content: '# Vendas\n\nTexto.',
        createdAt: 1000,
        updatedAt: 1000
      }
    ])
  })

  it('lists oldest first', () => {
    draft('d2', 2000)
    draft('d1', 1000)

    expect(listDrafts({ conversationId: 'c1' }, db).map((one) => one.id)).toEqual(['d1', 'd2'])
  })

  it('scopes the list to one conversation', () => {
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('c2', 'Outra', 1000, 1000)
    draft('d1', 1000)
    draft('d2', 1000, 'c2')

    expect(listDrafts({ conversationId: 'c1' }, db).map((one) => one.id)).toEqual(['d1'])
  })

  it('has no drafts before any is created', () => {
    expect(listDrafts({ conversationId: 'c1' }, db)).toEqual([])
  })

  it('removes one draft and leaves the rest', () => {
    draft('d1', 1000)
    draft('d2', 2000)

    removeDraft({ id: 'd1' }, db)

    expect(listDrafts({ conversationId: 'c1' }, db).map((one) => one.id)).toEqual(['d2'])
  })

  // DE1A.5: absence is data, not an error — the DELETE's own `changes` swallows it.
  it('ignores a remove addressed to a draft that is already gone', () => {
    expect(() => removeDraft({ id: 'ghost' }, db)).not.toThrow()
  })
})
