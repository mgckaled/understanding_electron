// The main<->worker message shape for dataset:query and dataset:profile
// (D18B.3-bis, D18D.1) — not part of the renderer-facing IPC contract
// (shared/ipc.ts owns that), so it lives here rather than there. Both
// main/duckdb and workers/duckdb import this one definition instead of
// agreeing on the shape by convention.
import type { ColumnProfile } from './profile'

export type WorkerRequest =
  | { kind: 'query'; hash: string; sql: string }
  // includeTopValues defaults true in the worker — omitted by dataset:profile
  // (the level-2 card needs it), passed false by ai:propose, which is
  // forbidden from seeing cell values at all (D19.7-4).
  | { kind: 'profile'; hash: string; includeTopValues?: boolean }
  | { kind: 'schema'; hash: string }
  // sql is the compiled steps body (D19.4), unwrapped — the worker both
  // materializes it in full (for the after-profile) and previews it capped.
  | { kind: 'transform'; hash: string; sql: string }

export type WorkerResponse =
  | { kind: 'query'; ok: true; bytes: Uint8Array }
  | { kind: 'query'; ok: false; message: string }
  | { kind: 'profile'; ok: true; profile: ColumnProfile[] }
  | { kind: 'profile'; ok: false; message: string }
  | { kind: 'schema'; ok: true; columns: string[]; rowCount: number }
  | { kind: 'schema'; ok: false; message: string }
  | {
      kind: 'transform'
      ok: true
      bytes: Uint8Array
      before: ColumnProfile[]
      after: ColumnProfile[]
    }
  | { kind: 'transform'; ok: false; message: string }
