import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart } from '@shared/ipc'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { fakeArtifactApi } from '@test/artifact-api'
import ArtifactPicker from './ArtifactPicker'

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'notas.md',
  format: 'md',
  text: 'x'
}
const IMG: ImagePart = {
  kind: 'image',
  hash: 'h-img',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}
const DOC_REF: ArtifactRef = { kind: 'document', id: 'h-doc', part: DOC }
const IMG_REF: ArtifactRef = { kind: 'image', id: 'h-img', part: IMG }

function mount(artifacts: ArtifactRef[], current: ArtifactRef): ReturnType<typeof fakeArtifactApi> {
  const api = fakeArtifactApi(current, artifacts)
  render(
    <ArtifactContext value={api}>
      <ArtifactPicker current={current} />
    </ArtifactContext>
  )
  return api
}

// ⚠️ `{ hidden: true }` throughout: jsdom's own default stylesheet carries
// `[popover]:not(:popover-open) { display:none }`, which the project's shim
// does not reach, so ALL popover content computes as hidden here (skill
// design-system). Every other Popover consumer queries the same way.
describe('ArtifactPicker', () => {
  it('is a plain title, not a control, when there is nothing to switch to', () => {
    mount([DOC_REF], DOC_REF)

    // Not a disabled control either: a box with a chevron that never opens is
    // an affordance that lies.
    expect(screen.queryByRole('button', { hidden: true })).toBeNull()
    expect(screen.getByText('notas.md')).toBeVisible()
  })

  it('becomes a trigger once the conversation has a second artifact', async () => {
    mount([DOC_REF, IMG_REF], DOC_REF)
    const trigger = screen.getByRole('button', { name: /notas\.md/ })

    expect(trigger).toBeEnabled()
    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'grafico.png', hidden: true })).toBeInTheDocument()
  })

  it('switches to the artifact that was picked', async () => {
    const api = mount([DOC_REF, IMG_REF], DOC_REF)

    await userEvent.click(screen.getByRole('button', { name: /notas\.md/ }))
    await userEvent.click(screen.getByRole('button', { name: 'grafico.png', hidden: true }))

    expect(api.toggle).toHaveBeenCalledWith(IMG_REF, null)
  })

  it('does NOT close the panel when the open artifact is picked again', async () => {
    // `toggle` closes on the artifact already open (DF3A.6) — right for a card,
    // wrong for a list, where picking the current item means "stay".
    const api = mount([DOC_REF, IMG_REF], DOC_REF)

    await userEvent.click(screen.getByRole('button', { name: /notas\.md/ }))
    await userEvent.click(screen.getAllByRole('button', { name: 'notas.md', hidden: true })[1])

    expect(api.toggle).not.toHaveBeenCalled()
  })

  it('marks the open one in the list', async () => {
    mount([DOC_REF, IMG_REF], DOC_REF)

    await userEvent.click(screen.getByRole('button', { name: /notas\.md/ }))

    const rows = screen.getAllByRole('button', { hidden: true }).slice(1)
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    expect(rows[1]).not.toHaveAttribute('aria-current')
  })
})
