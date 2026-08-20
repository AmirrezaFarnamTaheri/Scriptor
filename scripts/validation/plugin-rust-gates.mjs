import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const metadataResult = spawnSync(
  'cargo',
  ['metadata', '--no-deps', '--format-version=1'],
  { cwd: root, encoding: 'utf8' },
)
assert.equal(
  metadataResult.status,
  0,
  [metadataResult.stdout, metadataResult.stderr].filter(Boolean).join('\n'),
)
const metadata = JSON.parse(metadataResult.stdout)
const workspaceMembers = new Set(metadata.workspace_members)
const cargoPackages = new Set(
  metadata.packages
    .filter((pkg) => workspaceMembers.has(pkg.id))
    .map((pkg) => pkg.name),
)

const manifestFiles = [
  'packages/canvas/plugin.json',
  'packages/export/plugin.json',
  'packages/mcp/src/manifest.ts',
  'src/components/inspector/citation-plugin-manifest.ts',
  'src/components/plugins/PluginManagerCenter.tsx',
]
let checked = 0
for (const relative of manifestFiles) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  for (const match of source.matchAll(/rustFeatureGate["']?\s*:\s*["']([^"']+)["']/g)) {
    const rustGate = match[1]
    assert.ok(cargoPackages.has(rustGate), `${relative} references unknown Rust package ${rustGate}`)
    checked += 1
  }
}
assert.ok(checked >= 5, `expected at least five built-in Rust gate references, found ${checked}`)
console.log(`Plugin Rust gate check passed (${checked} gates resolve to workspace packages).`)
