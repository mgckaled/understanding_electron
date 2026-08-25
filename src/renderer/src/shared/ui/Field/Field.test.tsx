import { render, screen } from '@testing-library/react'
import Field from './Field'

describe('Field', () => {
  it('links the control to the hint via aria-describedby', () => {
    render(
      <Field label="Nome" hint="Como aparece na lista">
        <input />
      </Field>
    )
    const input = screen.getByRole('textbox', { name: 'Nome' })
    expect(input).toHaveAccessibleDescription('Como aparece na lista')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the control aria-invalid and describes it by the error, not the hint', () => {
    render(
      <Field label="Nome" hint="Como aparece na lista" error="Nome obrigatório">
        <input />
      </Field>
    )
    const input = screen.getByRole('textbox', { name: 'Nome' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Nome obrigatório')
    expect(screen.getByRole('alert')).toHaveTextContent('Nome obrigatório')
  })
})
