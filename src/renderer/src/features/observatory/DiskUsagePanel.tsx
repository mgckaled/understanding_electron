import { useCallback, useState } from 'react'
import type { DiskUsage, JobId } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobProgress } from '../../shared/hooks/useJobProgress'
import { formatBytes, formatAge } from '../../shared/format'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'

const CELL = 'px-3 py-2 text-xs'

function PartialNote(): React.JSX.Element {
  return <span className="ml-2 text-2xs text-warn-text">leitura parcial</span>
}

function DiskTable({ usage }: { usage: DiskUsage }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Entrada</th>
          <th className={`${CELL} text-right`}>Tamanho</th>
        </tr>
      </thead>
      <tbody>
        {usage.crivo.map((entry) => (
          <tr key={entry.name} className="border-b border-border">
            <td className={`${CELL} font-mono text-text select-text`}>
              {entry.name}
              {entry.partial && <PartialNote />}
            </td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>
              {formatBytes(entry.bytes)}
            </td>
          </tr>
        ))}
        <tr className="border-b border-border">
          <td className={`${CELL} text-text`}>
            Chromium (motor embutido)
            {usage.runtimePartial && <PartialNote />}
          </td>
          <td className={`${CELL} text-right font-mono text-text-muted`}>
            {formatBytes(usage.runtimeBytes)}
          </td>
        </tr>
        <tr>
          <td className={`${CELL} font-semibold text-text`}>Total</td>
          <td className={`${CELL} text-right font-mono font-semibold text-text`}>
            {formatBytes(usage.totalBytes)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** The trilha's second Caro/sob-botão panel (§ 5.1, after Capacidades) — a job, not a query (O-5). */
function DiskUsagePanel(): React.JSX.Element {
  const { state, run, setProgress } = useAsyncAction<DiskUsage>()
  const [jobId, setJobId] = useState<JobId | null>(null)
  const [measuredAt, setMeasuredAt] = useState<number | null>(null)

  useJobProgress(jobId, setProgress)

  const probe = useCallback(async (): Promise<void> => {
    const newJobId = crypto.randomUUID()
    setJobId(newJobId)
    const result = await run(() => window.api.disk.usage(newJobId))
    setJobId(null)
    if (result.ok) setMeasuredAt(Date.now())
  }, [run])

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Uso de disco</h3>
      {state.status === 'idle' && (
        <Button variant="primary" onClick={probe}>
          Sondar uso de disco
        </Button>
      )}
      {state.status === 'loading' && (
        <Button variant="ghost" size="sm" onClick={cancel} className="mb-3">
          Cancelar
        </Button>
      )}
      <StateView
        state={state}
        render={(usage) => (
          <div className="flex flex-col gap-4">
            <DiskTable usage={usage} />
            {measuredAt !== null && (
              <div className="flex items-center gap-2 text-2xs text-text-faint">
                <span>Medido {formatAge(measuredAt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  onClick={probe}
                  aria-label="Sondar uso de disco de novo"
                >
                  ↻
                </Button>
              </div>
            )}
          </div>
        )}
      />
    </section>
  )
}

export default DiskUsagePanel
