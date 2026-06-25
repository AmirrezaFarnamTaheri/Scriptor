export type McpMode = 'off' | 'read-only' | 'draft' | 'write-approved'

export interface McpToolDescriptor {
  name: string
  description: string
  modeRequired: McpMode
  commandId: string
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

