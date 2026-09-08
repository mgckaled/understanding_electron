import { useId } from 'react'
import type { LibraryCandidate } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import Field from '../../shared/ui/Field/Field'
import { useDocs } from './docsContext'

const decimal = new Intl.NumberFormat('pt-BR')
const score = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Selection is the three-part composition the design system fixes: reserved
// 2px left border, the hover step on the surface, and weight. Driven by state
// and not by a `has-checked:` variant — no `has-` has been built here yet.
const ROW =
  'flex cursor-pointer gap-3 rounded-md border-l-2 px-4 py-3 hover:bg-surface-raised'
const ROW_ON = 'border-l-accent-text bg-surface-raised'
const ROW_OFF = 'border-l-transparent'

const SELECT =
  'rounded-md border border-border bg-surface-sunken px-3 py-2 font-ui text-sm text-text focus-visible:border-accent-text focus-visible:outline-none'

type DocsCandidatesProps = {
  candidates: LibraryCandidate[]
  /** What was typed, quoted back — two candidates differ by little else. */
  query: string
  onBack: () => void
}

/**
 * The disambiguation screen: the app's own order made visible, one library
 * picked, and the version pinned among the ones it indexes.
 */
function DocsCandidates({ candidates, query, onBack }: DocsCandidatesProps): React.JSX.Element {
  const { current, selectCandidate, setVersion } = useDocs()
  const group = useId()

  // Falls back to the first rather than storing a default on render: the order
  // is already the app's (D23A.4), so the first is the best guess, and a key
  // left over from an earlier list resolves to it instead of selecting nothing.
  const selected = candidates.find((one) => one.key === current?.candidateKey) ?? candidates[0]

  return (
    <>
      <div className="flex min-h-[0px] flex-1 flex-col gap-5 overflow-y-auto p-5">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-xs text-text-muted">
            {candidates.length === 1
              ? `Uma biblioteca bate com “${query}”.`
              : `${candidates.length} bibliotecas batem com “${query}”.`}
          </legend>

          {candidates.map((candidate) => (
            <label
              key={candidate.key}
              className={`${ROW} ${candidate.key === selected.key ? ROW_ON : ROW_OFF}`}
            >
              <input
                type="radio"
                name={group}
                value={candidate.key}
                checked={candidate.key === selected.key}
                onChange={() => selectCandidate(candidate.key)}
                className="mt-[3px] flex-none accent-accent"
              />
              <span className="flex min-w-[0px] flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-ui text-sm text-text">{candidate.id}</span>
                  <span className="flex-none text-xs text-text-faint">
                    {decimal.format(candidate.totalSnippets)} trechos
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="truncate">{candidate.title}</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex-none">{candidate.branch}</span>
                  {/* -1 on the wire means "does not apply", not zero (D23A.6) —
                      every /websites/* entry carries it. */}
                  {candidate.stars !== null && (
                    <span className="flex-none">{decimal.format(candidate.stars)} ★</span>
                  )}
                  <span className="ml-auto flex-none text-text-faint">
                    benchmark {score.format(candidate.benchmarkScore)}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* Absent, not disabled, when nothing is indexed (DF3B.2): every
            /websites/* entry has an empty list once __branch__* is filtered,
            and /reactjs/react.dev has nothing else to begin with. */}
        {selected.versions.length > 0 && (
          <div className="flex items-center gap-3">
            <Field label="Versão" inline>
              <select
                className={SELECT}
                value={current?.version ?? ''}
                onChange={(event) =>
                  setVersion(event.target.value === '' ? null : event.target.value)
                }
              >
                <option value="">padrão da biblioteca</option>
                {selected.versions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </Field>
            <span className="text-xs text-text-faint">
              {selected.versions.length} indexada{selected.versions.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-none items-center justify-between gap-3 border-t border-border px-5 py-4">
        <span className="text-xs text-text-faint">nada consultado</span>
        <Button variant="ghost" size="sm" type="button" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </>
  )
}

export default DocsCandidates
