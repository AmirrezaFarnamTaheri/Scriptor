import type { GitStatus } from '../types/vault'

export type GitPanelState = 'loading' | 'error' | 'not-repository' | 'ready'

/** Maps workspace-owned Git status data to the mutually exclusive panel state. */
export function selectGitPanelState(
  status: GitStatus | null,
  statusError: string | null,
  isStatusLoading: boolean,
): GitPanelState {
  if (isStatusLoading) return 'loading'
  if (statusError) return 'error'
  if (!status || !status.is_repo) return 'not-repository'
  return 'ready'
}

/**
 * Removes paths that disappeared during a status refresh before a commit is prepared.
 * `null` means the user has not touched selection yet; an empty iterable is an explicit
 * choice to select no files.
 */
export function deriveEffectiveGitSelection(
  selected: Iterable<string> | null,
  changedPaths: readonly string[],
  defaultSelection: readonly string[],
): string[] {
  const availablePaths = new Set(changedPaths)
  const source = selected === null ? defaultSelection : selected
  return Array.from(source).filter((path) => availablePaths.has(path))
}
