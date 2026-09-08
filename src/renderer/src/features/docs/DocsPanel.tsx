import { X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import StateView from '../../shared/ui/StateView'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { usePanel } from '../panel/panelContext'
import DocsCandidates from './DocsCandidates'
import DocsCompose from './DocsCompose'
import { useDocs } from './docsContext'
import { DocsIcon } from './icon'

// No `histórico` and no `+` in the header: both presuppose an attached
// consultation, which exists only from 23-G on (D23D.9, DF3B.2).
function DocsPanel(): React.JSX.Element | null {
  const { current, close, searchState: state, search, resetSearch } = useDocs()
  const { closing, width, setWidth } = usePanel()

  // Which screen is showing is derived, never a third value to keep in sync:
  // a hit is the only outcome with a list to disambiguate (D23E.2).
  const found =
    state.status === 'ready' && state.data.status === 'found' ? state.data.candidates : null

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
      {found === null ? (
        <DocsCompose
          onSearch={() => void search()}
          // Only what is NOT a list: a hit gets its own screen below, and
          // `no-libraries` travels inside `ready`, so it lands here (D23A.3).
          result={
            <StateView
              state={state}
              render={(outcome) =>
                outcome.status === 'no-libraries' ? (
                  <p className="text-xs text-text-muted">{outcome.message}</p>
                ) : null
              }
            />
          }
        />
      ) : (
        <DocsCandidates candidates={found} query={current.library} onBack={resetSearch} />
      )}
    </SidePanel>
  )
}

export default DocsPanel
