import { render, screen } from '@testing-library/react'
import MarkdownMessage from './MarkdownMessage'

describe('MarkdownMessage', () => {
  it('wraps a block rendering in a paragraph', () => {
    const { container } = render(<MarkdownMessage text="uma linha" />)

    expect(container.querySelector('p')).not.toBeNull()
  })

  describe('inline', () => {
    // The defect this variant exists for: a snippet title lives inside a
    // truncating <button>, and a block element there breaks the row (D23J.2).
    it('drops the wrapping paragraph and keeps its children', () => {
      const { container } = render(<MarkdownMessage inline text="Rollback using `onMutate`" />)

      expect(container.querySelector('p')).toBeNull()
      expect(container.querySelector('code')?.textContent).toBe('onMutate')
      expect(screen.getByText(/Rollback using/)).toBeInTheDocument()
    })

    // No backtick reaches the screen — the whole point of routing the title
    // through the app's markdown owner instead of writing a splitter.
    it('renders inline code as a chip and never as a literal backtick', () => {
      render(<MarkdownMessage inline text="Rollback using `onMutate`" />)

      expect(screen.queryByText(/`/)).toBeNull()
    })

    // It has to be the size of the control that holds it, so it must NOT carry
    // the block class, which fixes the reading size on its own sheet.
    it('renders a span that does not carry the block class', () => {
      const { container } = render(<MarkdownMessage inline text="um título" />)
      const root = container.firstElementChild

      expect(root?.tagName).toBe('SPAN')
      expect(root?.className).not.toContain('markdown')
      expect(root?.className).toContain('inline')
    })
  })
})
