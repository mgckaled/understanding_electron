import * as jobs from '../../jobs'
import { pickDataset, scanDataset } from './handlers'

function throwingLines(error: Error): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return { next: (): Promise<IteratorResult<string>> => Promise.reject(error) }
    }
  }
}

describe('pickDataset', () => {
  it('returns the picked path when the user selects a file', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.csv'] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: { path: '/a.csv' } })
  })

  it('returns ok(null) when the user cancels the dialog', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: null })
  })
})

describe('scanDataset', () => {
  it('returns the scan summary and emits a final progress event with a known total', async () => {
    async function* fakeLines(): AsyncGenerator<string> {
      yield 'id,name'
      yield '1,Ana'
      yield '2,Bruno'
    }
    const emitProgress = vi.fn()

    const result = await scanDataset(
      { path: '/ok.csv', jobId: 'scan-ok' },
      () => fakeLines(),
      emitProgress
    )

    expect(result).toEqual({
      ok: true,
      value: { delimiter: ',', columns: ['id', 'name'], rowCount: 2 }
    })
    expect(emitProgress).toHaveBeenCalledWith({
      jobId: 'scan-ok',
      type: 'progress',
      phase: 'scanning',
      done: 2,
      total: 2
    })
  })

  it('maps an ENOENT error from the line source to a not-found Result', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })

    const result = await scanDataset(
      { path: '/missing.csv', jobId: 'scan-not-found' },
      () => throwingLines(fsError),
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.csv' } })
  })

  it('maps an EACCES error from the line source to a permission Result', async () => {
    const fsError = Object.assign(new Error('denied'), { code: 'EACCES' })

    const result = await scanDataset(
      { path: '/locked.csv', jobId: 'scan-permission' },
      () => throwingLines(fsError),
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'permission', path: '/locked.csv' } })
  })

  it('returns cancelled when the job is cancelled mid-scan', async () => {
    const jobId = 'scan-cancel'
    async function* fakeLines(): AsyncGenerator<string> {
      yield 'id,name'
      yield '1,Ana'
      jobs.cancel(jobId)
      yield '2,Bruno'
    }

    const result = await scanDataset({ path: '/x.csv', jobId }, () => fakeLines(), vi.fn())

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })

  it('removes the job entry on finish, so a later cancel does not abort a stale controller', async () => {
    const jobId = 'scan-finish'
    const createSpy = vi.spyOn(jobs, 'create')
    async function* fakeLines(): AsyncGenerator<string> {
      yield 'a,b'
    }

    await scanDataset({ path: '/x.csv', jobId }, () => fakeLines(), vi.fn())
    const controller = createSpy.mock.results[0]?.value as AbortController

    jobs.cancel(jobId)

    expect(controller.signal.aborted).toBe(false)
    createSpy.mockRestore()
  })
})
