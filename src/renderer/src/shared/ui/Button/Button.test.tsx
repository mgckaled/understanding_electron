import { render, screen } from '@testing-library/react'
import Button from './Button'

describe('Button', () => {
  it('keeps a text label as the accessible name while loading', () => {
    render(<Button loading>Executar</Button>)
    expect(screen.getByRole('button', { name: 'Executar' })).toHaveAttribute('aria-busy', 'true')
  })

  it('lets an explicit aria-label win over the loading fallback', () => {
    render(
      <Button loading aria-label="Enviar">
        <span aria-hidden="true">→</span>
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument()
  })

  it('disables the button while loading', () => {
    render(<Button loading>Executar</Button>)
    expect(screen.getByRole('button', { name: 'Executar' })).toBeDisabled()
  })
})
