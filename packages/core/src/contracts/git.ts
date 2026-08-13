/**
 * git.ts — Contract types for native-git operations.
 *
 * Additive only (I-9). All fields optional unless marked required so that
 * downstream consumers can be updated incrementally across waves.
 */

export interface GitPullOptions {
  /** pull strategy; must be an explicit user choice, never inferred */
  strategy: "fast-forward" | "merge" | "rebase";
}

export interface GitPullResult {
  message: string;
}

export interface GitPushResult {
  message: string;
}

export interface GitMerge3Result {
  /** resolved markdown text when the merge was clean */
  resolved?: string;
  /** conflict hunks when resolution requires user action */
  hunks?: GitConflictHunk[];
  clean: boolean;
}

export interface GitConflictHunk {
  /** 0-based line index of the conflict open marker */
  lineStart: number;
  ours: string;
  theirs: string;
}

export interface GitAutoMergeResult {
  path: string;
  strategy: "merged" | "ours" | "theirs" | "keep-both";
}

export interface GitQueuedOperation {
  id: string;
  kind: "pull" | "push" | "commit" | "resolve";
  repoRoot: string;
  enqueuedAt: string; // ISO-8601
}

export interface GitHistoryEntry {
  sha: string;
  message: string;
  author: string;
  date: string; // ISO-8601
}

export interface GitBlameLine {
  lineNumber: number;
  sha: string;
  author: string;
  date: string;
  content: string;
}
