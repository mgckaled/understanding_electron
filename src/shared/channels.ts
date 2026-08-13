// Kept separate from ipc.ts, which imports zod as a value: the sandboxed preload
// is a single bundle with no working require(), so at runtime zod is left an
// unresolved external and preload fails silently (window.api undefined). preload/
// may import values only from files here, never from ipc.ts. See docs/HISTORY.md.
export const JOB_EVENT_CHANNEL = 'job:event'
