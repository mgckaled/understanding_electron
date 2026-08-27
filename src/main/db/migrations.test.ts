import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from './open'

function withConversation(): DatabaseSync {
  const db = openDatabase(':memory:')
  db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run('c1', 'Vendas', 1000, 1000)
  db.prepare(
    'INSERT INTO messages (id, conversation_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run('m1', 'c1', 'user', '[]', 1000)
  return db
}

describe('schema v3', () => {
  function withDraft(): DatabaseSync {
    const db = withConversation()
    db.prepare(
      `INSERT INTO drafts
         (id, conversation_id, source_message_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('d1', 'c1', 'm1', 'Vendas', '# Vendas', 1000, 1000)
    return db
  }

  it('cascades a conversation delete down to its drafts', () => {
    const db = withDraft()

    db.prepare('DELETE FROM conversations WHERE id = ?').run('c1')

    expect(db.prepare('SELECT COUNT(*) AS n FROM drafts').get()?.['n']).toBe(0)
    db.close()
  })

  // DE1A.2: source_message_id is provenance, not ownership. Deleting the answer
  // must not take the text the user has been editing.
  it('keeps a draft whose source message was deleted', () => {
    const db = withDraft()

    db.prepare('DELETE FROM messages WHERE id = ?').run('m1')

    expect(db.prepare('SELECT COUNT(*) AS n FROM drafts').get()?.['n']).toBe(1)
    db.close()
  })
})

describe('schema v1', () => {
  it('cascades a conversation delete down to its messages', () => {
    const db = withConversation()

    db.prepare('DELETE FROM conversations WHERE id = ?').run('c1')

    expect(db.prepare('SELECT COUNT(*) AS n FROM messages').get()?.['n']).toBe(0)
    db.close()
  })

  it('rejects a message pointing at no conversation', () => {
    // node:sqlite enables foreign_keys by default — the opposite of raw SQLite,
    // where it is 0. Asserted because the easy mistake is assuming it is off and
    // writing a test that inserts an orphan row on purpose.
    const db = withConversation()

    expect(() =>
      db
        .prepare(
          'INSERT INTO messages (id, conversation_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run('m2', 'ghost', 'user', '[]', 1000)
    ).toThrow(/FOREIGN KEY/i)
    db.close()
  })

  it('defaults conversation settings to an empty JSON object', () => {
    // Plano 15 writes num_ctx, temperature and the system prompt in here; the
    // default is what lets it do that without a migration or a null check.
    const db = withConversation()

    expect(db.prepare('SELECT settings FROM conversations').get()?.['settings']).toBe('{}')
    db.close()
  })

  it('indexes the two orderings the app actually reads by', () => {
    const db = openDatabase(':memory:')

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => String(row['name']))

    // Without these two the sidebar list and the transcript read are full
    // scans — which is also the premise of the "microseconds" argument in D14.8.
    expect(indexes).toContain('messages_by_conversation')
    expect(indexes).toContain('conversations_by_updated')
    db.close()
  })

  it('stores a millisecond timestamp as a number, not a BigInt', () => {
    // Date.now() crosses without conversion, and the renderer keeps minting it
    // (D14.5). A BigInt coming back would break every comparison downstream.
    const db = withConversation()

    expect(typeof db.prepare('SELECT created_at FROM conversations').get()?.['created_at']).toBe(
      'number'
    )
    db.close()
  })
})
