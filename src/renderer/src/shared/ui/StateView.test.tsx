import { render, screen } from '@testing-library/react'
import type { AppError } from '@shared/ipc'
import StateView from './StateView'

describe('StateView', () => {
  it('renders nothing for idle', () => {
    const { container } = render(<StateView state={{ status: 'idle' }} render={() => null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an indeterminate progress bar for loading without a total', () => {
    render(<StateView state={{ status: 'loading' }} render={() => null} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders a determinate progress bar for loading with a known total', () => {
    render(
      <StateView
        state={{
          status: 'loading',
          progress: { jobId: 'job-1', type: 'progress', phase: 'scanning', done: 3, total: 10 }
        }}
        render={() => null}
      />
    )

    const bar = screen.getByRole('status').querySelector('progress')
    expect(bar).toHaveAttribute('value', '3')
    expect(bar).toHaveAttribute('max', '10')
  })

  it('delegates ready to render', () => {
    render(
      <StateView state={{ status: 'ready', data: 'hello' }} render={(data) => <p>{data}</p>} />
    )

    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('renders the empty message for empty', () => {
    render(<StateView state={{ status: 'empty' }} render={() => null} emptyMessage="Nada aqui." />)

    expect(screen.getByText('Nada aqui.')).toBeInTheDocument()
  })

  it('renders a cancelled message for cancelled', () => {
    render(<StateView state={{ status: 'cancelled' }} render={() => null} />)

    expect(screen.getByText('Operação cancelada.')).toBeInTheDocument()
  })

  it('renders the mapped error message for error', () => {
    const error: AppError = { kind: 'not-found', path: '/x' }
    render(<StateView state={{ status: 'error', error }} render={() => null} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Arquivo não encontrado.')
  })
})
