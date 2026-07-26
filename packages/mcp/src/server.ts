import type { CommandResult } from '@scriptor/core/contracts/command'

import type { McpRuntime } from './runtime'

/**
 * MCP protocol revision advertised during `initialize`. `2024-11-05` is the
 * revision this server implements; bump only alongside the handshake shape.
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05'
export const MCP_SERVER_NAME = 'scriptor-mcp'
export const MCP_SERVER_VERSION = '0.1.0'

/** Standard JSON-RPC 2.0 error codes (integers, per the spec). */
export const JSON_RPC_PARSE_ERROR = -32700
export const JSON_RPC_INVALID_REQUEST = -32600
export const JSON_RPC_METHOD_NOT_FOUND = -32601
export const JSON_RPC_INVALID_PARAMS = -32602
export const JSON_RPC_INTERNAL_ERROR = -32603

export type JsonRpcId = string | number | null

export interface McpServerRequest {
  jsonrpc?: string
  /** Absent (or null) marks a JSON-RPC notification: no response is emitted. */
  id?: JsonRpcId
  method: string
  params?: {
    name?: string
    arguments?: unknown
    [key: string]: unknown
  }
}

export interface McpServerError {
  code: number
  message: string
  data?: unknown
}

export interface McpServerResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: McpServerError
}

export function jsonRpcResult(id: JsonRpcId, result: unknown): McpServerResponse {
  return { jsonrpc: '2.0', id, result }
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): McpServerResponse {
  const error: McpServerError = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}

/** Parse failures always answer with a null id: the request id is unknowable. */
export function jsonRpcParseError(message: string, data?: unknown): McpServerResponse {
  return jsonRpcError(null, JSON_RPC_PARSE_ERROR, message, data)
}

/** A request without an `id` is a notification and must not be answered. */
export function isNotification(request: McpServerRequest): boolean {
  return request.id === undefined || request.id === null
}

/**
 * Map runtime/command error codes onto JSON-RPC integer codes. The original
 * structured error is preserved in `error.data` so nothing is lost.
 */
function mapRuntimeErrorCode(code: string): number {
  switch (code) {
    case 'mcp.tool_missing':
      return JSON_RPC_METHOD_NOT_FOUND
    case 'mcp.permission_denied':
    case 'mcp.vault_unavailable':
      return JSON_RPC_INVALID_REQUEST
    case 'mcp.invoke_failed':
      return JSON_RPC_INVALID_PARAMS
    default:
      return JSON_RPC_INTERNAL_ERROR
  }
}

/**
 * Handle a single decoded JSON-RPC message. Returns `null` for notifications,
 * which per JSON-RPC 2.0 must never receive a response.
 */
export async function handleMcpRequest(
  runtime: McpRuntime,
  request: McpServerRequest,
): Promise<McpServerResponse | null> {
  const notification = isNotification(request)
  const id: JsonRpcId = notification ? null : (request.id as string | number)

  if (typeof request?.method !== 'string' || request.method.length === 0) {
    if (notification) return null
    return jsonRpcError(id, JSON_RPC_INVALID_REQUEST, 'Request "method" must be a non-empty string')
  }

  if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
    if (notification) return null
    return jsonRpcError(id, JSON_RPC_INVALID_REQUEST, 'Only JSON-RPC 2.0 is supported', {
      jsonrpc: request.jsonrpc,
    })
  }

  if (notification) {
    // `notifications/initialized` (and any other notification) is accepted
    // silently; unknown notifications are ignored rather than answered.
    return null
  }

  if (request.method === 'initialize') {
    return jsonRpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    })
  }

  if (request.method === 'ping') {
    return jsonRpcResult(id, {})
  }

  if (request.method === 'tools/list') {
    return jsonRpcResult(id, { tools: runtime.listTools() })
  }

  if (request.method === 'tools/call') {
    const name = request.params?.name
    if (typeof name !== 'string' || name.length === 0) {
      return jsonRpcError(id, JSON_RPC_INVALID_PARAMS, 'Tool name is required')
    }

    const result: CommandResult = await runtime.invoke(name, request.params?.arguments ?? {})
    if (!result.ok) {
      return jsonRpcError(id, mapRuntimeErrorCode(result.error.code), result.error.message, {
        code: result.error.code,
        recoverable: result.error.recoverable,
      })
    }

    return jsonRpcResult(id, { output: result.output })
  }

  return jsonRpcError(id, JSON_RPC_METHOD_NOT_FOUND, `Unsupported method: ${request.method}`, {
    method: request.method,
  })
}
