export type McpMode = 'off' | 'read-only' | 'draft' | 'write-approved'

export interface McpJsonSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
  anyOf?: unknown[]
}

export interface McpToolDescriptor {
  name: string
  description: string
  modeRequired: McpMode
  commandId: string
  inputSchema: McpJsonSchema
  outputSchema?: McpJsonSchema
}

export interface McpAuditRecord {
  id: string
  toolName: string
  mode: McpMode
  commandId: string
  requestedAt: string
  approvedAt?: string
  outcome: 'allowed' | 'denied' | 'failed'
  detail?: string
}

