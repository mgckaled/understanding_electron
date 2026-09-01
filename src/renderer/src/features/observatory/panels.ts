import type { ComponentType } from 'react'
import ActivityPanel from './ActivityPanel'
import CapabilitiesPanel from './CapabilitiesPanel'
import DatabasePanel from './DatabasePanel'
import EnginePanel from './EnginePanel'
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
  { id: 'inFlight', group: 'state', label: 'Em andamento', Panel: ActivityPanel },
  // Grátis/Moderado (§ 6) — live engine config, same family as Runtime, not
  // the storage group below (DO3.1).
  { id: 'engine', group: 'state', label: 'Motor DuckDB', Panel: EnginePanel },
  // Caro/Leve (§ 6, DO4.1) — the trilha's first sob-botão panel; the other
  // four in this group read on every open (DO4.2).
  { id: 'capabilities', group: 'state', label: 'Capacidades', Panel: CapabilitiesPanel },
  // First panel in "storage" — the group has existed since O-1 with nothing
  // in it (DO1.10: a group only shows once it has a panel).
  { id: 'database', group: 'storage', label: 'Banco de dados', Panel: DatabasePanel }
]
