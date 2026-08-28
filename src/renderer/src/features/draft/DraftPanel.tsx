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
import DraftFooter from './DraftFooter'

const READING = 'min-h-[0px] flex-1 overflow-y-auto p-7 select-text'

// Code previews as the file it will become, never through the markdown
// renderer: markdown JOINS consecutive lines into a paragraph and reads four
// leading spaces as a code block, so a class body came out as prose plus a
// nested block, with the line breaks gone (DE2A.9). `whitespace-pre` keeps
// every space; colour by language is E-2-B.
const CODE_PREVIEW =
  'min-h-[0px] flex-1 overflow-auto p-7 font-mono text-sm whitespace-pre text-text selectable'

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
            kind={current?.kind ?? 'markdown'}
            language={current?.language ?? null}
            initialText={current?.content ?? ''}
            onSave={(text) => (id === null ? undefined : update(id, text))}
            onReady={(reader) => (read.current = reader)}
          />
        )
      },
      {
        id: 'previa',
        label: 'Prévia',
        render: () => {
          const text = tab === 'previa' ? read.current() : (current?.content ?? '')
          return current?.kind === 'code' ? (
            <pre className={CODE_PREVIEW}>{text}</pre>
          ) : (
            <div className={READING}>
              <MarkdownMessage text={text} />
            </div>
          )
        }
      }
    ],
    [current?.id, current?.content, current?.kind, id, update, tab]
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
          preview is markdown because four of the export formats are. A code
          draft is the exception, and previews verbatim (DE2A.9). */}
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Modo do rascunho" keepMounted />

      <DraftFooter
        readText={() => read.current()}
        kind={current?.kind ?? 'markdown'}
        onDelete={() => setConfirming(true)}
      />

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
