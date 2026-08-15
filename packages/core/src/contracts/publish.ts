/**
 * publish.ts — Contract types for the publish pipeline.
 *
 * Additive only (I-9). `requireFrontmatterOptIn` defaults true — a note is
 * never published without an explicit `publish: true` in its frontmatter.
 */

export type PublishBucket = "new" | "changed" | "unchanged" | "orphaned";

export interface PublishPlanItem {
  path: string;
  bucket: PublishBucket;
  /** SHA-256 hash of the note content at plan time */
  contentHash: string;
}

export interface PublishPlan {
  /** Total notes scanned */
  scanned: number;
  items: PublishPlanItem[];
  /** Defaults true: opt-in via `publish: true` frontmatter is required */
  requireFrontmatterOptIn: boolean;
  planTimestamp: string; // ISO-8601
}

export interface PublishApplyOptions {
  /** When true, deletes remote items in the `orphaned` bucket */
  deleteOrphaned: boolean;
  dryRun?: boolean;
}

export interface PublishApplyResult {
  written: string[];
  deleted: string[];
  skipped: string[];
}

export type PublishSinkKind = "local-dir" | "git" | "github-api";

export interface LocalDirSinkConfig {
  kind: "local-dir";
  outputDir: string;
}

export interface GitSinkConfig {
  kind: "git";
  repoRoot: string;
  branch: string;
}
