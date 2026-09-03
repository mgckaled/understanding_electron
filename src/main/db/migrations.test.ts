import { DatabaseSync } from 'node:sqlite'
import { migrations } from './migrations'
import { migrate, openDatabase } from './open'

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

describe('schema v4', () => {
  // The rung is what carries old rows across, so the test has to climb: build a
  // v3 file, write a draft the way the app wrote them before E-2, then migrate.
  function withV3Draft(): DatabaseSync {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations.slice(0, 3))
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('c1', 'Vendas', 1000, 1000)
    db.prepare(
      'INSERT INTO drafts (id, conversation_id, source_message_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('d1', 'c1', 'm1', 'Vendas', 'Texto.', 1000, 1000)
    return db
  }

  it('reads a draft written before v4 as prose', () => {
    const db = withV3Draft()

    migrate(db, migrations)

    const row = db.prepare('SELECT kind, language FROM drafts WHERE id = ?').get('d1')
    expect(row?.['kind']).toBe('markdown')
    expect(row?.['language']).toBeNull()
    db.close()
  })

  it('climbs to the top of the ladder', () => {
    const db = withV3Draft()

    expect(migrate(db, migrations)).toBe(migrations.length)
    db.close()
  })
})

describe('schema v5', () => {
  // A message written before v5 has no prompt_tokens/eval_tokens columns to
  // read from — they must come back NULL, which toMessage (rows.ts) already
  // treats as an absent key, same discipline as `model`/`stopped`.
  function withV4Message(): DatabaseSync {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations.slice(0, 4))
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('c1', 'Vendas', 1000, 1000)
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('m1', 'c1', 'assistant', '[]', 1000)
    return db
  }

  it('reads a message written before v5 with no token counts at all', () => {
    const db = withV4Message()

    migrate(db, migrations)

    const row = db.prepare('SELECT prompt_tokens, eval_tokens FROM messages WHERE id = ?').get('m1')
    expect(row?.['prompt_tokens']).toBeNull()
    expect(row?.['eval_tokens']).toBeNull()
    db.close()
  })

  it('climbs to the top of the ladder', () => {
    const db = withV4Message()

    expect(migrate(db, migrations)).toBe(migrations.length)
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
