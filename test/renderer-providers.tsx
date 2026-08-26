import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@renderer/shared/queryClient'
import ArtifactPanel from '@renderer/features/artifact/ArtifactPanel'
import ArtifactProvider from '@renderer/features/artifact/ArtifactProvider'
import ConversationsProvider from '@renderer/features/conversation/ConversationsProvider'

/**
 * The provider stack `App.tsx` composes, for level-2 tests that mount a real
 * screen.
 *
 * Extracted at the third hand-rolled copy (régua dos três): when `ArtifactCount`
 * moved into the conversation header, every harness that renders
 * `ConversationView` started needing `ArtifactProvider`, and three files were
 * already repeating the same wrapper — each one a place to forget the next
 * provider. A harness that drifts from `App.tsx` tests an app that does not
 * ship, which is exactly how the artifact panel's `role="complementary"`
 * ambiguity survived level 2 in F-3-A.
 *
 * The panel renders here for the same reason: a card is a trigger, and a
 * trigger with nothing to open cannot be asserted on.
 */
export function providers(children: ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>
        <ArtifactProvider>
          {children}
          <ArtifactPanel />
        </ArtifactProvider>
      </ConversationsProvider>
    </QueryClientProvider>
  )
}
