import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  loadOperationCatalog,
  validateOperationCatalog,
  discoverTauriCommands,
  discoverRustEnumVariants,
  renderGeneratedArtifacts,
} from './generate-operation-contracts.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const catalog = loadOperationCatalog(root)

test('operation catalog covers every live Tauri, daemon RPC, CLI and MCP operation exactly once', () => {
  validateOperationCatalog(catalog)
  const bySurface = (surface) => catalog.operations.filter((operation) => operation.surface === surface).map((operation) => operation.name).sort()
  assert.deepEqual(bySurface('tauri'), discoverTauriCommands(root).sort())
  assert.deepEqual(bySurface('daemon-rpc'), discoverRustEnumVariants(path.join(root, 'crates/ipc/src/lib.rs'), 'RpcMethod').map((name) => `rpc.${name}`).sort())
  assert.deepEqual(bySurface('cli'), discoverRustEnumVariants(path.join(root, 'crates/cli/src/command_line.rs'), 'Commands').map((name) => `cli.${name}`).sort())
  const schemaNames = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'contracts/mcp-tool-schemas.generated.json'), 'utf8'))).sort()
  assert.deepEqual(bySurface('mcp'), schemaNames)
})

test('generated operation-contract artifacts are byte-stable', () => {
  const rendered = renderGeneratedArtifacts(catalog, root)
  for (const [relative, contents] of Object.entries(rendered)) {
    assert.equal(fs.readFileSync(path.join(root, relative), 'utf8'), contents, `${relative} is stale`)
  }
})
