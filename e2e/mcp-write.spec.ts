import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { waitForWorkspace } from './helpers.ts'

type McpScenarioInput = NonNullable<Window['__scriptorE2eMcpScenario']> extends (
  input: infer I,
) => unknown
  ? I
  : never

/**
 * Run an MCP permission scenario inside the page.
 *
 * The runtime is exercised through the bundled E2E harness rather than an
 * inline `await import('@scriptor/mcp')`: bare specifiers cannot be resolved
 * from an evaluated script, so the inline form always threw
 * "Failed to resolve module specifier '@scriptor/mcp'".
 */
async function runMcpScenario(page: Page, input: McpScenarioInput) {
  return page.evaluate(async (scenario) => {
    if (!window.__scriptorE2eMcpScenario) {
      throw new Error('E2E MCP harness not installed')
    }
    return window.__scriptorE2eMcpScenario(scenario)
  }, input)
}

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

    const result = await runMcpScenario(page, {
      mode: 'write-approved',
      calls: [
        {
          tool: 'mcp.proposePatch',
          input: {
            path: 'draft-note.md',
            proposedMarkdown: '# Draft Note\n\nUpdated by MCP\n',
            summary: 'Update draft note content',
            baseContentHash: 'hash-1',
          },
        },
      ],
    })

    expect(result.outcomes[0].ok).toBe(true)
    const draft = result.outcomes[0].output as { id: string; status: string; notePath: string }
    expect(draft.status).toBe('pending')
    expect(draft.notePath).toBe('draft-note.md')
    expect(result.pendingDrafts).toEqual([
      { id: draft.id, status: 'pending', notePath: 'draft-note.md' },
    ])
    // Proposing alone must not write anything.
    expect(result.savedPaths).toEqual([])
  })

  test('audit log records proposePatch + approve with required fields', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const result = await runMcpScenario(page, {
      mode: 'write-approved',
      calls: [
        {
          tool: 'mcp.proposePatch',
          input: {
            path: 'audit-note.md',
            proposedMarkdown: '# Audit Note\n\nPatched\n',
            summary: 'Test audit trail',
            baseContentHash: 'hash-1',
          },
        },
      ],
      approveFirstDraft: true,
    })

    expect(result.approval.ok).toBe(true)
    expect(result.savedPaths).toEqual(['audit-note.md'])
    expect(result.audit.length).toBeGreaterThanOrEqual(2)

    const proposeAudit = result.audit.find(
      (record) => record.commandId === 'mcp.proposePatch' && record.outcome === 'allowed',
    )
    expect(proposeAudit).toBeDefined()
    expect(proposeAudit!.toolName).toBe('mcp.proposePatch')
    expect(proposeAudit!.mode).toBe('write-approved')
    expect(proposeAudit!.hasRequestedAt).toBe(true)

    const approveAudit = result.audit.find(
      (record) => record.commandId === 'note.save' && record.outcome === 'allowed',
    )
    expect(approveAudit).toBeDefined()
    expect(approveAudit!.hasApprovedAt).toBe(true)
  })

  test('Rust MCP audit JSONL includes timestamp, tool, success, duration', async ({ page }) => {
    // The Rust MCP server writes its audit JSONL on the desktop side; this
    // browser suite mocks Tauri IPC and never starts it, and the `/e2e-audit-check`
    // endpoint this test used to poll does not exist (the fetch always threw and
    // the test then only console.logged, claiming coverage it never had).
    // Skip explicitly so the gap is visible in the report.
    test.skip(
      true,
      'Rust MCP audit JSONL is not reachable from the browser E2E harness — needs a Tauri/integration test.',
    )
    void page
  })
})

test.describe('MCP write approval gate — denials', () => {
  const WRITE_TOOLS = [
    { tool: 'mcp.proposePatch', commandId: 'mcp.proposePatch', input: { path: 'note.md', proposedMarkdown: '# Hacked\n', summary: 'unauthorised patch' } },
    { tool: 'mcp.createNote', commandId: 'note.create', input: { path: 'new-note.md', markdown: '# New\n', summary: 'unauthorised create' } },
    { tool: 'mcp.moveNote', commandId: 'note.rename', input: { from: 'note.md', to: 'moved.md', summary: 'unauthorised move' } },
    { tool: 'mcp.deleteNote', commandId: 'note.delete', input: { path: 'note.md', summary: 'unauthorised delete' } },
  ] as const

  test('read-only mode denies every write tool and audits the denial', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const result = await runMcpScenario(page, {
      mode: 'read-only',
      calls: WRITE_TOOLS.map((entry) => ({ tool: entry.tool, input: entry.input })),
    })

    for (const entry of WRITE_TOOLS) {
      const outcome = result.outcomes.find((candidate) => candidate.tool === entry.tool)
      expect(outcome, `${entry.tool} was never invoked`).toBeDefined()
      expect(outcome!.ok, `${entry.tool} must be denied in read-only mode`).toBe(false)
      expect(outcome!.code).toBe('mcp.permission_denied')
      expect(outcome!.message).toContain('draft')

      const audited = result.audit.find(
        (record) => record.toolName === entry.tool && record.outcome === 'denied',
      )
      expect(audited, `no denial audit record for ${entry.tool}`).toBeDefined()
      expect(audited!.mode).toBe('read-only')
      expect(audited!.commandId).toBe(entry.commandId)
      expect(audited!.hasRequestedAt).toBe(true)
    }

    // Nothing was written, queued, or advertised.
    expect(result.savedPaths).toEqual([])
    expect(result.renamedPaths).toEqual([])
    expect(result.deletedPaths).toEqual([])
    expect(result.pendingDrafts).toEqual([])
    for (const entry of WRITE_TOOLS) {
      expect(result.listedTools).not.toContain(entry.tool)
    }
    expect(result.listedTools).toContain('mcp.search')
  })

  test('draft mode queues a patch but refuses to approve it', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    const result = await runMcpScenario(page, {
      mode: 'draft',
      calls: [
        {
          tool: 'mcp.proposePatch',
          input: {
            path: 'note.md',
            proposedMarkdown: '# Note\n\nDrafted\n',
            summary: 'draft-only patch',
          },
        },
      ],
      approveFirstDraft: true,
    })

    expect(result.outcomes[0].ok).toBe(true)
    expect(result.approval.attempted).toBe(true)
    expect(result.approval.ok).toBe(false)
    expect(result.approval.code).toBe('mcp.permission_denied')
    // The write bridge must not have been touched and the draft stays pending.
    expect(result.savedPaths).toEqual([])
    expect(result.pendingDrafts).toHaveLength(1)
    expect(result.pendingDrafts[0].status).toBe('pending')

    const denial = result.audit.find(
      (record) => record.commandId === 'note.save' && record.outcome === 'denied',
    )
    expect(denial, 'approval denial was not audited').toBeDefined()
    expect(denial!.mode).toBe('draft')
  })
})
