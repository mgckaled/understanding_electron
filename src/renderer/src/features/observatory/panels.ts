import type { ComponentType } from 'react'
import ActivityPanel from './ActivityPanel'
import CapabilitiesPanel from './CapabilitiesPanel'
import ChromiumCachePanel from './ChromiumCachePanel'
import DatabasePanel from './DatabasePanel'
import DiskUsagePanel from './DiskUsagePanel'
import EnginePanel from './EnginePanel'
import EventsPanel from './EventsPanel'
import PerformancePanel from './PerformancePanel'
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
  { id: 'database', group: 'storage', label: 'Banco de dados', Panel: DatabasePanel },
  // Acessível/Moderado (§ 6, O-5) — caches instead of reading on every open,
  // unlike Banco de dados above.
  { id: 'chromiumCache', group: 'storage', label: 'Cache do Chromium', Panel: ChromiumCachePanel },
  // Caro/Pesado (§ 6, O-5) — the trilha's second sob-botão panel, this one a
  // cancellable job instead of a one-shot sondagem (DO5.1).
  { id: 'diskUsage', group: 'storage', label: 'Uso de disco', Panel: DiskUsagePanel },
  // First panel in "activity" — the persisted, historical sense the group's
  // label promises, unlike "Em andamento" above (O-6, DO6.6).
  { id: 'events', group: 'activity', label: 'Eventos', Panel: EventsPanel },
  // Second inhabitant of "activity" (O-7) — tokens/s per (service, model),
  // aggregated in the main process from the same observatory.db.
  { id: 'performance', group: 'activity', label: 'Desempenho', Panel: PerformancePanel }
]
