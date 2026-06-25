export interface VaultLintSummary {
  brokenLinks: number
  duplicateTitles: number
  orphanAssets: number
  missingHeadings: number
  staleDefinitions: number
  total: number
}

export function summarizeLintIssues(issues: Array<{ kind: string }>): VaultLintSummary {
  return {
    brokenLinks: issues.filter((issue) => issue.kind === 'broken_link').length,
    duplicateTitles: issues.filter((issue) => issue.kind === 'duplicate_title').length,
    orphanAssets: issues.filter((issue) => issue.kind === 'orphan_asset').length,
    missingHeadings: issues.filter((issue) => issue.kind === 'missing_heading').length,
    staleDefinitions: issues.filter((issue) => issue.kind === 'stale_definitions').length,
    total: issues.length,
  }
}
