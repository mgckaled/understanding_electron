import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useCloudSecret } from '../settings/useCloudSecret'
import DocsAdmin from './DocsAdmin'
import { useDocs } from './docsContext'

const INPUT =
  'w-full rounded-md border border-border bg-surface-sunken px-4 py-3 font-ui text-sm text-text select-text focus-visible:border-accent-text focus-visible:outline-none'

type DocsComposeProps = {
  onSearch: () => void
  /** What the search came back with, drawn under the fields until 23-E gives it its own screen. */
  result?: ReactNode
}

function DocsCompose({ onSearch, result }: DocsComposeProps): React.JSX.Element | null {
  const { current, setLibrary, setQuestion, setBroad } = useDocs()
  // Compiles without a channel because `context7` joined CLOUD_PROVIDERS in the
  // 23-B (D23B.4) — the key was already a credential, it just was not required.
  const { loaded, hasKey } = useCloudSecret('context7')

  if (current === null) return null

  // An empty field is the one situation that must never reach the network
  // (DM-12, situação 1): the button is the fix, not a 400 spent from the quota.
  // The key joins that rule rather than replacing it (D23I.5); `loaded` guards
  // the flicker of a button that enables and then disables again.
  const ready = loaded && hasKey && current.library.trim() !== '' && current.question.trim() !== ''

  return (
    <>
      <div className="flex min-h-[0px] flex-1 flex-col gap-6 overflow-y-auto p-5">
        <Field label="Biblioteca">
          <input
            type="text"
            className={INPUT}
            value={current.library}
            onChange={(event) => setLibrary(event.target.value)}
            autoComplete="off"
            placeholder="tanstack query"
          />
        </Field>

        <Field label="Pergunta" hint="Acompanha a próxima mensagem — não substitui ela.">
          <textarea
            className={`${INPUT} min-h-[5lh] resize-none`}
            value={current.question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="como invalidar o cache depois de uma mutação"
          />
        </Field>

        {/* Where it acts, not with the administration below: this one changes
            the REQUEST, like the version picker, while the quota and the key
            describe the account (D23J.6). The label carries the cost rather
            than hiding it — nobody spends context without being told. */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={current.broad}
            onChange={(event) => setBroad(event.target.checked)}
            className="mt-[2px] size-6 flex-none accent-accent"
          />
          <span className="flex flex-col gap-1">
            <span className="font-ui text-sm text-text">consulta ampla</span>
            <span className="text-xs text-text-faint">
              Traz até 25 trechos em vez de ~5, pela mesma consulta da cota. Sem reranqueamento, a
              ordem é arbitrária.
            </span>
          </span>
        </label>

        {/* Permanent, never a first-time consent (DM-22): a warning accepted
            once is not on screen in the turn the question leaves the machine. */}
        <p className="flex items-start gap-3 text-xs text-warn-text">
          <TriangleAlert
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className="mt-[2px] flex-none"
          />
          A pergunta é enviada ao Context7, mesmo em conversa local.
        </p>

        {/* The first screen is the only place the consultation is administered
            (D23I.6), and it is where requiring a key explains itself instead of
            only blocking. Nothing opens Configurações — it names it (D23I.4),
            the same way useCloudCatalog does for Gemini and GLM. */}
        <DocsAdmin />

        {result}
      </div>

      <div className="flex flex-none items-center justify-between gap-3 border-t border-border px-5 py-4">
        <span className="text-xs text-text-faint">nada consultado</span>
        <Button variant="primary" size="sm" type="button" disabled={!ready} onClick={onSearch}>
          Consultar
        </Button>
      </div>
    </>
  )
}

export default DocsCompose
