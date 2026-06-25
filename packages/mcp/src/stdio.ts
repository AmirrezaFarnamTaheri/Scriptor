import type { McpMode } from '@scriptor/core/contracts/mcp'

import { McpRuntime, type McpVaultContext } from './runtime.ts'
import { handleMcpRequest, type McpServerRequest } from './server.ts'

interface NodeLikeProcess {
  stdout: { write(chunk: string): void }
  stdin: AsyncIterable<Uint8Array | string>
}

function nodeProcess(): NodeLikeProcess | null {
  return (globalThis as { process?: NodeLikeProcess }).process ?? null
}

export interface StdioMcpOptions {
  mode?: McpMode
  context?: McpVaultContext | null
}

export async function runMcpStdioServer(options: StdioMcpOptions = {}): Promise<void> {
  const proc = nodeProcess()
  if (!proc) {
    throw new Error('MCP stdio server requires a Node.js process')
  }

  const runtime = new McpRuntime(options.mode ?? 'read-only', options.context ?? null)
  let buffer = ''

  for await (const chunk of proc.stdin) {
    buffer += decodeChunk(chunk)
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        await handleLine(proc, runtime, line)
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const trailing = buffer.trim()
  if (trailing) {
    await handleLine(proc, runtime, trailing)
  }
}

async function handleLine(
  proc: NodeLikeProcess,
  runtime: McpRuntime,
  line: string,
): Promise<void> {
  let request: McpServerRequest
  try {
    request = JSON.parse(line) as McpServerRequest
  } catch {
    writeResponse(proc, {
      id: 'invalid',
      error: { code: 'parse_error', message: 'Invalid JSON-RPC line' },
    })
    return
  }

  const response = await handleMcpRequest(runtime, request)
  writeResponse(proc, response)
}

function writeResponse(proc: NodeLikeProcess, payload: unknown): void {
  proc.stdout.write(`${JSON.stringify(payload)}\n`)
}

function decodeChunk(chunk: Uint8Array | string): string {
  return typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
}
