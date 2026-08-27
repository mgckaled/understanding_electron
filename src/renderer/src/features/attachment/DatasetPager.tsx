import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'

/** Page sizes the SQL may carry. Closed list: the value is interpolated, never bound (D18B.3). */
export const PAGE_SIZES = [25, 50, 100, 200] as const

export type PageSize = (typeof PAGE_SIZES)[number]

/**
 * The row range, the total, and the controls to move through it.
 *
 * The arrows are disabled while `onPrev`/`onNext` are absent — the channel has
 * no `OFFSET` yet. Disabled rather than hidden, against DF3A.7's letter and
 * with its reasoning: that rule greys nothing out because the capability is
 * not coming back, and this one is scheduled (DF3D.4).
 *
 * @param first - 1-based index of the first row on screen.
 */
function DatasetPager({
  first,
  shown,
  total,
  pageSize,
  onPageSize,
  onPrev,
  onNext
}: {
  first: number
  shown: number
  total: number
  pageSize: PageSize
  onPageSize: (size: PageSize) => void
  onPrev?: () => void
  onNext?: () => void
}): React.JSX.Element {
  const last = first + shown - 1

  return (
    // Wraps instead of overflowing: at the panel's 352px floor the range and
    // the four sizes do not share a line.
    <div className="flex flex-none flex-wrap items-center gap-x-2 gap-y-2 border-t border-border px-5 py-2">
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        className="flex-none"
        disabled={onPrev === undefined}
        onClick={onPrev}
        aria-label="Página anterior"
      >
        <ChevronLeft size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
      <span className="flex-none font-ui text-xs text-text-muted tabular-nums">
        {shown === 0
          ? 'Nenhuma linha'
          : `${first.toLocaleString('pt-BR')}–${last.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        className="flex-none"
        disabled={onNext === undefined}
        onClick={onNext}
        aria-label="Próxima página"
      >
        <ChevronRight size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
      <div className="ml-auto flex flex-none gap-1" role="group" aria-label="Linhas por página">
        {PAGE_SIZES.map((size) => (
          <Button
            key={size}
            variant={size === pageSize ? 'primary' : 'ghost'}
            size="sm"
            className="flex-none tabular-nums"
            aria-pressed={size === pageSize}
            onClick={() => onPageSize(size)}
          >
            {size}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default DatasetPager
