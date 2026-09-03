import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConversationWindow } from '@core/ai/budget'
import ContextControl from './ContextControl'

function mount(
  contextWindow: ConversationWindow,
  ceiling = 131072
): {
  onNumCtx: ReturnType<typeof vi.fn>
} {
  const onNumCtx = vi.fn()
  render(
    <ContextControl
      contextWindow={contextWindow}
      current={undefined}
      ceiling={ceiling}
      disabled={false}
      locked={false}
      scopeKey="k"
      onNumCtx={onNumCtx}
    />
  )
  return { onNumCtx }
}

/**
 * The trigger's accessible name is "Janela de contexto" (Field's `<label
 * for>`, associated to the button by id), never the pill's own text — that
 * text is just the button's visible content, not what opens it here.
 * Popover content stays in the DOM under jsdom, just visually hidden
 * (design-system skill, reference.md) — `hidden: true` is required for
 * every query against it.
 */
async function openPopover(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Janela de contexto' }))
}

describe('ContextControl — faixas fixas (21-C-C)', () => {
  it('highlights no band for a value that predates this control, instead of snapping to the nearest one (F2.5)', async () => {
    // 12288 is not one of CONTEXT_BANDS — exactly the case an index domain
    // would get wrong, rounding a pre-existing reservation to 8k or 16k on
    // the first render instead of showing the real, unrounded value.
    const user = userEvent.setup()
    mount({ status: 'open', numCtx: 12_288 })

    await openPopover(user)

    const pressed = screen.queryAllByRole('button', { pressed: true, hidden: true })
    expect(pressed).toHaveLength(0)
  })

  it('commits the exact value of a clicked band, never a rounded one', async () => {
    const user = userEvent.setup()
    const { onNumCtx } = mount({ status: 'open', numCtx: 32_768 })

    await openPopover(user)
    await user.click(screen.getByRole('button', { name: '8k', hidden: true }))

    expect(onNumCtx).toHaveBeenCalledWith(8192)
  })

  it('always offers the real ceiling, even when it falls below the smallest band', async () => {
    const user = userEvent.setup()
    mount({ status: 'open', numCtx: 2048 }, 2048)

    await openPopover(user)

    // CONTEXT_BANDS starts at 4096 — with a 2048 ceiling, the smallest option
    // offered can only be the ceiling itself, not an empty group.
    expect(screen.getByRole('button', { name: '2k', hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '4k', hidden: true })).not.toBeInTheDocument()
  })
})
