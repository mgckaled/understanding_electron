import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { CloudProvider } from '@shared/ipc'
import { CLOUD_PROVIDERS } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import Field, { type FieldControlProps } from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { errorMessage } from '../../shared/ui/messages'
import { useCloudSecret } from './useCloudSecret'

// The credential lives per PROVIDER, never per model (DN1A.5) — one field per
// entry in CLOUD_PROVIDERS, a Google AI Studio key authenticating every
// Gemini model the account can reach.
const PROVIDER_LABEL: Record<CloudProvider, string> = {
  gemini: 'Google (Gemini)',
  glm: 'Z.ai (GLM)'
}

/**
 * The eye toggle lives INSIDE the control Field clones (DN1A.3, passo 6): if
 * the eye button sat beside a plain `<input>` inside a wrapping `<div>`,
 * Field's `cloneElement` would inject `id`/`aria-describedby` onto that div
 * instead of the input, and `<label htmlFor>` would point at a non-labelable
 * element. Forwarding both props into the real input here keeps the
 * association correct.
 */
function MaskedApiKeyInput({
  id,
  'aria-describedby': describedBy,
  value,
  onChange
}: FieldControlProps & { value: string; onChange: (value: string) => void }): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        aria-describedby={describedBy}
        type={revealed ? 'text' : 'password'}
        className="w-full rounded-md border border-border bg-surface-sunken py-3 pr-11 pl-4 font-ui text-sm text-text select-text focus-visible:border-accent-text focus-visible:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        placeholder="Colar a chave da API"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        shape="square"
        // absolute! (not absolute): Button's own BASE sets `relative`, and
        // whichever of the two wins is decided by generation order in the
        // compiled stylesheet, not by this string (Button.tsx's own SHAPE
        // comment already flags this class of conflict) — measured live: the
        // button rendered on its own line below the input without the `!`.
        className="absolute! inset-y-0 right-1 my-auto"
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? 'Ocultar chave' : 'Mostrar chave'}
      >
        {revealed ? (
          <EyeOff size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        ) : (
          <Eye size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        )}
      </Button>
    </div>
  )
}

function ConfiguredRow({
  label,
  onReplace,
  onRemove,
  removing
}: {
  label: string
  onReplace: () => void
  onRemove: () => void
  removing: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-sunken px-4 py-3">
        <span className="flex-1 font-mono text-sm text-text-muted">••••••••••</span>
        <span className="flex-none text-2xs text-text-faint">chave gravada</span>
        <Button type="button" variant="secondary" className="flex-none" onClick={onReplace}>
          Substituir
        </Button>
        <Button
          type="button"
          variant="danger"
          className="flex-none"
          loading={removing}
          onClick={onRemove}
        >
          Remover
        </Button>
      </div>
    </div>
  )
}

function CloudSecretField({ provider }: { provider: CloudProvider }): React.JSX.Element | null {
  const {
    loaded,
    hasKey,
    editing,
    startEditing,
    stopEditing,
    write,
    writing,
    writeError,
    weakBackend,
    remove,
    removing
  } = useCloudSecret(provider)
  const [apiKey, setApiKey] = useState('')

  // Same DS-4 rule ThemeField/ThreadsField already follow: nothing renders
  // until the stored state has actually arrived.
  if (!loaded) return null

  if (!editing) {
    return (
      <ConfiguredRow
        label={PROVIDER_LABEL[provider]}
        onReplace={startEditing}
        onRemove={remove}
        removing={removing}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={PROVIDER_LABEL[provider]}
        hint="Fica cifrada pelo sistema operacional, nunca lida de volta."
      >
        <MaskedApiKeyInput value={apiKey} onChange={setApiKey} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          className="flex-none"
          loading={writing}
          disabled={apiKey.length === 0}
          onClick={() => write(apiKey)}
        >
          Salvar
        </Button>
        {hasKey && (
          <Button type="button" variant="ghost" className="flex-none" onClick={stopEditing}>
            Cancelar
          </Button>
        )}
      </div>
      {weakBackend && (
        <p
          className="rounded-md border border-warn-text bg-surface-sunken px-4 py-3 text-xs text-warn-text"
          role="alert"
        >
          Gravada, mas este sistema não tem um cofre de senhas ativo — a chave fica protegida por
          uma senha fixa do sistema operacional, mais fraca que o normal.
        </p>
      )}
      {writeError && (
        <p className="text-xs text-danger-text" role="alert">
          {errorMessage(writeError)}
        </p>
      )}
    </div>
  )
}

function CloudSecrets(): React.JSX.Element {
  return (
    <section className="mt-7 border-t border-border pt-6">
      <h3 className="mb-3 text-sm text-text">Chaves de nuvem</h3>
      <p className="mb-6 text-xs text-text-muted">
        Opcional. Sem chave, o app só usa modelos locais via Ollama.
      </p>
      <div className="flex flex-col gap-6">
        {CLOUD_PROVIDERS.map((provider) => (
          <CloudSecretField key={provider} provider={provider} />
        ))}
      </div>
    </section>
  )
}

export default CloudSecrets
