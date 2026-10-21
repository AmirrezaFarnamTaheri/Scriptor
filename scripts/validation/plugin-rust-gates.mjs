import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
/**
 * Read the workspace package names without the Rust toolchain.
 *
 * `cargo metadata` is the authoritative source, but it needs a toolchain.
 * The workspace member list and each member's package name are plain
 * `Cargo.toml` values, so the gate can still resolve the references on a
 * workstation that has no Rust toolchain.
 */
function readWorkspacePackageNames() {
  const workspace = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8')
  const members = workspace.match(/^members\s*=\s*\[([\s\S]*?)\]/m)
  if (!members) return null
  const names = new Set()
  for (const raw of members[1].split(',')) {
    const member = raw.trim().replace(/^["']|["']$/g, '')
    if (!member) continue
    const manifestPath = path.join(root, member, 'Cargo.toml')
    if (!fs.existsSync(manifestPath)) continue
    let inPackage = false
    for (const line of fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) { inPackage = /^\s*\[package\]/.test(line); continue }
      if (!inPackage) continue
      const name = line.match(/^\s*name\s*=\s*"([^"]+)"/)
      if (name) { names.add(name[1]); break }
    }
  }
  return names.size ? names : null
}

const metadataResult = spawnSync(
  'cargo',
  ['metadata', '--no-deps', '--format-version=1'],
  { cwd: root, encoding: 'utf8' },
)
let cargoPackages
if (metadataResult.error?.code === 'ENOENT') {
  // The Rust toolchain is unavailable, for example on a workstation that
  // only runs the TypeScript gates. A missing toolchain is not a contract
  // violation, so the gate falls back to the workspace manifests instead of
  // failing with an opaque spawn error. A toolchain that runs and fails
  // still fails the gate.
  const fallback = readWorkspacePackageNames()
  if (!fallback) {
    console.log('Plugin Rust gate check skipped: the Rust toolchain (cargo) is not installed and the workspace members could not be read.')
    process.exit(0)
  }
  cargoPackages = fallback
} else {
  assert.equal(
    metadataResult.status,
    0,
    [metadataResult.stdout, metadataResult.stderr].filter(Boolean).join('\n'),
  )
  const metadata = JSON.parse(metadataResult.stdout)
  const workspaceMembers = new Set(metadata.workspace_members)
  cargoPackages = new Set(
    metadata.packages
      .filter((pkg) => workspaceMembers.has(pkg.id))
      .map((pkg) => pkg.name),
  )
}

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
