import { useMemo, useState } from 'react'
import type { DatasetPart } from '@shared/ipc'
import { errorMessage } from '../../shared/ui/messages'
import { useActiveConversation } from '../conversation/conversationsContext'
import DatasetPager, { type PageSize } from '../attachment/DatasetPager'
import DatasetProfileTable from '../attachment/DatasetProfileTable'
import DatasetQueryPanel from '../attachment/DatasetQueryPanel'
import DatasetTable from '../attachment/DatasetTable'
import { useDatasetPreview, DEFAULT_PREVIEW_ROWS } from '../attachment/useDatasetPreview'
import { useDatasetProfile } from '../attachment/useDatasetProfile'
import ArtifactSteps from './ArtifactSteps'
import { proposalsOf } from './proposalsOf'
import { useArtifact } from './artifactContext'
import Tabs from './Tabs'

const NOTE = 'px-5 py-4 text-xs text-text-muted'

function Rows({ part }: { part: DatasetPart }): React.JSX.Element {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PREVIEW_ROWS)
  const state = useDatasetPreview(part.hash, pageSize)

  if (state.status === 'error') {
    return (
      <p className={`${NOTE} text-danger-text selectable`} role="alert">
        {errorMessage(state.error)}
      </p>
    )
  }
  if (state.status !== 'ready') {
    return (
      <p className={NOTE} role="status">
        {state.status === 'empty' ? 'Arquivo sem linhas de dado.' : 'Carregando linhas…'}
      </p>
    )
  }

  // The engine's own schema, never part.columns: the two sniffers can disagree
  // on an ambiguous CSV (D18C.7), and showing the engine's answer is what makes
  // that visible. Row iteration, not vector.toArray() — that one turns NULL
  // into 0 without saying so.
  const columns = state.data.schema.fields.map((field) => field.name)
  const rows: unknown[][] = []
  for (const row of state.data) rows.push(row.toArray())

  return (
    <>
      <DatasetTable columns={columns} rows={rows} fill />
      <DatasetPager
        first={1}
        shown={rows.length}
        total={part.rowCount}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  )
}

function Profile({ hash }: { hash: string }): React.JSX.Element {
  const state = useDatasetProfile(hash, true)

  if (state.status === 'error') {
    return (
      <p className={`${NOTE} text-danger-text selectable`} role="alert">
        {errorMessage(state.error)}
      </p>
    )
  }
  if (state.status !== 'ready') {
    return (
      <p className={NOTE} role="status">
        Calculando perfil…
      </p>
    )
  }
  return <DatasetProfileTable profile={state.data} fill />
}

/** The panel body for a dataset: the views the card used to stack inline (DF3D.1). */
function ArtifactDataset({ part }: { part: DatasetPart }): React.JSX.Element {
  const conversation = useActiveConversation()
  const { proposalId } = useArtifact()
  const messages = conversation?.messages
  const proposals = useMemo(() => proposalsOf(messages ?? [], part.hash), [messages, part.hash])
  // The one that was asked for, or the newest — the transcript is the index,
  // so the tab carries no navigation of its own (DF3F.2).
  const proposal =
    proposals.find((candidate) => candidate.messageId === proposalId) ??
    proposals[proposals.length - 1]
  const [tab, setTab] = useState(proposalId === null ? 'dados' : 'passos')

  return (
    <Tabs
      label="Vistas do arquivo"
      active={tab}
      onChange={setTab}
      tabs={[
        { id: 'dados', label: 'Dados', render: () => <Rows part={part} /> },
        { id: 'perfil', label: 'Perfil', render: () => <Profile hash={part.hash} /> },
        // Typed SQL dies with the panel, by decision (DF3D.8): it is work in
        // progress per dataset, and keeping it would mean a map by hash.
        {
          id: 'consulta',
          label: 'Consulta',
          render: () => <DatasetQueryPanel hash={part.hash} fill />
        },
        {
          id: 'passos',
          label: 'Passos',
          render: () =>
            proposal === undefined ? (
              <p className={NOTE}>Nenhuma proposta ainda. Peça uma no cartão do arquivo.</p>
            ) : (
              <ArtifactSteps
                key={proposal.messageId}
                proposal={proposal}
                hash={part.hash}
                rowCount={part.rowCount}
              />
            )
        }
      ]}
    />
  )
}

export default ArtifactDataset
