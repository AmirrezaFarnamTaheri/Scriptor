[English](STORE-MIGRATION.md) · [فارسی](STORE-MIGRATION.fa.md) · [简体中文](STORE-MIGRATION.zh-CN.md) · [Русский](STORE-MIGRATION.ru.md) · **Deutsch** · [Español](STORE-MIGRATION.es.md)

# Eigentum an Renderer-Stores

Stores besitzen flüchtigen Renderer-Zustand, Read-Model-Caches, Request-Identität, optimistische UI und Retry-Zustand. Sie werden niemals Autorität für Vault-Dateien, Secrets, Autorisierung, Daemon-Nonces oder native Jobausführung.

## Aktuelles Eigentum

| Oberfläche | Aktueller Owner | Nächste Extraktion | Grenze |
| --- | --- | --- | --- |
| Panel-Routing und Payloads | App-Shell und Overlay-Hook | `usePanelRouterStore` | Native Befehle bleiben außerhalb des Stores |
| Reader-Lifecycle und Annotation-Retry | Reader-Panel und Save-Queue | `useReaderSessionStore` | Vault-Sidecar ist dauerhafte Autorität |
| Plugin-Entscheidungen | Backend-Plugin-Zustand über Bridge projiziert | `useCapabilityStore` | Vault-backed Zustand und native Gates sind maßgeblich |
| MCP Discovery/Drafts/Audit | MCP-Panels und Runtime-Hooks | `useMcpRuntimeStore` | Tool-Ausführung und Berechtigungsprüfungen bleiben nativ |
| Git-Status und Jobs | Git-Panels/Hooks | `useGitWorkspaceStore` | Git-Prozess, Credentials und Konfliktschreibvorgänge bleiben nativ |
| Konfliktauswahl und Merge-Preview | Git-UI | `useConflictResolutionStore` | Kanonischer Markdown-Write bleibt an Vault/Native-Grenze |
| Task/Kanban-Requests | Domain-Panels | `useTaskBoardStore` | Request-IDs verwerfen alte Antworten; Markdown ist Wahrheit |
| Export- und Publish-Pläne | Export/Publish-Panels | `useExportJobStore`, `usePublishPlanStore` | Prozessstart und Veröffentlichung bleiben nativ/CI |
| Navigation/History/Tabs | Editor- und Navigation-Controller | reducer-backed navigation store | Editor-Persistenz bleibt Vault-backed |

## Extraktionsregel

Jede Extraktion beginnt mit einem fehlschlagenden Race/Retry-Test, stellt eine typisierte Zustandsmaschine (`idle`, `loading`, `success`, `error`, `cancelled`) bereit, trägt eine Request- oder Job-ID und bewahrt die bestehende native Autorisierungsgrenze. Ein Store ist erst vollständig migriert, wenn der alte Owner entfernt ist, alle Consumer den neuen Vertrag nutzen und der doppelte Zustand nicht mehr auseinanderlaufen kann.

Das aktuelle Paket enthält bereits die Controller-Zerlegung für Navigation, Editor-Orchestrierung und Panel-Oberflächen. Die verbleibenden Stores sind bewusst gestaffelte Folgearbeiten und keine parallel eingeführten Provider ohne Ownership-Migration.

## Visuelle Referenzen

Die Store-Grenzen entsprechen den geprüften Oberflächen in der [visuellen Galerie](./VISUAL-REVIEW.de.md):

- Panel-Routing und Befehlsverfügbarkeit: [Command Palette](assets/screenshots/command-palette.png)
- Graph/Canvas-Workspace-Zustand: [Graph](assets/screenshots/graph.png) und [Canvas](assets/screenshots/canvas.png)
- Git/Konflikt-Zustand: [Git-Panel](assets/screenshots/git-panel.png) und [Konfliktlöser](assets/screenshots/conflict-resolver.png)
- MCP-Runtime-Zustand: [MCP-Panel](assets/screenshots/mcp-panel.png)
- Export/Publish-Jobs: [Publish Center](assets/screenshots/publish-center.png)
- Einstellungen und Plugin-Zustand: [Settings](assets/screenshots/settings.png) und [Plugins](assets/screenshots/plugins.png)
