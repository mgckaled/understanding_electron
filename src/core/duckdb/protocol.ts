// The main↔worker message shape for dataset:query (D18B.3-bis) — not part of
// the renderer-facing IPC contract (shared/ipc.ts owns that), so it lives
// here rather than there. Both main/duckdb and workers/duckdb import this
// one definition instead of agreeing on the shape by convention.

export interface WorkerQueryRequest {
  hash: string
  sql: string
}

export type WorkerQueryResponse = { ok: true; bytes: Uint8Array } | { ok: false; message: string }
