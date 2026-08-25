// Step/StepProposal cross the IPC boundary (dataset:transform's args, D19.1)
// and feed Ollama's format/`.parse()` (D19.3) — shared/ipc.ts owns the
// schemas, core/ imports from shared/, never the other way (same pattern as
// ColumnProfile, core/duckdb/profile.ts).
export {
  filterOperatorSchema,
  filterStepSchema,
  sortStepSchema,
  limitStepSchema,
  dropColumnsStepSchema,
  renameColumnStepSchema,
  fillMissingStrategySchema,
  fillMissingStepSchema,
  stepSchema,
  stepProposalSchema,
  stepProposalJsonSchema,
  stepProposalPartSchema
} from '@shared/ipc'
export type {
  FilterOperator,
  FilterStep,
  SortStep,
  LimitStep,
  DropColumnsStep,
  RenameColumnStep,
  FillMissingStrategy,
  FillMissingStep,
  Step,
  StepProposal,
  StepProposalPart
} from '@shared/ipc'
