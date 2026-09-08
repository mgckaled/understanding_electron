import { X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { usePanel } from '../panel/panelContext'
import { useDocs } from './docsContext'
import { DocsIcon } from './icon'

// No `histórico` and no `+` in the header: both presuppose an attached
// consultation, which exists only from 23-G on (D23D.9, DF3B.2).
function DocsPanel(): React.JSX.Element | null {
  const { current, close } = useDocs()
  const { closing, width, setWidth } = usePanel()

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
      {null}
    </SidePanel>
  )
}

export default DocsPanel
