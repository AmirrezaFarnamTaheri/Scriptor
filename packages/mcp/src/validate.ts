import { runAuditTests } from './audit.ts'
import { runDiffTests } from './diff.ts'
import { runDraftTests } from './draft.ts'
import { runNoteWriteDraftTests } from './note-writes.ts'
import { runPermissionTests } from './permissions.ts'
import { runToolScopeTests } from './tool-scopes.ts'
import { runRedactionTests } from './redaction.ts'
import { runRuntimeReadOnlyTests } from './runtime.ts'
import { runStdioValidation } from './stdio-runner.ts'
import { runTagPatchTests } from './tag-patch.ts'

export async function runMcpValidation(): Promise<string[]> {
  return [
    ...runPermissionTests(),
    ...runToolScopeTests(),
    ...runAuditTests(),
    ...runRedactionTests(),
    ...runDiffTests(),
    ...runDraftTests(),
    ...runNoteWriteDraftTests(),
    ...runTagPatchTests(),
    ...(await runRuntimeReadOnlyTests()),
    ...(await runStdioValidation()),
  ]
}
