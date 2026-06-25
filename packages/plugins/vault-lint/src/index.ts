import type { PluginManifest } from '@scriptor/core'

export const vaultLintManifest: PluginManifest = {
  id: 'scriptor-vault-lint',
  name: 'Vault Lint',
  version: '0.1.0',
  publisher: 'Scriptor',
  description:
    'Vault lint summaries and Foam-style CLI rules (missing-heading, stale-definitions) with optional --fix.',
  activation: ['on-vault-open', 'manual'],
  capabilities: ['inspector-widget', 'vault-health-check', 'command'],
  permissions: [{ permission: 'read', reason: 'Read derived vault diagnostics through command contracts' }],
  contributes: {
    inspectorWidgets: [
      {
        id: 'vault-lint-summary',
        label: 'Vault lint summary',
        placement: 'vault',
      },
    ],
    vaultHealthChecks: [
      { id: 'broken-links', label: 'Broken links', severity: 'warning' },
      { id: 'duplicate-titles', label: 'Duplicate titles', severity: 'warning' },
      { id: 'orphan-assets', label: 'Orphan assets', severity: 'info' },
      { id: 'missing-heading', label: 'Missing h1 heading', severity: 'warning' },
      { id: 'stale-definitions', label: 'Stale wikilink definitions', severity: 'warning' },
    ],
    commands: [
      {
        commandId: 'vault.health.diagnostics',
        label: 'Run vault lint',
        category: 'Vault',
        permission: 'read',
      },
      {
        commandId: 'vault.lint',
        label: 'Lint vault (CLI)',
        category: 'Vault',
        permission: 'read',
      },
    ],
  },
}

export function summarizeLintIssues(issues: Array<{ kind: string }>) {
  return {
    brokenLinks: issues.filter((issue) => issue.kind === 'broken_link').length,
    duplicateTitles: issues.filter((issue) => issue.kind === 'duplicate_title').length,
    orphanAssets: issues.filter((issue) => issue.kind === 'orphan_asset').length,
    missingHeadings: issues.filter((issue) => issue.kind === 'missing_heading').length,
    staleDefinitions: issues.filter((issue) => issue.kind === 'stale_definitions').length,
    total: issues.length,
  }
}
