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
  /**
   * Adds a draft to this conversation.
   *
   * @param code - Absent for prose. Present makes it a code draft, and carries
   *   the fence's language, which may itself be `null` (DE2A.2) — the pairing
   *   is one argument so neither half can be set without the other.
   */
  create: (sourceMessageId: string, content: string, code?: { language: string | null }) => void
  update: (id: string, content: string) => void
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
  const updateMutation = useMutation({
    mutationFn: (draft: { id: string; content: string }) =>
      window.api.draft.update({
        id: draft.id,
        title: draftTitle(draft.content),
        content: draft.content,
        updatedAt: Date.now()
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key })
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => window.api.draft.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key })
  })

  const create = useCallback(
    (sourceMessageId: string, content: string, code?: { language: string | null }) => {
      if (conversationId === null) return
      // Identity and time are minted here, never by the handler (DE1A.6/D14.5).
      createMutation.mutate({
        id: crypto.randomUUID(),
        conversationId,
        sourceMessageId,
        kind: code === undefined ? 'markdown' : 'code',
        language: code?.language ?? null,
        title: draftTitle(content),
        content,
        createdAt: Date.now()
      })
    },
    [conversationId, createMutation]
  )

  const update = useCallback(
    (id: string, content: string) => {
      // Nothing typed, nothing written: blur fires on every way out of the
      // field, and most of them carry no edit at all.
      if (drafts.find((draft) => draft.id === id)?.content === content) return
      updateMutation.mutate({ id, content })
    },
    [drafts, updateMutation]
  )

  const remove = useCallback((id: string) => removeMutation.mutate(id), [removeMutation])

  const hasDraftOf = useCallback(
    (messageId: string) => drafts.some((draft) => draft.sourceMessageId === messageId),
    [drafts]
  )

  return useMemo(
    () => ({ drafts, hasDraftOf, create, update, remove }),
    [drafts, hasDraftOf, create, update, remove]
  )
}
