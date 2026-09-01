import { render, screen } from '@testing-library/react'
import { TEST_MODEL } from '@test/api-mock'
import type { AiModel } from '@shared/ipc'
import CapabilityChip from '../../shared/ui/CapabilityChip/CapabilityChip'
import { capabilityChips } from './capabilities'

describe('capabilityChips', () => {
  it('drops completion and maps each known capability to its sigla (F2.1)', () => {
    const model: AiModel = { ...TEST_MODEL, capabilities: ['completion', 'vision', 'tools'] }

    const chips = capabilityChips(model)

    expect(chips.map((chip) => chip.capability)).toEqual(['vision', 'tools'])
    expect(chips.map((chip) => chip.sigla)).toEqual(['IM', 'TO'])
  })

  it('gives tools and thinking distinct siglas, not the same "T"', () => {
    const model: AiModel = { ...TEST_MODEL, capabilities: ['tools', 'thinking'] }

    const [tools, thinking] = capabilityChips(model)

    expect(tools?.sigla).toBe('TO')
    expect(thinking?.sigla).toBe('TH')
  })

  it('falls back to a raw sigla for a capability with no meta of its own', () => {
    const model: AiModel = { ...TEST_MODEL, capabilities: ['completion', 'reasoning-x'] }

    const [chip] = capabilityChips(model)

    expect(chip?.capability).toBe('reasoning-x')
    expect(chip?.sigla).toBe('RE')
  })

  // DO4.9: the sigla alone does not discriminate — 'audio'.slice(0,2).toUpperCase()
  // is already 'AU', same as the fallback above would produce. The label is what proves
  // CAPABILITY_META carries a real entry, not the UNKNOWN fallback landing on the same letters.
  it('gives audio its own label, not the generic unknown-capability one', () => {
    const model: AiModel = { ...TEST_MODEL, capabilities: ['completion', 'audio'] }

    const [chip] = capabilityChips(model)

    expect(chip?.sigla).toBe('AU')
    expect(chip?.label).toBe('Áudio — entende áudio anexado')
  })
})

describe('CapabilityChip', () => {
  it('renders the sigla and carries the full label as the hover title', () => {
    const [chip] = capabilityChips({ ...TEST_MODEL, capabilities: ['vision'] })
    render(<CapabilityChip {...chip!} />)

    const rendered = screen.getByTitle('Imagem — entende imagens anexadas')
    expect(rendered).toHaveTextContent('IM')
  })
})
