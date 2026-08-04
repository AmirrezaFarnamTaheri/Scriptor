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
