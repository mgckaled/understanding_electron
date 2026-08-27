import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DatasetPart, StepProposalPart } from '@shared/ipc'
import { fakeArtifactApi } from '@test/artifact-api'
import { ArtifactContext, type ArtifactRef } from '../artifact/artifactContext'
import StepProposalLine from './StepProposalLine'

const DATA: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id'],
  rowCount: 10
}
const REF: ArtifactRef = { kind: 'dataset', id: 'h1', part: DATA }

const PART: StepProposalPart = {
  kind: 'stepProposal',
  hash: 'h1',
  proposalKind: 'steps',
  steps: [
    { kind: 'filter', column: 'idade', operator: 'gt', value: 18 },
    { kind: 'limit', count: 100 }
  ]
}

function mount(artifacts: ArtifactRef[] = [REF]): ReturnType<typeof fakeArtifactApi> {
  const api = fakeArtifactApi(null, artifacts)
  render(
    <ArtifactContext value={api}>
      <StepProposalLine part={PART} messageId="m1" />
    </ArtifactContext>
  )
  return api
}

describe('StepProposalLine', () => {
  it('says what the model proposed, and for which file', () => {
    mount()

    expect(screen.getByRole('button', { name: /Propus 2 passos para vendas\.csv/ })).toBeVisible()
  })

  // DF3F.2: the transcript is the index, so the line has to say WHICH proposal
  // the tab should open — the newest is only the fallback.
  it('opens the panel on its own proposal, with itself as the trigger', async () => {
    const api = mount()
    const line = screen.getByRole('button')

    await userEvent.click(line)

    expect(api.toggle).toHaveBeenCalledWith(REF, line, 'm1')
  })

  it('stops being a control when the file left the conversation', () => {
    mount([])

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/não está mais nesta conversa/)).toBeVisible()
  })
})
