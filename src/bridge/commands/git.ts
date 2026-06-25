import { invoke } from '@tauri-apps/api/core'

import type { GitCommitOutput, GitPullOutput, GitPushOutput, GitStatus } from '../../types/vault'
import { daemonGitStatusJson } from './daemon.ts'
import { isHeadlessMode } from '../headlessMode.ts'
import { requireNative } from '../native.ts'

export async function gitStatus(): Promise<GitStatus> {
  requireNative()
  if (isHeadlessMode()) {
    const payload = await daemonGitStatusJson()
    return JSON.parse(payload) as GitStatus
  }
  return invoke<GitStatus>('git_status_cmd')
}

export async function gitCommit(files: string[], message: string): Promise<GitCommitOutput> {
  requireNative()
  return invoke<GitCommitOutput>('git_commit_cmd', { files, message })
}

export async function gitPull(): Promise<GitPullOutput> {
  requireNative()
  return invoke<GitPullOutput>('git_pull_cmd')
}

export async function gitPush(): Promise<GitPushOutput> {
  requireNative()
  return invoke<GitPushOutput>('git_push_cmd')
}

export async function gitResolveConflict(
  path: string,
  strategy: 'ours' | 'theirs',
): Promise<{ path: string; strategy: string }> {
  requireNative()
  return invoke('git_resolve_conflict_cmd', { path, strategy })
}

export async function gitReadConflictMarkers(path: string): Promise<string[]> {
  requireNative()
  return invoke<string[]>('git_read_conflict_markers_cmd', { path })
}

export async function gitShowHeadFile(path: string): Promise<string | null> {
  requireNative()
  return invoke<string | null>('git_show_head_file_cmd', { path })
}
