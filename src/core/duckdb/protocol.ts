// The main<->worker message shape for dataset:query and dataset:profile
// (D18B.3-bis, D18D.1) — not part of the renderer-facing IPC contract
// (shared/ipc.ts owns that), so it lives here rather than there. Both
// main/duckdb and workers/duckdb import this one definition instead of
// agreeing on the shape by convention.
import type { ColumnProfile } from './profile'

export type WorkerRequest =
  { kind: 'query'; hash: string; sql: string } | { kind: 'profile'; hash: string }

export type WorkerResponse =
  | { kind: 'query'; ok: true; bytes: Uint8Array }
  | { kind: 'query'; ok: false; message: string }
  | { kind: 'profile'; ok: true; profile: ColumnProfile[] }
  | { kind: 'profile'; ok: false; message: string }
