import { invoke } from '@tauri-apps/api/core'

import type { GitCommitOutput, GitPullOutput, GitPushOutput, GitStatus } from '../../types/vault'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export async function gitStatus(): Promise<GitStatus> {
  requireNative()
  return invoke<GitStatus>('git_status_cmd')
}

export async function gitCommit(files: string[], message: string): Promise<GitCommitOutput> {
  requireNative()
  return invoke<GitCommitOutput>('git_commit_cmd', { files, message })
}

export async function gitPull(vaultId: string): Promise<GitPullOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('git_pull', vaultId)
  return invoke<GitPullOutput>('git_pull_cmd', { authorizationToken })
}

export async function gitPush(vaultId: string): Promise<GitPushOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('git_push', vaultId)
  return invoke<GitPushOutput>('git_push_cmd', { authorizationToken })
}

export async function gitResolveConflict(
  path: string,
  strategy: 'ours' | 'theirs',
): Promise<{ path: string; strategy: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('apply_git_conflict', path)
  return invoke('git_resolve_conflict_cmd', { path, strategy, authorizationToken })
}

export async function gitApplyMergedConflict(
  path: string,
  mergedMarkdown: string,
): Promise<{ path: string; strategy: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('apply_git_conflict', path)
  return invoke('git_apply_merged_conflict_cmd', { path, mergedMarkdown, authorizationToken })
}

export async function gitReadConflictMarkers(path: string): Promise<string[]> {
  requireNative()
  return invoke<string[]>('git_read_conflict_markers_cmd', { path })
}

export async function gitShowHeadFile(path: string): Promise<string | null> {
  requireNative()
  return invoke<string | null>('git_show_head_file_cmd', { path })
}

export async function gitShowMergeBaseFile(path: string): Promise<string | null> {
  requireNative()
  return invoke<string | null>('git_show_merge_base_file_cmd', { path })
}
