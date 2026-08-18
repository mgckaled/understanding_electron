import type { CapabilityMeta } from './capabilities'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

/** Sigla in bold beside its icon, in a shape — the hover title carries the
 *  name in full (§ Capabilities of the rascunho). */
function CapabilityChip({ sigla, Icon, label }: CapabilityMeta): React.JSX.Element {
  return (
    <span
      className="flex items-center gap-1 rounded-sm border border-border bg-surface-raised px-3 py-1 text-2xs whitespace-nowrap text-text-muted"
      title={label}
    >
      <Icon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      <span className="font-bold">{sigla}</span>
    </span>
  )
}

export default CapabilityChip
