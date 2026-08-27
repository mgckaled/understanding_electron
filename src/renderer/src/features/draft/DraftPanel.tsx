import { X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { usePanel } from '../panel/panelContext'
import { useDraft } from './draftContext'
import DraftPicker from './DraftPicker'

const READING = 'min-h-[0px] flex-1 overflow-y-auto p-7 select-text'

function DraftPanel(): React.JSX.Element | null {
  const { current, close } = useDraft()
  const { closing, width, setWidth } = usePanel()

  if (current === null) return null

  return (
    <SidePanel
      label="Rascunho aberto"
      contentKey={current.id}
      closing={closing}
      width={width}
      setWidth={setWidth}
      onClose={close}
      header={
        <>
          <DraftPicker current={current} />
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
      {/* Reading density (D13.5) — a draft is prose read for a minute, and the
          preview is markdown because four of the export formats are. */}
      <div className={READING}>
        <MarkdownMessage text={current.content} />
      </div>
    </SidePanel>
  )
}

export default DraftPanel
