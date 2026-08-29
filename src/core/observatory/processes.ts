import type { AppProcess, AppProcessType } from '@shared/ipc'

/**
 * The slice of Electron's `ProcessMetric` this module reads. Declared here, not
 * imported: `core/` never imports electron, and the shape is what makes the
 * function callable against a plain object in a test.
 */
export type ProcessMetricLike = {
  pid: number
  type: AppProcessType
  name?: string
  serviceName?: string
  cpu: { percentCPUUsage: number }
  memory: { workingSetSize: number }
}

const BYTES_PER_KILOBYTE = 1024

/**
 * Normalises raw process metrics into the contract's shape, heaviest first.
 *
 * The conversion to bytes happens here and nowhere else: `SystemMemory` already
 * fixed bytes as the contract's single unit, and Electron reports process memory
 * in kilobytes — two units crossing the IPC is the defect that reads as "this
 * process is using 1000× less memory than it is" (DO1.7).
 */
export function summarizeProcesses(metrics: ProcessMetricLike[]): AppProcess[] {
  return metrics
    .map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name ?? metric.serviceName,
      cpuPercent: metric.cpu.percentCPUUsage,
      memoryBytes: metric.memory.workingSetSize * BYTES_PER_KILOBYTE
    }))
    .sort((a, b) => b.memoryBytes - a.memoryBytes)
}
