import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { MessagePart } from '@shared/ipc'
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

type AttachmentKind = 'dataset' | 'document' | 'image'

/** One part per kind (plano 17 passo 8) — the shape gc.ts reads is `parts[].hash`, whichever kind it comes from. */
function attachmentPart(kind: AttachmentKind, hash: string): MessagePart {
  switch (kind) {
    case 'dataset':
      return { kind, hash, fileName: 'a.csv', delimiter: ',', columns: ['id'], rowCount: 1 }
    case 'document':
      return { kind, hash, fileName: 'a.md', format: 'md', text: 'conteúdo' }
    case 'image':
      return { kind, hash, fileName: 'a.png', mimeType: 'image/png' }
  }
}

function withMessage(
  db: DatabaseSync,
  conversationId: string,
  messageId: string,
  hash: string | null,
  kind: AttachmentKind = 'dataset'
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
        parts: hash === null ? [{ kind: 'text', text: 'oi' }] : [attachmentPart(kind, hash)],
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

  it('collects hashes across all three attachment kinds (plano 17 passo 8)', () => {
    // No change to gc.ts to make this pass — referencedHashes already reads
    // `parts[].hash` off any element of the array, whichever kind it is.
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'h-dataset', 'dataset')
    withMessage(db, 'c1', 'm2', 'h-document', 'document')
    withMessage(db, 'c1', 'm3', 'h-image', 'image')

    expect(referencedHashes(db)).toEqual(new Set(['h-dataset', 'h-document', 'h-image']))
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

  it('sweeps the three kinds correctly in one pass: keeps referenced, deletes orphaned (plano 17 passo 8)', async () => {
    const db = openDatabase(':memory:')
    withMessage(db, 'c1', 'm1', 'kept-dataset', 'dataset')
    withMessage(db, 'c1', 'm2', 'kept-document', 'document')
    withMessage(db, 'c1', 'm3', 'kept-image', 'image')
    const dir = tempDir()
    writeFileSync(join(dir, 'kept-dataset'), 'a')
    writeFileSync(join(dir, 'kept-document'), 'b')
    writeFileSync(join(dir, 'kept-image'), 'c')
    writeFileSync(join(dir, 'orphan-document'), 'd') // never referenced by any message
    writeFileSync(join(dir, 'orphan-image'), 'e')

    await collectOrphanedAttachments(db, dir)

    expect(existsSync(join(dir, 'kept-dataset'))).toBe(true)
    expect(existsSync(join(dir, 'kept-document'))).toBe(true)
    expect(existsSync(join(dir, 'kept-image'))).toBe(true)
    expect(existsSync(join(dir, 'orphan-document'))).toBe(false)
    expect(existsSync(join(dir, 'orphan-image'))).toBe(false)
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
