import type { ComponentType } from 'react'
import ActivityPanel from './ActivityPanel'
import ProcessesPanel from './ProcessesPanel'
import RuntimePanel from './RuntimePanel'

/**
 * The four categories of `reference/observatory/` § 4.4, in the order the
 * question tends to arise. Declared in full while most are still empty: the
 * sidebar renders only the ones that have a panel, so a later plan adds an
 * entry to PANELS alone and the navigation follows (DO1.10).
 */
export const PANEL_GROUPS = [
  { id: 'state', label: 'Estado' },
  { id: 'storage', label: 'Armazenamento' },
  { id: 'indexes', label: 'Índices' },
  { id: 'activity', label: 'Atividade' }
] as const

export type PanelGroupId = (typeof PANEL_GROUPS)[number]['id']

export type ObservatoryPanel = {
  id: string
  group: PanelGroupId
  label: string
  Panel: ComponentType
}

export const PANELS: ObservatoryPanel[] = [
  { id: 'runtime', group: 'state', label: 'Runtime', Panel: RuntimePanel },
  { id: 'processes', group: 'state', label: 'Processos', Panel: ProcessesPanel },
  // IPC channels, jobs and the DuckDB worker queue read live state with no
  // history, same as the two above — not the persisted, historical sense of
  // "Atividade" this group's label suggests for later plans (O-2).
  { id: 'inFlight', group: 'state', label: 'Em andamento', Panel: ActivityPanel }
]
