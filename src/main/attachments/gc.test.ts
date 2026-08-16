import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../db/open'
import {
  appendMessage,
  createConversation,
  removeConversation
} from '../features/conversation/handlers'
import { collectOrphanedAttachments, referencedHashes } from './gc'

// Keyed by db, not a module-level Set: each test opens its OWN ':memory:'
// database, and a set shared across tests would skip creating a conversation
// id reused in a later test against a different, empty database.
const seededConversations = new WeakMap<DatabaseSync, Set<string>>()

function withMessage(
  db: DatabaseSync,
  conversationId: string,
  messageId: string,
  hash: string | null
): void {
  const seeded = seededConversations.get(db) ?? new Set<string>()
  seededConversations.set(db, seeded)
  if (!seeded.has(conversationId)) {
    createConversation({ id: conversationId, title: 'c', createdAt: 1 }, db)
    seeded.add(conversationId)
  }
  appendMessage(
    {
      conversationId,
      message: {
        id: messageId,
        role: 'user',
        parts:
          hash === null
            ? [{ kind: 'text', text: 'oi' }]
            : [
                {
                  kind: 'dataset',
                  hash,
                  fileName: 'a.csv',
                  delimiter: ',',
                  columns: ['id'],
                  rowCount: 1
                }
              ],
        createdAt: 1
      }
    },
    db
  )
}

describe('referencedHashes', () => {
  it('collects the distinct hash of every dataset part across all conversations', () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'h1')
    withMessage(db, 'c2', 'm2', 'h2')
    withMessage(db, 'c2', 'm3', 'h1') // same file, second conversation

    expect(referencedHashes(db)).toEqual(new Set(['h1', 'h2']))
    db.close()
  })

  it('ignores messages with no dataset part', () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', null)

    expect(referencedHashes(db)).toEqual(new Set())
    db.close()
  })
})

describe('collectOrphanedAttachments', () => {
  function tempDir(): string {
    return mkdtempSync(join(tmpdir(), 'crivo-gc-'))
  }

  it('deletes a blob no message references, keeping one that is', async () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'kept')
    const dir = tempDir()
    writeFileSync(join(dir, 'kept'), 'a')
    writeFileSync(join(dir, 'orphan'), 'b')

    await collectOrphanedAttachments(db, dir)

    expect(existsSync(join(dir, 'kept'))).toBe(true)
    expect(existsSync(join(dir, 'orphan'))).toBe(false)
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps a blob shared by two conversations after only one is removed (D16.2 aceite)', async () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'shared')
    withMessage(db, 'c2', 'm2', 'shared')
    const dir = tempDir()
    writeFileSync(join(dir, 'shared'), 'a')

    removeConversation({ id: 'c1' }, db)
    await collectOrphanedAttachments(db, dir)

    expect(existsSync(join(dir, 'shared'))).toBe(true)
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('deletes the blob once the last conversation referencing it is removed', async () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'solo')
    const dir = tempDir()
    writeFileSync(join(dir, 'solo'), 'a')

    removeConversation({ id: 'c1' }, db)
    await collectOrphanedAttachments(db, dir)

    expect(existsSync(join(dir, 'solo'))).toBe(false)
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
