import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppError, CloudProvider } from '@shared/ipc'

function secretKey(provider: CloudProvider): readonly ['secrets', CloudProvider] {
  return ['secrets', provider] as const
}

/**
 * The two-state field's data (DN1A.3/DN1A.4) — never reads the key back, only
 * whether one exists. `editing` starts true whenever no key is stored, so a
 * first-time provider opens straight into the input; `startEditing`
 * ("Substituir") is the only other way in, and a successful write is the
 * only way back out.
 */
export function useCloudSecret(provider: CloudProvider): {
  loaded: boolean
  hasKey: boolean
  editing: boolean
  startEditing: () => void
  stopEditing: () => void
  write: (apiKey: string) => void
  writing: boolean
  writeError: AppError | null
  weakBackend: boolean
  remove: () => void
  removing: boolean
} {
  const queryClient = useQueryClient()
  const key = secretKey(provider)

  const { data: hasKey, isPending } = useQuery({
    queryKey: key,
    queryFn: () => window.api.secrets.has(provider)
  })

  const [forceEditing, setForceEditing] = useState(false)
  const [weakBackend, setWeakBackend] = useState(false)
  const [writeError, setWriteError] = useState<AppError | null>(null)

  const writeMutation = useMutation({
    mutationFn: (apiKey: string) => window.api.secrets.write(provider, apiKey),
    onSuccess: async (result) => {
      if (!result.ok) {
        setWriteError(result.error)
        return
      }
      setWriteError(null)
      setWeakBackend(result.value.weakBackend)
      setForceEditing(false)
      await queryClient.invalidateQueries({ queryKey: key })
    }
  })

  const removeMutation = useMutation({
    mutationFn: () => window.api.secrets.remove(provider),
    onSuccess: async () => {
      setWeakBackend(false)
      await queryClient.invalidateQueries({ queryKey: key })
    }
  })

  const startEditing = useCallback(() => {
    setWriteError(null)
    setForceEditing(true)
  }, [])
  const stopEditing = useCallback(() => setForceEditing(false), [])
  const write = useCallback((apiKey: string) => writeMutation.mutate(apiKey), [writeMutation])
  const remove = useCallback(() => removeMutation.mutate(), [removeMutation])

  const loaded = !isPending

  return useMemo(
    () => ({
      loaded,
      hasKey: hasKey ?? false,
      editing: loaded && (!hasKey || forceEditing),
      startEditing,
      stopEditing,
      write,
      writing: writeMutation.isPending,
      writeError,
      weakBackend,
      remove,
      removing: removeMutation.isPending
    }),
    [
      loaded,
      hasKey,
      forceEditing,
      startEditing,
      stopEditing,
      write,
      writeMutation.isPending,
      writeError,
      weakBackend,
      remove,
      removeMutation.isPending
    ]
  )
}
