import type { McpAuditRecord, McpMode } from '@scriptor/core/contracts/mcp'

import { redactSensitiveText } from './redaction.ts'

const MAX_RECORDS = 1000
const MAX_DETAIL_LENGTH = 4096
function diagnosticText(input: string): string {
  const redacted = redactSensitiveText(input)
  const marker = '[TRUNCATED]'
  return redacted.length > MAX_DETAIL_LENGTH
    ? redacted.slice(0, MAX_DETAIL_LENGTH - marker.length) + marker
    : redacted
}

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
      toolName: diagnosticText(input.toolName),
      mode: input.mode,
      commandId: diagnosticText(input.commandId),
      requestedAt: new Date().toISOString(),
      approvedAt: input.approvedAt,
      outcome: input.outcome,
      detail: input.detail ? diagnosticText(input.detail) : undefined,
    }
    this.records.unshift(record)
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS
    return record
  }

  list(limit = 50): McpAuditRecord[] {
    const count = Number.isFinite(limit) ? Math.max(0, Math.min(MAX_RECORDS, Math.floor(limit))) : 50
    return this.records.slice(0, count)
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
