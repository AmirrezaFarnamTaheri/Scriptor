export { AuditLog, runAuditTests } from './audit.ts'
export { approveDraftPatch, createDraftPatch, rejectDraftPatch, runDraftTests } from './draft.ts'
export type { DraftPatch, DraftPatchStatus } from './draft.ts'
export { modeAllowsTool, nextMcpMode, runPermissionTests } from './permissions.ts'
export {
  allMcpTools,
  McpRuntime,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  runRuntimeReadOnlyTests,
} from './runtime.ts'
export type { HealthIssueLike, McpBacklinksInput, McpProposePatchInput, McpReadNoteInput, McpSearchInput, McpVaultContext } from './runtime.ts'
export { handleMcpRequest } from './server.ts'
export type { McpServerRequest, McpServerResponse } from './server.ts'
export { extractOutline } from './outline.ts'
export type { OutlineHeading } from './outline.ts'
export { applyTagPatch, extractHashtags } from './tag-patch.ts'
export { runMcpStdioServer } from './stdio.ts'
export type { StdioMcpOptions } from './stdio.ts'
export { diffDraftLines, runDiffTests } from './diff.ts'
export type { DraftDiffLine } from './diff.ts'
export { redactAuditDetail, redactSensitiveText, runRedactionTests } from './redaction.ts'
export { TOOL_SCOPES, auditToolScopeDrift, toolRequiredMode, runToolScopeTests } from './tool-scopes.ts'
export { runMcpValidation } from './validate.ts'
