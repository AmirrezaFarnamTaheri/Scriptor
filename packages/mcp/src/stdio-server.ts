import type { McpMode } from '@scriptor/core/contracts/mcp'

import { createCliVaultContext, resolveStdioVaultPath } from './cli-vault-context.ts'
import { runMcpStdioServer } from './stdio.ts'

const mode = (process.env.SCRIPTOR_MCP_MODE ?? 'read-only') as McpMode
const vaultPath = resolveStdioVaultPath()
const context = vaultPath ? createCliVaultContext(vaultPath) : null

await runMcpStdioServer({ mode, context })
