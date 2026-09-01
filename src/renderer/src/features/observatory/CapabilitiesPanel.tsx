import { findEmbedders } from '@core/ai/models'
import type { AiModel, AiService, CloudProvider } from '@shared/ipc'
import { CLOUD_PROVIDERS } from '@shared/ipc'
import CapabilityChip from '../../shared/ui/CapabilityChip/CapabilityChip'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { formatSize } from '../../shared/format'
import { capabilityChips } from '../conversation/capabilities'
import { formatContext } from '../conversation/modelFormat'
import LoadedModels from './LoadedModels'
import { AI_SERVICES, useCapabilities, type ServiceCapability } from './useCapabilities'

const SERVICE_LABEL: Record<AiService, string> = {
  ollama: 'Ollama',
  glm: 'GLM (Z.ai)',
  gemini: 'Gemini (Google)'
}

const CLOUD_LABEL: Record<CloudProvider, string> = {
  gemini: 'Gemini',
  glm: 'GLM'
}

const CELL = 'px-3 py-2 text-xs'

// table-fixed + identical widths across every ModelsTable (one per service,
// plus Embedder): otherwise each table sizes columns off its own content and
// "Modelo" lands at a different x per section.
const COLUMN_WIDTHS = ['w-[34%]', 'w-[12%]', 'w-[12%]', 'w-[12%]', 'w-[30%]']

const relativeAge = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

/** "medido há Xmin" (§ 4.3) from the query's own `dataUpdatedAt` — never a separate clock. */
function formatAge(dataUpdatedAt: number): string {
  const minutes = Math.round((dataUpdatedAt - Date.now()) / 60_000)
  return relativeAge.format(minutes, 'minute')
}

function ModelsTable({ models }: { models: AiModel[] }): React.JSX.Element {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        {COLUMN_WIDTHS.map((width, index) => (
          <col key={index} className={width} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Modelo</th>
          <th className={CELL}>Parâmetros</th>
          <th className={CELL}>Tamanho</th>
          <th className={CELL}>Contexto</th>
          <th className={CELL}>Capacidades</th>
        </tr>
      </thead>
      <tbody>
        {models.map((model) => (
          <tr key={model.name} className="border-b border-border last:border-b-0">
            <td className={`${CELL} font-mono text-text select-text`}>
              {model.name}
              {model.variantOf !== null && (
                <span className="ml-2 text-2xs text-text-faint">variante de {model.variantOf}</span>
              )}
            </td>
            <td className={`${CELL} text-text-muted`}>{model.parameterSize || '—'}</td>
            <td className={`${CELL} font-mono text-text-muted`}>{formatSize(model.sizeBytes)}</td>
            <td className={`${CELL} font-mono text-text-muted`}>
              {formatContext(model.contextLength) ?? '—'}
            </td>
            <td className={CELL}>
              <div className="flex flex-wrap gap-1">
                {capabilityChips(model).map((chip) => (
                  <CapabilityChip key={chip.capability} {...chip} />
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ServiceSection({
  service,
  capability
}: {
  service: AiService
  capability: ServiceCapability
}): React.JSX.Element {
  return (
    <section>
      <h4 className="mb-2 text-xs text-text-muted uppercase">{SERVICE_LABEL[service]}</h4>
      <StateView
        state={capability.availability}
        render={(availability) => (
          <p className="mb-2 text-xs text-text">
            Disponível — {availability.version}
            {availability.host ? ` (${availability.host})` : ''}
          </p>
        )}
      />
      <StateView
        state={capability.models}
        emptyMessage="Nenhum modelo instalado."
        render={(models) => <ModelsTable models={models} />}
      />
    </section>
  )
}

function EmbeddersSection({
  services
}: {
  services: Record<AiService, ServiceCapability>
}): React.JSX.Element | null {
  const ready = Object.values(services).flatMap((capability) =>
    capability.models.status === 'ready' ? capability.models.data : []
  )
  const embedders = findEmbedders(ready)
  if (embedders.length === 0) return null

  return (
    <section>
      <h4 className="mb-2 text-xs text-text-muted uppercase">Embedder</h4>
      <ModelsTable models={embedders} />
    </section>
  )
}

function CloudKeysSection({
  cloudKeys
}: {
  cloudKeys: Record<CloudProvider, boolean>
}): React.JSX.Element {
  return (
    <section>
      <h4 className="mb-2 text-xs text-text-muted uppercase">Chaves de nuvem</h4>
      <dl className="flex flex-col">
        {CLOUD_PROVIDERS.map((provider) => (
          <div
            key={provider}
            className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0"
          >
            <dt className="text-xs text-text-muted">{CLOUD_LABEL[provider]}</dt>
            <dd className="text-xs text-text">
              {cloudKeys[provider] ? 'configurada' : 'não configurada'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function CapabilitiesPanel(): React.JSX.Element {
  const { data, isFetching, dataUpdatedAt, refetch } = useCapabilities()

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Capacidades</h3>
      {data === undefined ? (
        <Button variant="primary" loading={isFetching} onClick={refetch}>
          Sondar capacidades
        </Button>
      ) : (
        <div className="flex flex-col gap-6">
          {AI_SERVICES.map((service) => (
            <ServiceSection key={service} service={service} capability={data.services[service]} />
          ))}
          <EmbeddersSection services={data.services} />
          <CloudKeysSection cloudKeys={data.cloudKeys} />
          <LoadedModels state={data.loadedModels} onUnloaded={refetch} />
          <div className="flex items-center gap-2 text-2xs text-text-faint">
            <span>Medido {formatAge(dataUpdatedAt)}</span>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              loading={isFetching}
              onClick={refetch}
              aria-label="Sondar capacidades de novo"
            >
              ↻
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default CapabilitiesPanel
