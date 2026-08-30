import type { CommandResult } from '@scriptor/core/contracts/command'
import { OPERATION_CATALOG } from '@scriptor/core/contracts/operation-catalog.generated'

import type { McpRuntime } from './runtime'

/**
 * Current published MCP specification revision. Scriptor keeps this separate
 * from the compatibility codecs below: declaring a published revision does not
 * imply wire-level support for it.
 */
export const MCP_CURRENT_SPEC_VERSION: typeof OPERATION_CATALOG.protocols.mcp.currentSpecVersion =
  OPERATION_CATALOG.protocols.mcp.currentSpecVersion

/**
 * Legacy JSON-RPC MCP revisions this server currently implements, newest first.
 * 2026-07-28 is intentionally not advertised until its stateless request model
 * is implemented end-to-end and covered by protocol fixtures.
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const

/** Revision advertised when the client asks for one this server cannot speak. */
export const MCP_PROTOCOL_VERSION = MCP_SUPPORTED_PROTOCOL_VERSIONS[0]
export const MCP_SERVER_NAME = 'scriptor-mcp'
export const MCP_SERVER_VERSION = '1.0.3'

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
    // Negotiation per spec: honour the client's requested revision when this
    // server speaks it, otherwise answer with our newest and let the client
    // decide whether it can proceed. Echoing the request back unconditionally
    // would claim support for revisions we do not implement.
    const requested = request.params?.protocolVersion
    const agreed =
      typeof requested === 'string' &&
      (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : MCP_PROTOCOL_VERSION

    return jsonRpcResult(id, {
      protocolVersion: agreed,
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
