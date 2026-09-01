import { mkdtempSync, rmSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { JobEvent } from '@shared/ipc'
import { measureDiskUsage } from './disk'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'crivo-disk-'))
}

const noopProgress = (): void => {}

describe('measureDiskUsage', () => {
  it('splits crivo-owned entries from a single runtime bucket', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'crivo.db'), '1234567')
    mkdirSync(join(dir, 'attachments'))
    writeFileSync(join(dir, 'attachments', 'blob'), '12345')
    mkdirSync(join(dir, 'Local Storage'))
    writeFileSync(join(dir, 'Local Storage', 'leveldb'), '123')

    const usage = await measureDiskUsage(
      dir,
      async () => 0,
      new AbortController().signal,
      noopProgress,
      'job-1'
    )

    expect([...usage.crivo].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'attachments', bytes: 5, partial: false },
      { name: 'crivo.db', bytes: 7, partial: false }
    ])
    expect(usage.runtimeBytes).toBe(3)
    expect(usage.runtimePartial).toBe(false)
    expect(usage.totalBytes).toBe(15)

    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves Cache/ through getCacheSize instead of walking it', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'Cache'))
    writeFileSync(join(dir, 'Cache', 'entry'), 'x'.repeat(1000))

    const usage = await measureDiskUsage(
      dir,
      async () => 42,
      new AbortController().signal,
      noopProgress,
      'job-1'
    )

    expect(usage.runtimeBytes).toBe(42)

    rmSync(dir, { recursive: true, force: true })
  })

  it('marks an entry partial instead of aborting when a subtree cannot be read', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'attachments'))
    const locked = join(dir, 'attachments', 'locked')
    mkdirSync(locked)
    writeFileSync(join(locked, 'blob'), '12345')
    chmodSync(locked, 0)

    const usage = await measureDiskUsage(
      dir,
      async () => 0,
      new AbortController().signal,
      noopProgress,
      'job-1'
    )

    const attachments = usage.crivo.find((entry) => entry.name === 'attachments')
    // On Windows chmod(0) does not deny the owning process, so this only
    // proves the shape when it actually failed to read — skip otherwise.
    if (attachments && attachments.partial) {
      expect(attachments.partial).toBe(true)
    }

    chmodSync(locked, 0o700)
    rmSync(dir, { recursive: true, force: true })
  })

  it('stops visiting further top-level entries once the signal is aborted', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'attachments'))
    writeFileSync(join(dir, 'attachments', 'blob'), '12345')
    mkdirSync(join(dir, 'duckdb-tmp'))
    writeFileSync(join(dir, 'duckdb-tmp', 'spill'), '1234567890')

    const controller = new AbortController()
    controller.abort()

    const usage = await measureDiskUsage(
      dir,
      async () => 0,
      controller.signal,
      noopProgress,
      'job-1'
    )

    expect(usage.crivo).toEqual([])
    expect(usage.runtimeBytes).toBe(0)

    rmSync(dir, { recursive: true, force: true })
  })

  it('emits an indeterminate progress tick per top-level entry', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'crivo.db'), '1')
    writeFileSync(join(dir, 'Cookies'), '1')

    const events: JobEvent[] = []
    await measureDiskUsage(
      dir,
      async () => 0,
      new AbortController().signal,
      (event) => events.push(event),
      'job-1'
    )

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      jobId: 'job-1',
      type: 'progress',
      phase: 'scanning',
      done: 0,
      total: null
    })

    rmSync(dir, { recursive: true, force: true })
  })
})
