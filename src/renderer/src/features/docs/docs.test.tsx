import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import { useConversations } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'

const PANEL = { name: 'Consulta de documentação' }

let api: Api

function Probe(): React.JSX.Element {
  const { toggle } = useDocs()
  const { conversations, select } = useConversations()
  return (
    <>
      <button type="button" onClick={(event) => toggle(event.currentTarget)}>
        consultar documentação
      </button>
      {conversations.map((conversation) => (
        <button key={conversation.id} type="button" onClick={() => select(conversation.id)}>
          ir para {conversation.title}
        </button>
      ))}
    </>
  )
}

async function mount(): Promise<void> {
  api = installApiMock()
  await api.conversation.create({ id: 'c1', title: 'Primeira', createdAt: 1000 })
  await api.conversation.create({ id: 'c2', title: 'Segunda', createdAt: 2000 })
  render(providers(<Probe />))
  await screen.findByRole('button', { name: 'ir para Primeira' })
  await userEvent.click(screen.getByRole('button', { name: 'ir para Primeira' }))
}

describe('painel de documentação', () => {
  it('opens the side region as its own tenant', async () => {
    await mount()

    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByRole('complementary', PANEL)).toBeInTheDocument()
  })

  it('closes on the header button', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))

    await waitFor(() => expect(screen.queryByRole('complementary', PANEL)).not.toBeInTheDocument())
  })

  // A consultation follows the next message of the conversation it was written
  // in (D23D.2), so the region cannot stay ours across navigation. Asserted by
  // reopening and by `data-closing`, never by absence: the panel unmounts on
  // navigation either way, and a region still marked as ours reads the next
  // click as a close — which paints the panel for one fade before dropping it
  // (DE1B.1, DF3C.1).
  it('gives the region up when the conversation changes', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.click(screen.getByRole('button', { name: 'ir para Segunda' }))

    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByRole('complementary', PANEL)).not.toHaveAttribute('data-closing')
  })
})

describe('o formulário da consulta', () => {
  async function compose(): Promise<void> {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')
  }

  // DM-22: the warning is permanent, never a first-time consent — it has to be
  // on screen in the turn the question leaves the machine.
  it('warns that the question leaves the machine', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(
      screen.getByText('A pergunta é enviada ao Context7, mesmo em conversa local.')
    ).toBeInTheDocument()
  })

  // DM-12, situação 1: a blank field is a 400 the app must never spend. Each
  // field is left empty in its own turn — filling them in one fixed order
  // passes against a rule that reads only the second one.
  it.each([
    ['Biblioteca', 'Pergunta'],
    ['Pergunta', 'Biblioteca']
  ])('holds Consultar with only %s filled', async (filled, empty) => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    await userEvent.type(screen.getByLabelText(filled), 'alguma coisa')

    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(empty), 'e outra')
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled()
  })

  it('keeps what was typed when the panel is closed and reopened', async () => {
    await compose()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByLabelText('Biblioteca')).toHaveValue('tanstack query')
  })

  it('drops it when the conversation changes', async () => {
    await compose()

    await userEvent.click(screen.getByRole('button', { name: 'ir para Segunda' }))
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByLabelText('Biblioteca')).toHaveValue('')
  })
})
