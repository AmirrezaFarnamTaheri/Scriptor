export interface HelpInvitation {
  key: number
  id: string
}

export interface HelpInvitationCandidate extends HelpInvitation {
  eligible: boolean
  offered: boolean
  /** The concrete panel takes precedence over its nested widgets. */
  primary: boolean
}

export function sameHelpInvitation(a: HelpInvitation | null, b: HelpInvitation | null): boolean {
  return a?.key === b?.key && a?.id === b?.id
}

/** Select within the active interaction scope. A background offer never owns a modal. */
export function selectHelpInvitation(
  candidates: readonly HelpInvitationCandidate[],
  current: HelpInvitation | null,
): HelpInvitation | null {
  const retained = current && candidates.find((candidate) => candidate.eligible && sameHelpInvitation(candidate, current))
  if (retained) return { key: retained.key, id: retained.id }
  const pending = candidates.filter((candidate) => candidate.eligible && !candidate.offered)
  const next = pending.find((candidate) => candidate.primary) ?? pending[0]
  return next ? { key: next.key, id: next.id } : null
}
