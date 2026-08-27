import { useId, useMemo, useRef, useState } from 'react'
import { Trash2, Undo2, X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import Tabs from '../../shared/ui/Tabs/Tabs'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { usePanel } from '../panel/panelContext'
import { useDraft } from './draftContext'
import DraftPicker from './DraftPicker'
import DraftEditor from './DraftEditor'

const READING = 'min-h-[0px] flex-1 overflow-y-auto p-7 select-text'

function DraftPanel(): React.JSX.Element | null {
  const { current, remove, update, close } = useDraft()
  const { closing, width, setWidth } = usePanel()
  const [confirming, setConfirming] = useState(false)
  const [tab, setTab] = useState('editar')
  const describedBy = useId()
  const read = useRef<() => string>(() => '')

  const id = current?.id ?? null

  const tabs = useMemo(
    () => [
      {
        id: 'editar',
        label: 'Editar',
        render: () => (
          <DraftEditor
            draftId={current?.id ?? ''}
            initialText={current?.content ?? ''}
            onSave={(text) => (id === null ? undefined : update(id, text))}
            onReady={(reader) => (read.current = reader)}
          />
        )
      },
      {
        id: 'previa',
        label: 'Prévia',
        render: () => (
          <div className={READING}>
            <MarkdownMessage text={tab === 'previa' ? read.current() : (current?.content ?? '')} />
          </div>
        )
      }
    ],
    [current?.id, current?.content, id, update, tab]
  )

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
      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        label="Modo do rascunho"
        keepMounted
      />

      {/* The bar of what happens to this draft. Discard sits at the far end
          from where `Exportar` lands in E-1-D, and further still from the
          header's close (DE1B.2). */}
      <footer className="flex flex-none items-center border-t border-border px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className="flex-none"
          onClick={() => setConfirming(true)}
          aria-label="Excluir rascunho"
        >
          <Trash2 className="text-danger-text" size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        </Button>
      </footer>

      <Dialog
        open={confirming}
        title="Excluir rascunho"
        onClose={() => setConfirming(false)}
        describedBy={describedBy}
      >
        <p className="mb-6 text-sm" id={describedBy}>
          Deseja excluir “{current.title}” de forma definitiva?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
            <span className="flex items-center gap-2">
              <Undo2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Cancelar
            </span>
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setConfirming(false)
              remove(current.id)
            }}
          >
            <span className="flex items-center gap-2">
              <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Excluir
            </span>
          </Button>
        </div>
      </Dialog>
    </SidePanel>
  )
}

export default DraftPanel
