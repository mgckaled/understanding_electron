import type { AppInfo, AppProcess, SystemMemory } from '@shared/ipc'
import { summarizeProcesses, type ProcessMetricLike } from '@core/observatory/processes'

export function getAppInfo(getVersion: () => string, isDev: boolean): AppInfo {
  return {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    app: getVersion(),
    platform: process.platform,
    isDev
  }
}

/**
 * How much memory this machine has free RIGHT NOW (D15.2). Read per call, never
 * cached: there is no single figure (~6–9 GB depending on what else runs, a
 * spread wider than most models' weights). `os.freemem` on Windows returns
 * ullAvailPhys — the "Disponível" the Task Manager shows, not the much smaller
 * "Free"; reading the other figure would report near zero (standby memory) and
 * offer every model no context at all.
 */
export function getSystemMemory(freemem: () => number, totalmem: () => number): SystemMemory {
  return { freeBytes: freemem(), totalBytes: totalmem() }
}

/**
 * Every process this app keeps open, heaviest first (DO1.5). No `Result`:
 * reading the runtime's own counters cannot fail in a way the UI must
 * distinguish, the same reasoning `app:info` and `app:memory` already carry.
 */
export function readProcesses(getMetrics: () => ProcessMetricLike[]): AppProcess[] {
  return summarizeProcesses(getMetrics())
}
