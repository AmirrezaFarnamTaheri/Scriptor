import { e2eNoteDocument, e2eSaveNote } from './state'
/** Narrow opt-in fixture: a publish:true note excluded by another site filter. */
export function createPublishingAuditHarness() {
  const active = sessionStorage.getItem('e2e:publishing-audit') === '1'
  if (active) e2eSaveNote('Research Plan.md', '---\npublish: true\nstatus: Done\n---\n\n# Research Plan\n\nAn intentionally excluded opted-in note.')
  return (cmd: string, payload: unknown): { handled: boolean; value?: unknown } => {
    if (!active) return { handled: false }
    const body = (payload ?? {}) as Record<string, unknown>
    if (cmd === 'vault_publish_plan_starlight') return { handled: true, value: { output: String(body.output ?? body.outputPath ?? 'C:/reviewed-site'), docs_dir: 'C:/reviewed-site/src/content/docs', plan: { new_items: [], changed: [], unchanged: [], orphaned: [] } } }
    if (cmd === 'vault_read_note' && body.path === 'Research Plan.md') return { handled: true, value: e2eNoteDocument('Research Plan.md') }
    return { handled: false }
  }
}
