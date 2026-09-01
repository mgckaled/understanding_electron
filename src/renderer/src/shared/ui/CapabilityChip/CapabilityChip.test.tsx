import { render, screen } from '@testing-library/react'
import { Image } from 'lucide-react'
import CapabilityChip from './CapabilityChip'

describe('CapabilityChip', () => {
  it('renders the sigla and carries the full label as the hover title', () => {
    render(<CapabilityChip sigla="IM" Icon={Image} label="Imagem — entende imagens anexadas" />)

    const rendered = screen.getByTitle('Imagem — entende imagens anexadas')
    expect(rendered).toHaveTextContent('IM')
  })
})
