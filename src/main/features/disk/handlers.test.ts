import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as jobs from '../../jobs'
import { readDiskUsage } from './handlers'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'crivo-disk-handler-'))
}

describe('readDiskUsage', () => {
  it('measures a real userData/ and finishes the job', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'crivo.db'), '1234567')

    const result = await readDiskUsage({ jobId: 'disk-ok' }, dir, async () => 0, vi.fn())

    expect(result.ok).toBe(true)
    expect(jobs.list()).not.toContain('disk-ok')

    rmSync(dir, { recursive: true, force: true })
  })

  it('returns cancelled, not the partial usage, when the job is aborted before it starts', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'crivo.db'), '1234567')

    const jobId = 'disk-cancel'
    // Aborting through jobs.create's own controller, the same one the
    // handler will fetch by id, mirrors a renderer calling job:cancel while
    // the walk is still in flight.
    const emitProgress = vi.fn().mockImplementation(() => jobs.cancel(jobId))

    const result = await readDiskUsage({ jobId }, dir, async () => 0, emitProgress)

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })

    rmSync(dir, { recursive: true, force: true })
  })

  it('maps an unreadable root to a Result error instead of throwing', async () => {
    const result = await readDiskUsage(
      { jobId: 'disk-missing' },
      join(tmpdir(), 'crivo-disk-does-not-exist'),
      async () => 0,
      vi.fn()
    )

    expect(result.ok).toBe(false)
  })
})
