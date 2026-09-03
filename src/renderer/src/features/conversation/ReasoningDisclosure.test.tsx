import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReasoningDisclosure from './ReasoningDisclosure'

describe('ReasoningDisclosure', () => {
  it('starts closed without thinking, and toggles on click', async () => {
    const user = userEvent.setup()
    render(<ReasoningDisclosure text="Analisando o arquivo." provider="ollama" />)

    const trigger = screen.getByRole('button', { name: 'Ollama' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts open when thinking is true on mount', () => {
    render(<ReasoningDisclosure text="Analisando o arquivo." provider="glm" thinking={true} />)

    expect(screen.getByRole('button', { name: 'GLM (Z.ai)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('auto-collapses when thinking flips to false', () => {
    const { rerender } = render(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={true} />
    )
    const trigger = screen.getByRole('button', { name: 'Ollama' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    rerender(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={false} />
    )
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps a manual override across the rest of the turn', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={true} />
    )
    const trigger = screen.getByRole('button', { name: 'Ollama' })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    rerender(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={false} />
    )
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps the lightbulb mounted, lit only while thinking is true', () => {
    const { container, rerender } = render(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={true} />
    )
    expect(container.querySelector('.animate-pulse-warn')).not.toBeNull()
    expect(container.querySelector('svg.lucide-lightbulb')).not.toBeNull()

    rerender(
      <ReasoningDisclosure text="Analisando o arquivo." provider="ollama" thinking={false} />
    )
    expect(container.querySelector('.animate-pulse-warn')).toBeNull()
    expect(container.querySelector('svg.lucide-lightbulb')).not.toBeNull()

    rerender(<ReasoningDisclosure text="Analisando o arquivo." provider="ollama" />)
    expect(container.querySelector('.animate-pulse-warn')).toBeNull()
    expect(container.querySelector('svg.lucide-lightbulb')).not.toBeNull()
  })
})
