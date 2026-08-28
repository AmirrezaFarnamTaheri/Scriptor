import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path) => fs.readFileSync(path, 'utf8')

const version = read('VERSION').trim()
const coreMcp = read('packages/core/src/contracts/mcp.ts')
const mcpServer = read('packages/mcp/src/server.ts')
const daemonStdio = read('crates/daemon/src/automation_stdio.rs')
const daemonMain = read('crates/daemon/src/main.rs')
const ipc = read('crates/ipc/src/lib.rs')

test('canonical MCP descriptors expose a required JSON input schema', () => {
  assert.match(coreMcp, /inputSchema:\s*McpJsonSchema/)
  const toolContracts = read('packages/mcp/src/tool-contracts.ts')
  assert.match(toolContracts, /MCP_TOOL_INPUT_SCHEMAS/)
  assert.match(toolContracts, /inputSchema:/)
})

test('MCP protocol policy distinguishes current specification from implemented compatibility codecs', () => {
  const catalog = JSON.parse(read('contracts/operations.json'))
  const currentSpecVersion = catalog.protocols.mcp.currentSpecVersion
  // Single source of truth: the advertised spec revision comes from the
  // generated operation catalog, never a duplicated literal.
  assert.match(mcpServer, /MCP_CURRENT_SPEC_VERSION\s*=\s*OPERATION_CATALOG\.protocols\.mcp\.currentSpecVersion/)
  assert.ok(!/release candidate/i.test(mcpServer))
  assert.match(mcpServer, new RegExp(`MCP_SERVER_VERSION\\s*=\\s*'${version.replaceAll('.', '\\.')}'`))
  // The current spec revision must never appear in the implemented codec list.
  const supported = mcpServer.match(/MCP_SUPPORTED_PROTOCOL_VERSIONS\s*=\s*\[([^\]]*)\]/)?.[1] ?? ''
  assert.ok(
    !supported.includes(currentSpecVersion),
    `current spec revision ${currentSpecVersion} must not be advertised as implemented`,
  )
})

test('trusted daemon automation stdio is explicitly bounded and separately named', () => {
  assert.match(daemonStdio, /MAX_AUTOMATION_STDIO_LINE_BYTES/)
  assert.match(daemonStdio, /read_bounded_automation_line/)
  assert.match(daemonMain, /name\s*=\s*"automation-stdio"/)
  assert.match(daemonMain, /visible_alias\s*=\s*"mcp-stdio"/)
})

test('daemon IPC has one structured error envelope and no legacy string error result', () => {
  assert.ok(!/\bErr\(String\)/.test(ipc))
  assert.match(ipc, /CommandFailed\s*\{/)
  assert.match(ipc, /recoverable:\s*bool/)
})
