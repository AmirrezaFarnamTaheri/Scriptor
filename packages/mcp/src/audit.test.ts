import test from 'node:test'
import assert from 'node:assert/strict'
import { AuditLog } from './audit.ts'

test('MCP diagnostic audit keeps only its latest bounded records with monotonic IDs', () => {
  const log = new AuditLog()
  for (let index = 1; index <= 1200; index++) {
    log.append({ toolName: 'mcp.search', commandId: 'mcp.search', mode: 'read-only', outcome: 'allowed' })
  }
  const records = log.list(2000)
  assert.equal(records.length, 1000)
  assert.equal(records[0].id, 'audit-1200')
  assert.equal(records.at(-1)?.id, 'audit-201')
  assert.equal(log.list().length, 50)
})

test('MCP diagnostic details remain redacted and bounded with explicit truncation', () => {
  const log = new AuditLog()
  const record = log.append({ toolName: 'mcp.search', commandId: 'mcp.search', mode: 'read-only', outcome: 'failed', detail: `Bearer private ${'x'.repeat(8192)}` })
  assert.ok(record.detail && record.detail.length <= 4096)
  assert.ok(record.detail.endsWith('[TRUNCATED]'))
  assert.ok(record.detail.includes('[REDACTED]'))
  assert.ok(!record.detail.includes('private'))
})
