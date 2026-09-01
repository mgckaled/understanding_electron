import type { DatabaseSync } from 'node:sqlite'
import type { DatabaseInfo, DatabaseTableInfo } from '@shared/ipc'
import { currentVersion } from '../../db/open'

function pragmaNumber(db: DatabaseSync, pragma: string): number {
  const row = db.prepare(`PRAGMA ${pragma}`).get() as Record<string, number | bigint> | undefined
  return Number(row?.[pragma] ?? 0)
}

export function readDatabaseInfo(db: DatabaseSync): DatabaseInfo {
  const pageCount = pragmaNumber(db, 'page_count')
  const pageSize = pragmaNumber(db, 'page_size')
  const freelistCount = pragmaNumber(db, 'freelist_count')

  const tableNames = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]

  const tables: DatabaseTableInfo[] = tableNames.map(({ name }) => {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as {
      count: number | bigint
    }
    return { name, rowCount: Number(row.count) }
  })

  return {
    migrationVersion: currentVersion(db),
    sizeBytes: pageCount * pageSize,
    freelistCount,
    tables
  }
}
