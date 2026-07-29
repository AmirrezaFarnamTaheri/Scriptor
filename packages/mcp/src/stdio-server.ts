import type { McpMode } from '@scriptor/core/contracts/mcp'

import { createCliVaultContext, resolveStdioVaultPath } from './cli-vault-context.ts'
import { runMcpStdioServer } from './stdio.ts'

const MCP_MODES: readonly McpMode[] = ['off', 'read-only', 'draft', 'write-approved']

function parseMcpMode(raw: string | undefined): McpMode {
  const value = (raw ?? '').trim()
  if (!value) return 'read-only'
  if ((MCP_MODES as readonly string[]).includes(value)) {
    return value as McpMode
  }
  const detail = `Invalid SCRIPTOR_MCP_MODE "${value}". Expected one of: ${MCP_MODES.join(', ')}.`
  console.error(detail)
  process.exit(2)
  throw new Error(detail)
}

const mode = parseMcpMode(process.env.SCRIPTOR_MCP_MODE)
const vaultPath = resolveStdioVaultPath()
const context = vaultPath ? createCliVaultContext(vaultPath) : null

await runMcpStdioServer({ mode, context })
