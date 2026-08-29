import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatSize } from '../../shared/format'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-mono text-xs text-text select-text">{value}</dd>
    </div>
  )
}

function RuntimePanel(): React.JSX.Element {
  // Immutable facts about the build, so the client's default staleTime of
  // Infinity is exactly right — this is read once per window.
  const { data: info, isError } = useQuery({
    queryKey: ['app', 'info'],
    queryFn: () => window.api.app.info()
  })
  const { memory, reload } = useSystemMemory()

  // The reading is held with an infinite staleTime so the context ceiling does
  // not move under a dragging cursor (D15.2) — which makes it stale by the time
  // anyone opens this panel to look at it. Asking again on open is the whole
  // point of the panel, and the modal's focus trap means nobody is dragging.
  useEffect(() => reload(), [reload])

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Runtime</h3>
      {isError && <p className="text-xs text-warn-text">Não foi possível ler as versões.</p>}
      <dl className="flex flex-col">
        {info && (
          <>
            <Row label="Electron" value={`v${info.electron}`} />
            <Row label="Chromium" value={`v${info.chrome}`} />
            <Row label="Node" value={`v${info.node}`} />
            <Row label="crivo" value={`v${info.app}`} />
            <Row label="Plataforma" value={info.platform} />
            <Row label="Origem" value={info.isDev ? 'desenvolvimento' : 'empacotado'} />
          </>
        )}
        {memory && (
          <>
            <Row label="Memória livre" value={formatSize(memory.freeBytes)} />
            <Row label="Memória total" value={formatSize(memory.totalBytes)} />
          </>
        )}
      </dl>
    </section>
  )
}

export default RuntimePanel
