import { EventEmitter } from 'node:events'
import type { UtilityProcess } from 'electron'
import { createDuckdbWorkerClient } from './spawnWorker'

/**
 * A worker is just `on`/`off`/`once`/`postMessage` to this module — never
 * `electron`'s real `utilityProcess.fork()`, so this stays a level-1 test.
 */
function fakeWorker(): UtilityProcess & EventEmitter {
  const emitter = new EventEmitter()
  return Object.assign(emitter, { postMessage: vi.fn() }) as unknown as UtilityProcess &
    EventEmitter
}

describe('createDuckdbWorkerClient — queue depth', () => {
  it('starts at zero and returns to zero after a reply', async () => {
    const worker = fakeWorker()
    const client = createDuckdbWorkerClient(worker)

    expect(client.queueDepth()).toBe(0)

    const pending = client.runQuery('h', 'select 1')
    // sendOne attaches its listener inside the tail's .then callback — a
    // microtask that has not run yet at this point in the same tick.
    await Promise.resolve()
    expect(client.queueDepth()).toBe(1)

    worker.emit('message', { kind: 'query', ok: true, bytes: new Uint8Array() })
    await pending

    expect(client.queueDepth()).toBe(0)
  })

  // The provocation for the bug the advisor caught before it shipped: depth
  // decremented in a separate settled.finally() creates a second derived
  // promise with no rejection handler, which crashes the main process on
  // this exact path (O-2). Awaiting the rejection here is what would have
  // surfaced it — Vitest fails a test that leaves an unhandled rejection.
  it('returns to zero, with no unhandled rejection, when the worker dies mid-queue', async () => {
    const worker = fakeWorker()
    const client = createDuckdbWorkerClient(worker)

    const pending = client.runQuery('h', 'select 1')
    await Promise.resolve()
    expect(client.queueDepth()).toBe(1)

    worker.emit('exit', 137)

    await expect(pending).rejects.toThrow('DuckDB worker exited')
    expect(client.queueDepth()).toBe(0)
  })
})
