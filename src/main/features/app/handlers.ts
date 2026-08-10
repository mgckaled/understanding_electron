import type { AppInfo, SystemMemory } from '@shared/ipc'

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
 * How much memory this machine has free RIGHT NOW (D15.2).
 *
 * Read per call and never cached, because there is no single figure: this
 * machine reports ~9 GB with only the app running, ~7,5 GB with only the editor
 * open, and ~6 GB in the full working environment. A constant chosen from any
 * one of those is wrong in the other two, and the spread — 3 GB — is larger
 * than the weights of most models in the fleet.
 *
 * The reader is a parameter (DIP) so this is a plain function in a level-3
 * test. Callers pass `os.freemem`, which on Windows returns GlobalMemoryStatus'
 * ullAvailPhys — the same "Disponível" the Task Manager shows, not the much
 * smaller "Free". Verified against the Task Manager before being trusted:
 * 6,73 GiB reported against 58% of 15,81 GiB in use. Reading the other figure
 * would report near zero, since Windows keeps most memory in reclaimable
 * standby, and every model would be offered no context at all.
 */
export function getSystemMemory(freemem: () => number, totalmem: () => number): SystemMemory {
  return { freeBytes: freemem(), totalBytes: totalmem() }
}
