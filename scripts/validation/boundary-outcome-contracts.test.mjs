import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const configAdapters = [
  'apps/desktop/src-tauri/src/commands/indexer.rs',
  'apps/desktop/src-tauri/src/commands/vault.rs',
  'crates/daemon/src/command_gateway.rs',
]
const indexQueryModules = [
  'crates/indexer/src/db.rs',
  'crates/indexer/src/tasks.rs',
  'crates/indexer/src/dql.rs',
]

test('invalid existing vault configuration is never converted back to defaults at adapters', () => {
  for (const relative of configAdapters) {
    const source = read(relative)
    assert.doesNotMatch(
      source,
      /load_vault_config\([^\n;]+\)\.unwrap_or_default\(\)/,
      `${relative} silently defaults malformed existing config`,
    )
  }
})

test('SQLite query_map row decoding is not silently dropped from normal query paths', () => {
  for (const relative of indexQueryModules) {
    const source = read(relative)
    assert.doesNotMatch(source, /filter_map\(Result::ok\)/, `${relative} silently drops database row errors`)
    assert.doesNotMatch(source, /filter_map\(\|[^|]+\|\s*[^\n]*\.ok\(\)\)/, `${relative} silently drops database row errors`)
  }
})

test('indexed link assignment uses the shared ambiguity-aware wikilink resolver', () => {
  const source = read('crates/indexer/src/links.rs')
  assert.match(source, /WikilinkIndex::from_note_paths/)
  assert.match(source, /WikilinkResolutionKind::Resolved/)
  assert.doesNotMatch(source, /HashMap::<String, String>::new\(\)/)
})

test('boundary outcome algebra is explicit and shared across TypeScript, Rust, and architecture docs', () => {
  const typescript = read('packages/core/src/contracts/outcome.ts')
  const rust = read('crates/ipc/src/outcome.rs')
  const docs = read('docs/contracts/BOUNDARY_OUTCOMES.md')
  for (const status of ['value', 'absent-optional', 'invalid', 'degraded', 'failed', 'recovered']) {
    assert.match(typescript, new RegExp(`'${status}'`), `TypeScript outcome contract missing ${status}`)
    assert.match(docs, new RegExp(`\\b${status}\\b`), `Boundary outcome docs missing ${status}`)
  }
  for (const variant of ['Value', 'AbsentOptional', 'Invalid', 'Degraded', 'Failed', 'Recovered']) {
    assert.match(rust, new RegExp(`\\b${variant}\\b`), `Rust outcome contract missing ${variant}`)
  }
})
