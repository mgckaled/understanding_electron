import { summarizeProcesses, type ProcessMetricLike } from './processes'

function metric(overrides: Partial<ProcessMetricLike> = {}): ProcessMetricLike {
  return {
    pid: 1,
    type: 'Browser',
    cpu: { percentCPUUsage: 0 },
    memory: { workingSetSize: 1024 },
    ...overrides
  }
}

describe('summarizeProcesses', () => {
  it('converts the kilobytes Electron reports into the contract bytes', () => {
    const [process] = summarizeProcesses([metric({ memory: { workingSetSize: 2048 } })])

    expect(process.memoryBytes).toBe(2_097_152)
  })

  it('orders by memory, heaviest first', () => {
    const summary = summarizeProcesses([
      metric({ pid: 1, memory: { workingSetSize: 100 } }),
      metric({ pid: 2, memory: { workingSetSize: 900 } }),
      metric({ pid: 3, memory: { workingSetSize: 500 } })
    ])

    expect(summary.map((process) => process.pid)).toEqual([2, 3, 1])
  })

  it('falls back to serviceName when the fork did not name itself', () => {
    const [named, unnamed] = summarizeProcesses([
      metric({ pid: 1, name: 'DuckDB', serviceName: 'node.mojom.NodeService' }),
      metric({ pid: 2, serviceName: 'node.mojom.NodeService', memory: { workingSetSize: 1 } })
    ])

    expect(named.name).toBe('DuckDB')
    expect(unnamed.name).toBe('node.mojom.NodeService')
  })

  it('keeps every process, including the utility ones', () => {
    const summary = summarizeProcesses([
      metric({ pid: 1, type: 'Browser' }),
      metric({ pid: 2, type: 'Utility' }),
      metric({ pid: 3, type: 'GPU' })
    ])

    expect(summary.map((process) => process.type)).toContain('Utility')
    expect(summary).toHaveLength(3)
  })
})
