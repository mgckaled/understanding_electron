import { z } from 'zod'

// The six operations D19.1 scopes for this cut — the rest of ESCOPO.md's
// camada 1 (split column, regex extract, aggregation) is a registered
// fast-follow, not an oversight.
export const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'isNull',
  'isNotNull'
])
export type FilterOperator = z.infer<typeof filterOperatorSchema>

// `value` is absent for isNull/isNotNull and required for the rest — left
// unenforced here on purpose: a zod refinement would not survive
// z.toJSONSchema() (D19.3), so the compiler (passo 2) is where a missing
// value for an operator that needs one gets rejected.
export const filterStepSchema = z.object({
  kind: z.literal('filter'),
  column: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
})
export type FilterStep = z.infer<typeof filterStepSchema>

export const sortStepSchema = z.object({
  kind: z.literal('sort'),
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc'])
})
export type SortStep = z.infer<typeof sortStepSchema>

export const limitStepSchema = z.object({
  kind: z.literal('limit'),
  count: z.number().int().positive()
})
export type LimitStep = z.infer<typeof limitStepSchema>

export const dropColumnsStepSchema = z.object({
  kind: z.literal('dropColumns'),
  columns: z.array(z.string().min(1)).min(1)
})
export type DropColumnsStep = z.infer<typeof dropColumnsStepSchema>

export const renameColumnStepSchema = z.object({
  kind: z.literal('renameColumn'),
  from: z.string().min(1),
  to: z.string().min(1)
})
export type RenameColumnStep = z.infer<typeof renameColumnStepSchema>

export const fillMissingStrategySchema = z.enum(['value', 'zero', 'empty'])
export type FillMissingStrategy = z.infer<typeof fillMissingStrategySchema>

// `value` only applies to the 'value' strategy — same non-enforcement
// reasoning as FilterStep above.
export const fillMissingStepSchema = z.object({
  kind: z.literal('fillMissing'),
  column: z.string().min(1),
  strategy: fillMissingStrategySchema,
  value: z.union([z.string(), z.number()]).optional()
})
export type FillMissingStep = z.infer<typeof fillMissingStepSchema>

export const stepSchema = z.discriminatedUnion('kind', [
  filterStepSchema,
  sortStepSchema,
  limitStepSchema,
  dropColumnsStepSchema,
  renameColumnStepSchema,
  fillMissingStepSchema
])
export type Step = z.infer<typeof stepSchema>

/**
 * A model's proposal for what to do with the attached dataset (D9.4). `kind`
 * only changes presentation — an immediate answer versus a reapplicable
 * pipeline — never the vocabulary a step can express (D19.2): both variants
 * share the exact same `steps` shape.
 */
export const stepProposalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('query'), steps: z.array(stepSchema).min(1) }),
  z.object({ kind: z.literal('steps'), steps: z.array(stepSchema).min(1) })
])
export type StepProposal = z.infer<typeof stepProposalSchema>

// D19.3: one schema feeds both Ollama's `format` (constrains generation) and
// `.parse()` (validates the reply) — see core/ai/types.ts's ChatFn and
// core/ai/proposal.ts.
export const stepProposalJsonSchema = z.toJSONSchema(stepProposalSchema)
