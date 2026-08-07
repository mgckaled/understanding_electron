// Kept separate from ipc.ts, which imports zod as a value. The sandboxed
// preload is a single bundle without a working require() for third-party
// packages — build/vitest never surface this, but at runtime the bundler
// leaves zod as an unresolved external, and preload load fails silently
// (window.api stays undefined, every consumer breaks). preload/ may only
// import values from files here, never from ipc.ts. See docs/HISTORY.md.
export const JOB_EVENT_CHANNEL = 'job:event'
