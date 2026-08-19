import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const cargoPackages = new Set()

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', 'dist', 'fuzz', 'test-fixtures'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

for (const file of walk(root).filter((file) => file.endsWith('Cargo.toml'))) {
  const match = fs.readFileSync(file, 'utf8').match(/^name\s*=\s*"([^"]+)"/m)
  if (match) cargoPackages.add(match[1])
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
