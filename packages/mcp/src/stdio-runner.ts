import {
  handleMcpRequest,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_PARSE_ERROR,
  MCP_PROTOCOL_VERSION,
  type McpServerResponse,
} from './server.ts'
import { McpRuntime, type McpVaultContext } from './runtime.ts'
import { MAX_LINE_LENGTH, runMcpStdioServer, type NodeLikeProcess } from './stdio.ts'

function fixtureContext(): McpVaultContext {
  return {
    search: async () => [],
    readNote: async () => ({
      metadata: { title: 'Fixture', content_hash: 'fixture' },
      markdown: '',
    }),
    backlinks: async () => [],
    brokenLinks: async () => [],
    exportProfiles: async () => [],
  }
}

/** Feed pre-baked stdin chunks through the real framing loop and collect stdout. */
async function driveStdio(chunks: string[]): Promise<Record<string, unknown>[]> {
  const written: string[] = []
  const io: NodeLikeProcess = {
    stdout: {
      write(chunk: string) {
        written.push(chunk)
      },
    },
    stdin: (async function* () {
      for (const chunk of chunks) yield chunk
    })(),
  }

  await runMcpStdioServer({ mode: 'read-only', context: fixtureContext(), io })

  return written
    .join('')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

function errorOf(message: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return message?.error as Record<string, unknown> | undefined
}

async function runStdioFramingTests(): Promise<string[]> {
  const failures: string[] = []

  // Happy path: a well-formed request answered with jsonrpc/id echoed back.
  const basic = await driveStdio(['{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n'])
  if (basic.length !== 1) {
    failures.push(`stdio framing should emit exactly one response, got ${basic.length}`)
  } else {
    if (basic[0].jsonrpc !== '2.0') failures.push('stdio response must carry jsonrpc "2.0"')
    if (basic[0].id !== 1) failures.push('stdio response must echo the request id')
    const tools = (basic[0].result as { tools?: unknown[] } | undefined)?.tools
    if (!tools?.length) failures.push('stdio tools/list should return tools')
  }

  // Chunk boundaries that split a line mid-message must still frame correctly.
  const split = await driveStdio(['{"jsonrpc":"2.0","id":', '2,"method":"tools', '/list"}\n'])
  if (split.length !== 1 || split[0].id !== 2) {
    failures.push('stdio framing should reassemble messages split across chunks')
  }

  // Multiple messages inside one chunk, plus a trailing line without a newline.
  const multi = await driveStdio([
    '{"jsonrpc":"2.0","id":3,"method":"tools/list"}\n{"jsonrpc":"2.0","id":4,"method":"tools/list"}\n{"jsonrpc":"2.0","id":5,"method":"tools/list"}',
  ])
  if (multi.length !== 3 || multi[2].id !== 5) {
    failures.push('stdio framing should handle batched lines and an unterminated trailing line')
  }

  // Malformed JSON -> parse error with a null id.
  const malformed = await driveStdio(['{not json\n'])
  if (malformed.length !== 1) {
    failures.push('malformed JSON should produce one parse error response')
  } else {
    if (malformed[0].id !== null) failures.push('parse error response must use id null')
    if (malformed[0].jsonrpc !== '2.0') failures.push('parse error response must carry jsonrpc "2.0"')
    if (errorOf(malformed[0])?.code !== JSON_RPC_PARSE_ERROR) {
      failures.push('parse error must use integer code -32700')
    }
  }

  // Non-object JSON (valid JSON, invalid JSON-RPC message) -> parse error.
  const scalar = await driveStdio(['"hello"\n'])
  if (errorOf(scalar[0])?.code !== JSON_RPC_PARSE_ERROR) {
    failures.push('non-object JSON-RPC message should be rejected as a parse error')
  }

  // Oversized line: one parse error, buffer reset, subsequent line still works.
  const oversized = await driveStdio([
    `{"junk":"${'x'.repeat(MAX_LINE_LENGTH + 16)}`,
    'still-part-of-the-same-line"}\n',
    '{"jsonrpc":"2.0","id":9,"method":"tools/list"}\n',
  ])
  if (oversized.length !== 2) {
    failures.push(`oversized line should yield one error plus one recovery response, got ${oversized.length}`)
  } else {
    if (errorOf(oversized[0])?.code !== JSON_RPC_PARSE_ERROR) {
      failures.push('oversized line must produce a -32700 parse error')
    }
    if (oversized[0].id !== null) failures.push('oversized line error must use id null')
    if (oversized[1].id !== 9) {
      failures.push('stdio must recover and process the line after an oversized one')
    }
  }

  // Notifications (no id) get no response at all.
  const notifications = await driveStdio([
    '{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
    '{"jsonrpc":"2.0","method":"tools/list"}\n',
    '{"jsonrpc":"2.0","method":"nonexistent/method"}\n',
  ])
  if (notifications.length !== 0) {
    failures.push(`notifications must not be answered, got ${notifications.length} responses`)
  }

  // Full handshake over the wire, using the current stable revision.
  const handshake = await driveStdio([
    `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"${MCP_PROTOCOL_VERSION}","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}\n`,
    '{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n',
  ])
  if (handshake.length !== 2) {
    failures.push(`handshake should emit 2 responses (initialize + tools/list), got ${handshake.length}`)
  } else {
    const result = handshake[0].result as
      | { protocolVersion?: string; serverInfo?: { name?: string; version?: string }; capabilities?: { tools?: unknown } }
      | undefined
    if (result?.protocolVersion !== MCP_PROTOCOL_VERSION) {
      failures.push('initialize must agree to the requested protocolVersion when supported')
    }
    if (!result?.serverInfo?.name || !result.serverInfo.version) {
      failures.push('initialize must advertise serverInfo name and version')
    }
    if (!result?.capabilities?.tools) {
      failures.push('initialize must advertise tools capability')
    }
  }

  // Version negotiation: an older-but-supported revision is honoured, an
  // unknown one falls back to this server's newest rather than being echoed.
  const negotiated = await driveStdio([
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n',
    '{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}\n',
    '{"jsonrpc":"2.0","id":3,"method":"initialize","params":{}}\n',
  ])
  if (negotiated.length !== 3) {
    failures.push(`expected 3 initialize responses, got ${negotiated.length}`)
  } else {
    const versionOf = (index: number) =>
      (negotiated[index].result as { protocolVersion?: string } | undefined)?.protocolVersion

    if (versionOf(0) !== '2024-11-05') {
      failures.push('initialize must honour an older revision this server still supports')
    }
    if (versionOf(1) !== MCP_PROTOCOL_VERSION) {
      failures.push('initialize must not echo back an unsupported protocolVersion')
    }
    if (versionOf(2) !== MCP_PROTOCOL_VERSION) {
      failures.push('initialize must fall back to the newest revision when none is requested')
    }
  }

  return failures
}

async function runRequestHandlerTests(): Promise<string[]> {
  const failures: string[] = []
  const runtime = new McpRuntime('read-only', fixtureContext())

  const expectResponse = (
    label: string,
    response: McpServerResponse | null,
  ): McpServerResponse | null => {
    if (!response) {
      failures.push(`${label} should produce a response`)
      return null
    }
    if (response.jsonrpc !== '2.0') failures.push(`${label} response must carry jsonrpc "2.0"`)
    return response
  }

  const list = expectResponse('tools/list', await handleMcpRequest(runtime, { id: 1, method: 'tools/list' }))
  const tools = (list?.result as { tools?: unknown[] } | undefined)?.tools
  if (!tools?.length) {
    failures.push('tools/list should return tools')
  }

  const call = expectResponse(
    'tools/call',
    await handleMcpRequest(runtime, {
      id: 2,
      method: 'tools/call',
      params: { name: 'mcp.inspectExportProfiles', arguments: {} },
    }),
  )
  if (call?.error) {
    failures.push(`tools/call failed: ${call.error.message}`)
  }

  const missingName = expectResponse(
    'tools/call without name',
    await handleMcpRequest(runtime, { id: 3, method: 'tools/call', params: {} }),
  )
  if (missingName?.error?.code !== JSON_RPC_INVALID_PARAMS) {
    failures.push('tools/call without a name must return -32602')
  }

  const unknownMethod = expectResponse(
    'unknown method',
    await handleMcpRequest(runtime, { id: 4, method: 'no/such/method' }),
  )
  if (unknownMethod?.error?.code !== JSON_RPC_METHOD_NOT_FOUND) {
    failures.push('unknown method must return -32601')
  }

  const unknownTool = expectResponse(
    'unknown tool',
    await handleMcpRequest(runtime, {
      id: 5,
      method: 'tools/call',
      params: { name: 'mcp.doesNotExist' },
    }),
  )
  if (typeof unknownTool?.error?.code !== 'number') {
    failures.push('tool errors must use integer JSON-RPC codes')
  }
  if ((unknownTool?.error?.data as { code?: string } | undefined)?.code !== 'mcp.tool_missing') {
    failures.push('tool error detail must be preserved in error.data')
  }

  const notification = await handleMcpRequest(runtime, { method: 'notifications/initialized' })
  if (notification !== null) {
    failures.push('notifications/initialized must not be answered')
  }

  const idlessRequest = await handleMcpRequest(runtime, { method: 'tools/list' })
  if (idlessRequest !== null) {
    failures.push('requests without an id are notifications and must not be answered')
  }

  const badVersion = expectResponse(
    'wrong jsonrpc version',
    await handleMcpRequest(runtime, { jsonrpc: '1.0', id: 6, method: 'tools/list' }),
  )
  if (badVersion?.error?.code !== -32600) {
    failures.push('a non-2.0 jsonrpc version must return -32600')
  }

  const stringId = expectResponse(
    'string id',
    await handleMcpRequest(runtime, { jsonrpc: '2.0', id: 'abc', method: 'initialize' }),
  )
  if (stringId?.id !== 'abc') {
    failures.push('string request ids must be echoed unchanged')
  }

  return failures
}

export async function runStdioValidation(): Promise<string[]> {
  return [...(await runRequestHandlerTests()), ...(await runStdioFramingTests())]
}
