# Renderer store ownership

Stores own ephemeral renderer state, read-model caches, request identity, optimistic UI, and
retry state. They never become authority for vault files, secrets, authorization, daemon nonces, or
native job execution.

## Current ownership

| Surface | Current owner | Next extraction | Boundary |
| --- | --- | --- | --- |
| Panel routing and payloads | App shell and overlay hook | `usePanelRouterStore` | Native commands remain outside the store |
| Reader lifecycle and annotation retry | Reader panel and save queue | `useReaderSessionStore` | Vault sidecar is durable authority |
| Plugin decisions | Backend plugin state projected through bridge | `useCapabilityStore` | Vault-backed state and native gates are authoritative |
| MCP discovery/drafts/audit | MCP panels and runtime hooks | `useMcpRuntimeStore` | Tool execution and permission checks stay native |
| Git status and jobs | Git panels/hooks | `useGitWorkspaceStore` | Git process, credentials, and conflict writes stay native |
| Conflict choices and merge preview | Git UI | `useConflictResolutionStore` | Canonical Markdown write stays in vault/native boundary |
| Task/Kanban requests | Domain panels | `useTaskBoardStore` | Request IDs reject stale responses; Markdown is truth |
| Export and publish plans | Export/Publish panels | `useExportJobStore`, `usePublishPlanStore` | Process spawning and publication stay native/CI |
| Navigation/history/tabs | Editor and navigation controllers | reducer-backed navigation store | Editor persistence remains vault-backed |

## Extraction rule

Each extraction must begin with a failing race/retry test, expose a typed state machine (`idle`,
`loading`, `success`, `error`, `cancelled`), carry a request or job identifier, and preserve the
existing native authorization boundary. A store is complete only when its old owner is removed,
its consumers use the new contract, and the old duplicate state cannot diverge.

The current packet already contains the controller decomposition for navigation, editor
orchestration, and panel surfaces. The remaining stores are intentionally staged follow-ups rather
than duplicate providers added without an ownership migration.

## Visual references

The store boundaries correspond to the reviewed surfaces in the [visual gallery](./VISUAL-REVIEW.md):

- panel routing and command availability: [command palette](assets/screenshots/command-palette.png)
- graph/canvas workspace state: [Graph](assets/screenshots/graph.png) and [Canvas](assets/screenshots/canvas.png)
- Git/conflict state: [Git panel](assets/screenshots/git-panel.png) and [conflict resolver](assets/screenshots/conflict-resolver.png)
- MCP runtime state: [MCP panel](assets/screenshots/mcp-panel.png)
- export/publish jobs: [Publish center](assets/screenshots/publish-center.png)
- preferences and plugin state: [Settings](assets/screenshots/settings.png) and [Plugins](assets/screenshots/plugins.png)
