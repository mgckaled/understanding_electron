import { QueryClient } from '@tanstack/react-query'

/**
 * The server cache's configuration (D14.4). Three defaults are turned off, and
 * each one is off because it solves a problem this app does not have.
 *
 * `refetchOnWindowFocus` — behaviour of a browser tab, where another user may
 * have changed the data while you were away. Here there is a single writer, and
 * it is this app.
 *
 * `retry` — the "server" is the main process of this same application. A failed
 * call is a defect, not a flaky network, and retrying it three times only
 * delays the error reaching the screen.
 *
 * `staleTime: Infinity` — nothing goes stale on its own for the same reason:
 * every write goes through a mutation that invalidates explicitly. Without
 * this, remounting a component would re-read the whole list for nothing.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: Number.POSITIVE_INFINITY
      }
    }
  })
}
