import type { ProcessMetricLike } from '@core/observatory/processes'
import { getAppInfo, getSystemMemory, readProcesses } from './handlers'

describe('getSystemMemory', () => {
  it('reports what the readers return, in bytes', () => {
    const free = vi.fn().mockReturnValue(6 * 1024 ** 3)
    const total = vi.fn().mockReturnValue(16 * 1024 ** 3)

    expect(getSystemMemory(free, total)).toEqual({
      freeBytes: 6 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3
    })
  })

  it('reads on every call instead of caching', () => {
    // There is no single "free RAM" on this machine — ~9 GB with only the app
    // running, ~6 GB with the working environment open. A value read once at
    // startup would be wrong for the rest of the session, and the context
    // ceiling derived from it would be wrong in the dangerous direction.
    const free = vi
      .fn()
      .mockReturnValueOnce(9 * 1024 ** 3)
      .mockReturnValueOnce(6 * 1024 ** 3)
    const total = vi.fn().mockReturnValue(16 * 1024 ** 3)

    expect(getSystemMemory(free, total).freeBytes).toBe(9 * 1024 ** 3)
    expect(getSystemMemory(free, total).freeBytes).toBe(6 * 1024 ** 3)
  })
})

describe('getAppInfo', () => {
  it('returns the expected shape', () => {
    const getVersion = vi.fn().mockReturnValue('1.0.0')

    const info = getAppInfo(getVersion, true)

    expect(info).toEqual({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      app: '1.0.0',
      platform: process.platform,
      isDev: true
    })
  })
})

describe('readProcesses', () => {
  const metrics: ProcessMetricLike[] = [
    {
      pid: 10,
      type: 'Browser',
      cpu: { percentCPUUsage: 1.5 },
      memory: { workingSetSize: 100 }
    },
    {
      pid: 20,
      type: 'Utility',
      name: 'DuckDB',
      cpu: { percentCPUUsage: 0 },
      memory: { workingSetSize: 900 }
    }
  ]

  it('reports the metrics source in bytes, heaviest first', () => {
    const getMetrics = vi.fn().mockReturnValue(metrics)

    expect(readProcesses(getMetrics)).toEqual([
      { pid: 20, type: 'Utility', name: 'DuckDB', cpuPercent: 0, memoryBytes: 900 * 1024 },
      { pid: 10, type: 'Browser', name: undefined, cpuPercent: 1.5, memoryBytes: 100 * 1024 }
    ])
  })

  // Function.length counts parameters before the first default, so a
  // `= () => app.getAppMetrics()` default would read 0 here. That default is the
  // one way `electron` gets imported by value into a testable handler, and
  // nothing else catches it: outside the binary the named export is `undefined`,
  // not an error, so the module still loads and every explicit call still passes.
  it('takes its metrics source by parameter, with no electron default', () => {
    expect(readProcesses.length).toBe(1)
  })

  it('asks the source on every call, never caching a snapshot', () => {
    const getMetrics = vi.fn().mockReturnValue([])

    readProcesses(getMetrics)
    readProcesses(getMetrics)

    expect(getMetrics).toHaveBeenCalledTimes(2)
  })
})
