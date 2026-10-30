/** A lost native restore reply can mean files changed. Never flush a paused draft. */
export interface FrozenDraftExitRequest {
  readonly hasUnsavedChanges: boolean
  readonly revisionAtPrompt: number
  readonly currentRevision: () => number
  readonly confirmDiscard: () => Promise<boolean>
}
export async function evaluateFrozenDraftExit(request: FrozenDraftExitRequest): Promise<boolean> {
  if (!request.hasUnsavedChanges) return request.currentRevision() === request.revisionAtPrompt
  try {
    const approved = await request.confirmDiscard()
    return approved === true && request.currentRevision() === request.revisionAtPrompt
  } catch {
    return false
  }
}
