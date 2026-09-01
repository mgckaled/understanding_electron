import { HelpCircle, Image, Lightbulb, Mic, Network, PenLine, Wrench } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import type { CapabilityMeta } from '../../shared/ui/CapabilityChip/CapabilityChip'

// The sigla+icon scheme the rascunho asked for, condensing the 6 capabilities
// Ollama classifies today — validated against ollama/ollama's own
// server/images.go, not just the rascunho's list (F2.1). `completion` stays
// out: it is on every model, says nothing, and was already dropped before
// this scheme existed (ModelPicker's old `badges()`). `tools`/`thinking` get
// two letters, not one — a single "T" collides between them.

const CAPABILITY_META: Record<string, CapabilityMeta> = {
  vision: { sigla: 'IM', Icon: Image, label: 'Imagem — entende imagens anexadas' },
  tools: { sigla: 'TO', Icon: Wrench, label: 'Ferramentas — function calling' },
  insert: {
    sigla: 'IN',
    Icon: PenLine,
    label: 'Inserção — fill-in-middle, autocomplete com sufixo'
  },
  embedding: { sigla: 'E', Icon: Network, label: 'Embedding — para RAG e busca semântica' },
  thinking: { sigla: 'TH', Icon: Lightbulb, label: 'Raciocínio — cadeia de pensamento explícita' },
  audio: { sigla: 'AU', Icon: Mic, label: 'Áudio — entende áudio anexado' } // DO4.9
}

const UNKNOWN: Omit<CapabilityMeta, 'sigla'> = {
  Icon: HelpCircle,
  label: 'Capacidade sem descrição nesta versão do app'
}

export type CapabilityChipEntry = CapabilityMeta & { capability: string }

/** One entry per capability the model declares, `completion` dropped. A
 *  capability with no meta of its own still renders, under a two-letter
 *  fallback sigla — same promise the old `badges()` kept when `insert`
 *  arrived unpredicted. */
export function capabilityChips(model: AiModel): CapabilityChipEntry[] {
  return model.capabilities
    .filter((capability) => capability !== 'completion')
    .map((capability) => ({
      capability,
      ...(CAPABILITY_META[capability] ?? {
        sigla: capability.slice(0, 2).toUpperCase(),
        ...UNKNOWN
      })
    }))
}
