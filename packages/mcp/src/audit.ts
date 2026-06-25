import type { McpAuditRecord, McpMode } from '@scriptor/core/contracts/mcp'

import { redactSensitiveText } from './redaction.ts'

export interface AuditAppendInput {
  toolName: string
  mode: McpMode
  commandId: string
  outcome: McpAuditRecord['outcome']
  approvedAt?: string
  detail?: string
}

export class AuditLog {
  private records: McpAuditRecord[] = []
  private sequence = 0

  append(input: AuditAppendInput): McpAuditRecord {
    const record: McpAuditRecord = {
      id: `audit-${++this.sequence}`,
      toolName: redactSensitiveText(input.toolName),
      mode: input.mode,
      commandId: redactSensitiveText(input.commandId),
      requestedAt: new Date().toISOString(),
      approvedAt: input.approvedAt,
      outcome: input.outcome,
      detail: input.detail ? redactSensitiveText(input.detail) : undefined,
    }
    this.records.unshift(record)
    return record
  }

  list(limit = 50): McpAuditRecord[] {
    return this.records.slice(0, limit)
  }

  clear(): void {
    this.records = []
    this.sequence = 0
  }
}

export function runAuditTests(): string[] {
  const failures: string[] = []
  const log = new AuditLog()
  const record = log.append({
    toolName: 'mcp.search',
    mode: 'read-only',
    commandId: 'mcp.search',
    outcome: 'allowed',
  })

  if (log.list().length !== 1) failures.push('audit append')
  if (record.id !== 'audit-1') failures.push('audit id sequence')
  return failures
}
