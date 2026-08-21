import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import { errorMessage } from '../../shared/ui/messages'
import { useDatasetProfile } from './useDatasetProfile'

function formatNumber(value: number | null, fractionDigits = 0): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits })
}

const COLUMNS = ['Coluna', 'Tipo', '% nulos', 'Mín', 'Máx', 'Média', 'Mais frequentes']

/**
 * The level-2 profile (`SUMMARIZE` plus cardinality-gated top-N, D18D.2) for
 * an attached dataset — copies `DocumentCard`'s disclosure shape
 * (`useState(false)`, chevron, conditional render) instead of a shared
 * primitive: with the Preview/Consultar toggle no longer disclosure-shaped
 * (post-18-C fix turned it into a two-state switcher), this is only the
 * second live occurrence of the pattern, not the third — the project's own
 * "a segunda ocorrência não extrai" precedent applies (D18D.5 revista).
 */
function DatasetProfile({ hash }: { hash: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const state = useDatasetProfile(hash, open)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          Perfil
          {open ? (
            <ChevronUp size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          ) : (
            <ChevronDown size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          )}
        </span>
      </Button>
      {state.status === 'loading' && (
        <p className="text-xs text-text-muted" role="status">
          Calculando perfil…
        </p>
      )}
      {state.status === 'error' && (
        <p className="text-xs text-danger-text selectable" role="alert">
          {errorMessage(state.error)}
        </p>
      )}
      {state.status === 'ready' && (
        <div className="max-h-[400px] overflow-auto rounded-md border border-border">
          <table className="w-full border-collapse text-xs selectable">
            <thead>
              <tr>
                {COLUMNS.map((header) => (
                  <th
                    key={header}
                    className="sticky top-0 border-b border-border bg-surface-raised px-2 py-1 text-left font-semibold whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.map((column) => (
                <tr key={column.column}>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {column.column}
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {column.type}
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {formatNumber(column.nullPercentage, 1)}%
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {column.min ?? '—'}
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {column.max ?? '—'}
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {formatNumber(column.avg, 2)}
                  </td>
                  <td className="border-b border-border px-2 py-1 whitespace-nowrap">
                    {column.topValues
                      ? column.topValues.map((top) => `${top.value} (${top.count})`).join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DatasetProfile
