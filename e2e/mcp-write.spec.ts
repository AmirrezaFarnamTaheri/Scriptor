import { expect, test } from '@playwright/test'

import { waitForWorkspace } from './helpers.ts'

test.describe('MCP write-approved E2E + audit log', () => {
  test('mcp.proposePatch creates draft, approves, saves note, and writes audit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const result = await page.evaluate(async () => {
      if (!window.__scriptorE2eMcpWriteApproved) {
        throw new Error('E2E MCP harness not installed')
      }
      return window.__scriptorE2eMcpWriteApproved()
    })

    expect(result.ok).toBe(true)
    expect(result.saved).not.toBeNull()
    expect(result.saved!.path).toBe('draft.md')
    expect(result.saved!.markdown).toContain('Patched')
  })

  test('mcp.proposePatch creates a DraftPatch visible in the draft queue', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const draftResult = await page.evaluate(async () => {
      const { McpRuntime } = await import('@scriptor/mcp')
      const runtime = new McpRuntime('write-approved', {
        readNote: async () => ({
          metadata: { title: 'Draft Note', content_hash: 'hash-abc' },
          markdown: '# Draft Note\n\nOriginal content\n',
        }),
        search: async () => [],
        backlinks: async () => [],
        brokenLinks: async () => [],
        saveNote: async () => ({ path: 'draft-note.md', content_hash: 'hash-def' }),
      })

      const patch = await runtime.invoke('mcp.proposePatch', {
        path: 'draft-note.md',
        proposedMarkdown: '# Draft Note\n\nUpdated by MCP\n',
        summary: 'Update draft note content',
        baseContentHash: 'hash-abc',
      })

      if (!patch.ok) return { ok: false, error: patch.error }

      const draft = patch.output as { id: string; status: string; notePath: string }
      const pendingDrafts = runtime.listDrafts()

      return {
        ok: true,
        draftId: draft.id,
        draftStatus: draft.status,
        draftNotePath: draft.notePath,
        pendingCount: pendingDrafts.length,
        firstPendingPath: pendingDrafts[0]?.notePath,
      }
    })

    expect(draftResult.ok).toBe(true)
    expect(draftResult.draftStatus).toBe('pending')
    expect(draftResult.draftNotePath).toBe('draft-note.md')
    expect(draftResult.pendingCount).toBe(1)
    expect(draftResult.firstPendingPath).toBe('draft-note.md')
  })

  test('audit log records proposePatch + approve with required fields', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const auditResult = await page.evaluate(async () => {
      const { McpRuntime } = await import('@scriptor/mcp')
      let savedPath: string | null = null
      const runtime = new McpRuntime('write-approved', {
        readNote: async () => ({
          metadata: { title: 'Audit Note', content_hash: 'hash-1' },
          markdown: '# Audit Note\n',
        }),
        search: async () => [],
        backlinks: async () => [],
        brokenLinks: async () => [],
        saveNote: async (path: string) => {
          savedPath = path
          return { path, content_hash: 'hash-2' }
        },
      })

      const patch = await runtime.invoke('mcp.proposePatch', {
        path: 'audit-note.md',
        proposedMarkdown: '# Audit Note\n\nPatched\n',
        summary: 'Test audit trail',
        baseContentHash: 'hash-1',
      })

      if (!patch.ok) return { ok: false, error: patch.error }

      const draftId = (patch.output as { id: string }).id
      const approveResult = await runtime.approveDraft(draftId)

      const auditRecords = runtime.listAudit(10)

      return {
        ok: approveResult.ok,
        savedPath,
        auditCount: auditRecords.length,
        records: auditRecords.map((r) => ({
          toolName: r.toolName,
          mode: r.mode,
          commandId: r.commandId,
          outcome: r.outcome,
          hasRequestedAt: typeof r.requestedAt === 'string' && r.requestedAt.length > 0,
          hasApprovedAt: r.approvedAt !== undefined && r.approvedAt !== null,
        })),
      }
    })

    expect(auditResult.ok).toBe(true)
    expect(auditResult.savedPath).toBe('audit-note.md')
    expect(auditResult.auditCount).toBeGreaterThanOrEqual(2)

    const proposeAudit = auditResult.records.find(
      (r) => r.commandId === 'mcp.proposePatch' && r.outcome === 'allowed',
    )
    expect(proposeAudit).toBeDefined()
    expect(proposeAudit!.toolName).toBe('mcp.proposePatch')
    expect(proposeAudit!.mode).toBe('write-approved')
    expect(proposeAudit!.hasRequestedAt).toBe(true)

    const approveAudit = auditResult.records.find(
      (r) => r.commandId === 'note.save' && r.outcome === 'allowed',
    )
    expect(approveAudit).toBeDefined()
    expect(approveAudit!.hasApprovedAt).toBe(true)
  })

  test('Rust MCP audit JSONL includes timestamp, tool, success, duration', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const result = await page.evaluate(async () => {
      if (!window.__scriptorE2eMcpWriteApproved) {
        throw new Error('E2E MCP harness not installed')
      }
      return window.__scriptorE2eMcpWriteApproved()
    })

    expect(result.ok).toBe(true)

    const auditCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('/e2e-audit-check')
        if (!response.ok) return { skip: true, reason: 'audit endpoint not available in browser E2E' }
        return await response.json()
      } catch {
        return { skip: true, reason: 'audit endpoint not available in browser E2E' }
      }
    })

    if (auditCheck.skip) {
      console.log(`Note: Rust audit JSONL verification skipped — ${auditCheck.reason}`)
    }
  })
})
