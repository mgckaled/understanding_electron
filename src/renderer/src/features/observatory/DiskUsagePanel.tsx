import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppError, DiskUsage, JobId, JobProgress } from '@shared/ipc'
import { useJobProgress } from '../../shared/hooks/useJobProgress'
import { formatBytes, formatAge } from '../../shared/format'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'
const QUERY_KEY = ['disk', 'usage']

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

async function fetchDiskUsage(jobId: JobId): Promise<DiskUsage> {
  const result = await window.api.disk.usage(jobId)
  if (!result.ok) throw result.error
  return result.value
}

/**
 * The trilha's second Caro/sob-botão panel (§ 5.1, after Capacidades) — a
 * job, not a plain sondagem, but backed by the same `enabled: false` +
 * `refetch()` query as `useCapabilities` (O-5): the result and its
 * `dataUpdatedAt` live in the QueryClient cache, so switching to another
 * panel and back still shows the last measurement instead of resetting to
 * the button — `useState` alone would lose it on unmount (§ 4.2).
 */
function DiskUsagePanel(): React.JSX.Element {
  const [jobId, setJobId] = useState<JobId | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  useJobProgress(jobId, setProgress)

  const { data, error, status, isFetching, dataUpdatedAt, refetch } = useQuery<DiskUsage, AppError>(
    {
      queryKey: QUERY_KEY,
      queryFn: () => {
        const newJobId = crypto.randomUUID()
        setJobId(newJobId)
        return fetchDiskUsage(newJobId).finally(() => setJobId(null))
      },
      enabled: false
    }
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  const state: ViewState<DiskUsage> = isFetching
    ? { status: 'loading', progress: progress ?? undefined }
    : status === 'error'
      ? error.kind === 'cancelled'
        ? { status: 'cancelled' }
        : { status: 'error', error }
      : data !== undefined
        ? { status: 'ready', data }
        : { status: 'idle' }

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Uso de disco</h3>
      {data === undefined && !isFetching && (
        <Button variant="primary" onClick={() => void refetch()}>
          Sondar uso de disco
        </Button>
      )}
      {isFetching && (
        <Button variant="ghost" size="sm" onClick={cancel} className="mb-3">
          Cancelar
        </Button>
      )}
      <StateView
        state={state}
        render={(usage) => (
          <div className="flex flex-col gap-4">
            <DiskTable usage={usage} />
            <div className="flex items-center gap-2 text-2xs text-text-faint">
              <span>Medido {formatAge(dataUpdatedAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                loading={isFetching}
                onClick={() => void refetch()}
                aria-label="Sondar uso de disco de novo"
              >
                ↻
              </Button>
            </div>
          </div>
        )}
      />
    </section>
  )
}

export default DiskUsagePanel
