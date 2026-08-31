import { createIpcStatsStore } from './ipcStats'

function fakeClock(...ticks: number[]): () => number {
  let i = 0
  return () => ticks[i++] ?? ticks[ticks.length - 1]
}

describe('createIpcStatsStore', () => {
  it('counts a successful call and records its duration', async () => {
    const store = createIpcStatsStore(fakeClock(0, 12))
    const wrapped = store.wrap('app:info', () => 'ok')

    await wrapped(undefined)

    expect(store.snapshot()).toEqual([
      { channel: 'app:info', callCount: 1, errorCount: 0, lastDurationMs: 12, lastError: null }
    ])
  })

  it('counts a failure and records the error message', async () => {
    const store = createIpcStatsStore(fakeClock(0, 5))
    const wrapped = store.wrap('dataset:query', () => {
      throw new Error('boom')
    })

    await expect(wrapped(undefined)).rejects.toThrow('boom')
    expect(store.snapshot()).toEqual([
      {
        channel: 'dataset:query',
        callCount: 1,
        errorCount: 1,
        lastDurationMs: 5,
        lastError: 'boom'
      }
    ])
  })

  it('lets the original rejection propagate unchanged', async () => {
    const store = createIpcStatsStore()
    const wrapped = store.wrap('dataset:query', () => {
      throw new TypeError('specific failure')
    })

    await expect(wrapped(undefined)).rejects.toBeInstanceOf(TypeError)
  })

  it('keeps the last failure after a later success (DO2.4)', async () => {
    const store = createIpcStatsStore(fakeClock(0, 1, 2, 3))
    const wrapped = store.wrap('ai:chat', (fail: boolean) => {
      if (fail) throw new Error('provider down')
      return 'reply'
    })

    await expect(wrapped(true)).rejects.toThrow('provider down')
    await wrapped(false)

    const [stat] = store.snapshot()
    expect(stat.callCount).toBe(2)
    expect(stat.errorCount).toBe(1)
    expect(stat.lastError).toBe('provider down')
  })

  it('orders the snapshot by call count, busiest first', async () => {
    const store = createIpcStatsStore()
    const quiet = store.wrap('app:memory', () => undefined)
    const busy = store.wrap('dataset:query', () => undefined)

    await quiet(undefined)
    await busy(undefined)
    await busy(undefined)

    expect(store.snapshot().map((stat) => stat.channel)).toEqual(['dataset:query', 'app:memory'])
  })
})
