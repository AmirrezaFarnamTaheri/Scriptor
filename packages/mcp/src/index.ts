export { runRuntimeReadOnlyTests } from './runtime-tests.ts'
export { AuditLog, runAuditTests } from './audit.ts'
export { approveDraftPatch, createDraftPatch, rejectDraftPatch, runDraftTests } from './draft.ts'
export type { DraftPatch, DraftPatchStatus } from './draft.ts'
export { modeAllowsTool, nextMcpMode, runPermissionTests } from './permissions.ts'
export {
  allMcpTools,
  McpRuntime,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
} from './runtime.ts'
export type { HealthIssueLike, McpBacklinksInput, McpProposePatchInput, McpReadNoteInput, McpSearchInput, McpVaultContext } from './runtime.ts'
export {
  handleMcpRequest,
  isNotification,
  jsonRpcError,
  jsonRpcParseError,
  jsonRpcResult,
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_INVALID_REQUEST,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_PARSE_ERROR,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
} from './server.ts'
export type { JsonRpcId, McpServerError, McpServerRequest, McpServerResponse } from './server.ts'
export { extractOutline } from './outline.ts'
export type { OutlineHeading } from './outline.ts'
export { applyTagPatch, extractHashtags } from './tag-patch.ts'
export { MAX_LINE_LENGTH, runMcpStdioServer } from './stdio.ts'
export type { NodeLikeProcess, StdioMcpOptions } from './stdio.ts'
export { diffDraftLines, runDiffTests } from './diff.ts'
export type { DraftDiffLine } from './diff.ts'
export { redactAuditDetail, redactSensitiveText, runRedactionTests } from './redaction.ts'
export { TOOL_SCOPES, auditToolScopeDrift, toolRequiredMode, runToolScopeTests } from './tool-scopes.ts'
export { runMcpValidation } from './validate.ts'
