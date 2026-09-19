import type { Draft, DraftContext, StepError } from '../draft'

/** What every wizard step receives. `error` is set only after the user tried to continue. */
export interface StepProps {
  draft: Draft
  onChange: (draft: Draft) => void
  ctx: DraftContext
  error: StepError | null
}
