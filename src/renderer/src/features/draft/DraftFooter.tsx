import { useEffect, useRef, useState } from 'react'
import { FileDown, Trash2 } from 'lucide-react'
import type { AppError, ExportFormat } from '@shared/ipc'
import { draftTitle } from '@core/draft/title'
import { exportFileName } from '@core/export/fileName'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { errorMessage } from '../../shared/ui/messages'
import FormatPicker from './FormatPicker'

/** How long the outcome stays on the bar. Long enough to read a path. */
const NOTICE_MS = 6000

type Notice = { kind: 'ok'; path: string } | { kind: 'error'; error: AppError }

function DraftFooter({
  readText,
  onDelete
}: {
  /** The live document, so exporting never races the blur that saves (DE1D.8). */
  readText: () => string
  onDelete: () => void
}): React.JSX.Element {
  const [format, setFormat] = useState<ExportFormat>('md')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => (timer.current === null ? undefined : clearTimeout(timer.current)), [])

  function show(next: Notice): void {
    setNotice(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }

  async function exportNow(): Promise<void> {
    setSaving(true)
    // Both the text and the name come from the live document: the stored title
    // is still the one from before this edit until the blur lands.
    const text = readText()
    const result = await window.api.export.save({
      text,
      format,
      suggestedName: exportFileName(draftTitle(text), format)
    })
    setSaving(false)

    if (!result.ok) show({ kind: 'error', error: result.error })
    // A cancelled dialog says nothing: the user already knows what they did.
    else if (result.value !== null) show({ kind: 'ok', path: result.value.path })
  }

  return (
    <footer className="flex flex-none items-center gap-3 border-t border-border px-5 py-3">
      <FormatPicker current={format} onChange={setFormat} />
      <Button variant="primary" size="sm" loading={saving} onClick={() => void exportNow()}>
        <span className="flex items-center gap-2">
          <FileDown size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          Exportar
        </span>
      </Button>

      {/* Announced without stealing focus, and F-5 absorbs this line when the
          Toast exists — it does not duplicate it (DE1D.7). */}
      <p
        role="status"
        className={`min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs ${
          notice?.kind === 'error' ? 'text-danger-text' : 'text-text-muted'
        }`}
        title={notice?.kind === 'ok' ? notice.path : undefined}
      >
        {notice === null
          ? ''
          : notice.kind === 'ok'
            ? `Exportado em ${notice.path}`
            : errorMessage(notice.error)}
      </p>

      <Button variant="ghost" size="sm" className="flex-none" onClick={onDelete}>
        <span className="flex items-center gap-2 text-danger-text">
          <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          Apagar rascunho
        </span>
      </Button>
    </footer>
  )
}

export default DraftFooter
