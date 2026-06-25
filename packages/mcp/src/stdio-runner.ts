import { handleMcpRequest } from './server.ts'
import { McpRuntime } from './runtime.ts'

export async function runStdioValidation(): Promise<string[]> {
  const failures: string[] = []
  const runtime = new McpRuntime('read-only', {
    search: async () => [],
    readNote: async () => ({ metadata: { title: 'Fixture', content_hash: 'fixture' }, markdown: '' }),
    backlinks: async () => [],
    brokenLinks: async () => [],
    exportProfiles: async () => [],
  })

  const list = await handleMcpRequest(runtime, { id: 1, method: 'tools/list' })
  const tools = (list.result as { tools?: unknown[] } | undefined)?.tools
  if (!tools?.length) {
    failures.push('stdio tools/list should return tools')
  }

  const call = await handleMcpRequest(runtime, {
    id: 2,
    method: 'tools/call',
    params: { name: 'mcp.inspectExportProfiles', arguments: {} },
  })
  if (call.error) {
    failures.push(`stdio tools/call failed: ${call.error.message}`)
  }

  return failures
}
