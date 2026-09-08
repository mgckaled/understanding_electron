import { X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import StateView from '../../shared/ui/StateView'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { usePanel } from '../panel/panelContext'
import DocsCompose from './DocsCompose'
import { useDocs } from './docsContext'
import { DocsIcon } from './icon'
import { useDocsSearch } from './useDocsSearch'

// No `histórico` and no `+` in the header: both presuppose an attached
// consultation, which exists only from 23-G on (D23D.9, DF3B.2).
function DocsPanel(): React.JSX.Element | null {
  const { current, close } = useDocs()
  const { closing, width, setWidth } = usePanel()
  const { state, search } = useDocsSearch()

  if (current === null) return null

  return (
    <SidePanel
      label="Consulta de documentação"
      contentKey={current.conversationId ?? 'sem-conversa'}
      closing={closing}
      width={width}
      setWidth={setWidth}
      onClose={close}
      header={
        <>
          <span className="flex min-w-[0px] items-center gap-3 text-sm font-semibold text-text">
            <DocsIcon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} className="flex-none" />
            Documentação
          </span>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="ml-auto flex-none"
            onClick={close}
            aria-label="Fechar painel"
          >
            <X size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </Button>
        </>
      }
    >
      <DocsCompose
        onSearch={() => void search(current.library)}
        result={
          // Provisional: 23-E turns this into the desambiguação screen, with
          // the version selector and the radio group. The ordering is already
          // the app's, done in the client (D23A.4).
          <StateView
            state={state}
            render={(outcome) =>
              outcome.status === 'no-libraries' ? (
                <p className="text-xs text-text-muted">{outcome.message}</p>
              ) : (
                <ul className="flex flex-col gap-3 text-xs text-text">
                  {outcome.candidates.map((candidate) => (
                    <li key={candidate.key} className="selectable">
                      {candidate.id} — {candidate.title}
                    </li>
                  ))}
                </ul>
              )
            }
          />
        }
      />
    </SidePanel>
  )
}

export default DocsPanel
