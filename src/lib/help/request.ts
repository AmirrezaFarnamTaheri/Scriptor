import { HELP_BY_ID } from './catalog.ts'
import { HELP_EVENT, type HelpRequest, type HelpView } from './types.ts'

export function parseHelpRequest(value: unknown): HelpRequest | null {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !HELP_BY_ID.has(value.id)) return null
  const view = 'view' in value ? value.view : 'guide'
  if (view !== 'guide' && view !== 'tour' && view !== 'questions') return null
  return { id: value.id, view }
}

/** Request guidance only. No guide can contain or dispatch an application mutation. */
export function requestHelp(id = 'workspace', view: HelpView = 'guide'): void {
  if (typeof window === 'undefined' || !HELP_BY_ID.has(id)) return
  window.dispatchEvent(new CustomEvent<HelpRequest>(HELP_EVENT, { detail: { id, view } }))
}
