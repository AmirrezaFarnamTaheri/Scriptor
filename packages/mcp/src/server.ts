import type { CommandResult } from '@scriptor/core/contracts/command'

import type { McpRuntime } from './runtime'

export interface McpServerRequest {
  id: string | number
  method: 'tools/list' | 'tools/call'
  params?: {
    name?: string
    arguments?: unknown
  }
}

export interface McpServerResponse {
  id: string | number
  result?: unknown
  error?: { code: string; message: string }
}

export async function handleMcpRequest(
  runtime: McpRuntime,
  request: McpServerRequest,
): Promise<McpServerResponse> {
  if (request.method === 'tools/list') {
    return {
      id: request.id,
      result: { tools: runtime.listTools() },
    }
  }

  if (request.method === 'tools/call') {
    const name = request.params?.name
    if (!name) {
      return {
        id: request.id,
        error: { code: 'invalid_params', message: 'Tool name is required' },
      }
    }

    const result: CommandResult = await runtime.invoke(name, request.params?.arguments ?? {})
    if (!result.ok) {
      return {
        id: request.id,
        error: { code: result.error.code, message: result.error.message },
      }
    }

    return { id: request.id, result: { output: result.output } }
  }

  return {
    id: request.id,
    error: { code: 'method_not_found', message: `Unsupported method: ${request.method}` },
  }
}
