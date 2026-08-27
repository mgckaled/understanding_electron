import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Draft } from '@shared/ipc'
import { draftTitle } from '@core/draft/title'

function draftsKey(conversationId: string): readonly ['drafts', string] {
  return ['drafts', conversationId] as const
}

export type DraftsApi = {
  drafts: Draft[]
  /** Whether this answer already produced a draft — the button's own state (DE1A.3). */
  hasDraftOf: (messageId: string) => boolean
  create: (sourceMessageId: string, content: string) => void
  remove: (id: string) => void
}

/**
 * This conversation's drafts, oldest first.
 *
 * @param conversationId - `null` before a conversation is chosen; the query
 *   stays disabled and the list reads empty rather than fetching for nobody.
 */
export function useDrafts(conversationId: string | null): DraftsApi {
  const queryClient = useQueryClient()
  const key = draftsKey(conversationId ?? '')

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => window.api.draft.list(conversationId ?? ''),
    enabled: conversationId !== null
  })

  const drafts = useMemo(() => data ?? [], [data])

  const createMutation = useMutation({
    mutationFn: (draft: Omit<Draft, 'updatedAt'>) => window.api.draft.create(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key })
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => window.api.draft.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key })
  })

  const create = useCallback(
    (sourceMessageId: string, content: string) => {
      if (conversationId === null) return
      // Identity and time are minted here, never by the handler (DE1A.6/D14.5).
      createMutation.mutate({
        id: crypto.randomUUID(),
        conversationId,
        sourceMessageId,
        title: draftTitle(content),
        content,
        createdAt: Date.now()
      })
    },
    [conversationId, createMutation]
  )

  const remove = useCallback((id: string) => removeMutation.mutate(id), [removeMutation])

  const hasDraftOf = useCallback(
    (messageId: string) => drafts.some((draft) => draft.sourceMessageId === messageId),
    [drafts]
  )

  return useMemo(
    () => ({ drafts, hasDraftOf, create, remove }),
    [drafts, hasDraftOf, create, remove]
  )
}
