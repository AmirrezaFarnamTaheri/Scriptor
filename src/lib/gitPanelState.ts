import type { WorkspaceGitStatus } from '../hooks/useWorkspaceGit'

export type GitPanelState = 'loading' | 'error' | 'not-repository' | 'ready'

/** Maps workspace-owned Git status data to the mutually exclusive panel state. */
export function selectGitPanelState(
  status: WorkspaceGitStatus | null,
  isBusy: boolean,
): GitPanelState {
  if (!status && isBusy) return 'loading'
  if (status?.loadError) return 'error'
  if (!status || !status.is_repo) return 'not-repository'
  return 'ready'
}

/** Removes paths that disappeared during a status refresh before a commit is prepared. */
export function deriveEffectiveGitSelection(
  selected: Iterable<string>,
  changedPaths: readonly string[],
  defaultSelection: readonly string[],
): string[] {
  const availablePaths = new Set(changedPaths)
  const validSelected = Array.from(selected).filter((path) => availablePaths.has(path))
  if (validSelected.length > 0) return validSelected
  return defaultSelection.filter((path) => availablePaths.has(path))
}
