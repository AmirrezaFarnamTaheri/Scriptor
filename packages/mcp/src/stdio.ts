import type { McpMode } from '@scriptor/core/contracts/mcp'

import { McpRuntime, type McpVaultContext } from './runtime.ts'
import { handleMcpRequest, jsonRpcParseError, type McpServerRequest } from './server.ts'

export interface NodeLikeProcess {
  stdout: { write(chunk: string): void }
  stdin: AsyncIterable<Uint8Array | string>
}

/**
 * Maximum length of a single newline-delimited JSON-RPC message. A peer that
 * streams bytes without a newline would otherwise grow the buffer without
 * bound; past this limit the line is rejected with a parse error and the rest
 * of the line is discarded (never silently truncated into a partial message).
 */
export const MAX_LINE_LENGTH = 4 * 1024 * 1024

function nodeProcess(): NodeLikeProcess | null {
  return (globalThis as { process?: NodeLikeProcess }).process ?? null
}

export interface StdioMcpOptions {
  mode?: McpMode
  context?: McpVaultContext | null
  /** Injectable stdin/stdout pair; defaults to the host Node.js process. */
  io?: NodeLikeProcess
}

export async function runMcpStdioServer(options: StdioMcpOptions = {}): Promise<void> {
  const proc = options.io ?? nodeProcess()
  if (!proc) {
    throw new Error('MCP stdio server requires a Node.js process')
  }

  const runtime = new McpRuntime(options.mode ?? 'read-only', options.context ?? null)
  let buffer = ''
  // True while the remainder of an over-long line is being skipped.
  let discarding = false

  for await (const chunk of proc.stdin) {
    buffer += decodeChunk(chunk)

    for (;;) {
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) break
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (discarding) {
        // Tail of the rejected over-long line ends here.
        discarding = false
        continue
      }
      if (line) {
        await handleLine(proc, runtime, line)
      }
    }

    if (discarding) {
      buffer = ''
    } else if (buffer.length > MAX_LINE_LENGTH) {
      writeResponse(
        proc,
        jsonRpcParseError(`JSON-RPC line exceeds ${MAX_LINE_LENGTH} bytes`, {
          maxLineLength: MAX_LINE_LENGTH,
        }),
      )
      buffer = ''
      discarding = true
    }
  }

  const trailing = discarding ? '' : buffer.trim()
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
    writeResponse(proc, jsonRpcParseError('Invalid JSON-RPC line'))
    return
  }

  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    writeResponse(proc, jsonRpcParseError('JSON-RPC message must be an object'))
    return
  }

  const response = await handleMcpRequest(runtime, request)
  // `null` means the message was a notification: JSON-RPC forbids a reply.
  if (response) {
    writeResponse(proc, response)
  }
}

function writeResponse(proc: NodeLikeProcess, payload: unknown): void {
  proc.stdout.write(`${JSON.stringify(payload)}\n`)
}

function decodeChunk(chunk: Uint8Array | string): string {
  return typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
}
