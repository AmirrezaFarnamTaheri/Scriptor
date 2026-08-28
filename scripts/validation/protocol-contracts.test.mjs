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
  assert.match(mcpServer, /MCP_CURRENT_SPEC_VERSION\s*=\s*'2026-07-28'/)
  assert.ok(!/release candidate/i.test(mcpServer))
  assert.match(mcpServer, new RegExp(`MCP_SERVER_VERSION\\s*=\\s*'${version.replaceAll('.', '\\.')}'`))
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
