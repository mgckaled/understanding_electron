import { useCloudSecret } from '../settings/useCloudSecret'
import { useDocsQuota } from './useDocsQuota'

const decimal = new Intl.NumberFormat('pt-BR')

/**
 * The two lines that administer a consultation, on the first screen and only
 * there (D23I.6) — what is left of the quota, and whether the key is in place.
 */
function DocsAdmin(): React.JSX.Element | null {
  const { loaded, hasKey } = useCloudSecret('context7')
  const { quota } = useDocsQuota()

  if (!loaded) return null

  return (
    <div className="flex flex-col gap-1">
      <p className={hasKey ? 'text-xs text-text-faint' : 'text-xs text-warn-text'}>
        {hasKey
          ? 'Chave do Context7 configurada.'
          : 'Sem chave do Context7 — configure em Configurações para consultar.'}
      </p>
      <p className="text-xs text-text-faint">{quotaLine(quota)}</p>
    </div>
  )
}

// Never a zero: the number only exists once an answer has carried the header,
// and showing 0 before that would lie in the direction that frightens (D23I.7).
// Always what the service last said, never the documented constant (D23I.8).
function quotaLine(quota: ReturnType<typeof useDocsQuota>['quota']): string {
  if (quota === null || quota.remaining === null)
    return 'Cota do Context7: sem consulta nesta sessão.'
  const left = decimal.format(quota.remaining)
  return quota.limit === null
    ? `Cota do Context7: ${left} consultas restantes.`
    : `Cota do Context7: ${left} de ${decimal.format(quota.limit)} consultas restantes.`
}

export default DocsAdmin
