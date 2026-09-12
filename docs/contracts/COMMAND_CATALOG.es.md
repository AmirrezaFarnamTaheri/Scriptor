[English](COMMAND_CATALOG.md) · [فارسی](COMMAND_CATALOG.fa.md) · [简体中文](COMMAND_CATALOG.zh-CN.md) · [Русский](COMMAND_CATALOG.ru.md) · [Deutsch](COMMAND_CATALOG.de.md) · **Español**

# Catálogo de comandos

## Nomenclatura

Los comandos usan nombres con puntos:

```text
area.action
```

Ejemplos:

- `vault.open`
- `note.save`
- `index.rebuild`
- `graph.backlinks`
- `export.run`
- `git.status`
- `mcp.search`

## Nombres canónicos de comandos

| Comando | Propietario | Permiso | Contrato de entrada | Contrato de salida | Rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | Sin mutación salvo el estado derivado de sesión. |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | Sin mutación. |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | Sin mutación. |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | Artefacto de recuperación de escritura atómica. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | Sin mutación. |
| `note.rename.apply` | `rust-vault` | `write-approved` | ID del dry-run más confirmación | Resultado del renombrado | Log de parches y copias de seguridad. |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | Elimina y reconstruye la caché derivada. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | Sin mutación. |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | Sin mutación. |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | Sin mutación. |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | Elimina el workspace temporal del snapshot. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | ID de template más canvas destino | Resultado del parche Canvas | Log de parches y checkpoint de undo. |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | Elimina el workspace temporal de exportación. |
| `git.status` | `rust-git` | `read` | `vaultId` | Resumen de estado Git | Sin mutación. |
| `git.commitSelected` | `rust-git` | `write-approved` | Rutas seleccionadas y mensaje | Resultado del commit | El historial Git registra la operación. |
| `mcp.search` | `mcp` | `read` | Consulta de búsqueda | Resultados | Solo registro de auditoría. |
| `mcp.proposePatch` | `mcp` | `write-approved` | Borrador del parche | Solicitud de aprobación | No escribe hasta recibir aprobación. |

## Superficie Tauri implementada (desktop v1.x)

Los nombres con puntos se mapean a comandos `invoke` en snake_case y canales de eventos en `apps/desktop/src-tauri`. Esta tabla representa el contrato actualmente distribuido.

| Superficie | Tipo | Propietario | Notas |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | Incluye rename dry-run/apply, carga/guardado de config, plan de nota diaria, save dry-run y MRU de notas recientes. |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | Lista MRU `.scriptor/recent.json`. |
| `vault:filesystem-changed` | event | Vault Kernel | Watcher con debounce; payload con rutas relativas modificadas. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | Rebuild completo, nota individual o batch incremental del watcher. |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, comandos knowledge list | command | Knowledge Graph | Búsqueda, grafo, huérfanos, bibliografía, archivos recientes, etc. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | MRU SQLite `recent_access`. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | Ejecución síncrona vs job asíncrono con cancelación. |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | Streaming de stderr y finalización del job. |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | Integración Git + preview de conflict markers. |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | Eliminación, campo FM, TextBundle y estadísticas. |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | Recorrido del grafo + DQL estilo Foam. |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Hit-test Canvas, templates, snapshots. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | Ciclo de vida y health probe. |
| `daemon_open_vault` | command | Headless IPC | Abre el vault en sesión daemon mediante RPC postcard. |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | Lint del vault + health JSON del indexer. |
| `daemon_rebuild_index` | command | Headless IPC | Rebuild completo + resumen de salud. |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | Búsqueda FTS y listado del índice. |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | Backlinks y resumen de grafo focalizado. |
| `daemon_git_status` | command | Headless IPC | Estado Git JSON para la raíz del vault. |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | Guardado de nota y refresco incremental. |
| `daemon_rename_apply` | command | Headless IPC | Aplica rename y refresca archivos afectados. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | Export Pandoc desde nota en disco o Markdown preprocesado. |

Wrappers frontend: `src/bridge/commands.ts` (reexporta `src/bridge/commands/*`), `src/bridge/canvas.ts`, `src/bridge/native.ts`, `src/bridge/vaultEvents.ts`, `src/bridge/exportEvents.ts`, `src/hooks/useHeadlessEngine.ts`.

Routing headless: cuando Settings → Headless engine está activo, `indexer.ts`, `git.ts`, `vault.ts` (save/rename) y `export.ts` delegan en `daemon_*` en lugar de comandos in-process.

## Métodos RPC del daemon (`scriptor-daemon`)

IPC con framing postcard; consulte [`architecture/IPC_DAEMON.es.md`](../architecture/IPC_DAEMON.es.md).

| Método RPC | Permiso | Notas |
|---|---|---|
| `Ping` | read | Liveness y versión. |
| `OpenVault` | system | Vincula la raíz del vault a la sesión. |
| `ListNotes` | read | Resúmenes del índice. |
| `SearchNotes` | read | Consulta FTS con límite. |
| `ReadNote` | read | Cuerpo de una nota (CLI/TUI; desktop usa lectura in-process). |
| `RebuildIndex` | system | Reconstrucción de caché derivada. |
| `HealthDiagnostics`, `HealthReport` | read | Lint y salud del indexer. |
| `GitStatus` | read | Estado Git nativo en JSON. |
| `Backlinks`, `GraphSummary` | read | Consultas del grafo. |
| `ReloadConfig` | system | Recarga `.scriptor/config.json`. |
| `SaveNote` | write-approved | Guardado atómico + actualización incremental. |
| `UpdateNoteIndex` | system | Reindexa una ruta individual. |
| `RenameNoteApply` | write-approved | Aplica rename + actualiza archivos afectados. |
| `ExportRunNote` | system | Export Pandoc desde nota del vault en disco. |
| `ExportRunMarkdown` | system | Export Pandoc desde Markdown proporcionado por el caller. |

## Bridge MCP stdio (subproceso CLI)

Al ejecutar `pnpm mcp:stdio` fuera del shell de escritorio, configure:

| Variable | Propósito |
|---|---|
| `SCRIPTOR_VAULT` | Ruta absoluta a la raíz de un vault abierto (obligatoria para contexto real de notas/búsqueda). |
| `SCRIPTOR_CLI` | Ruta opcional al binario `scriptor` (por defecto `scriptor` en `PATH`). |
| `SCRIPTOR_MCP_MODE` | Modo de permisos: `off`, `read-only`, `draft` o `write-approved` (por defecto `read-only`). |

Implementación: `packages/mcp/src/cli-vault-context.ts`, `packages/mcp/src/stdio-server.ts`.

## Checklist de revisión de comandos

Al añadir un comando o método RPC:

- Tiene módulo propietario y clase de permiso.
- Tiene input/output tipado (contratos Rust + TS cuando corresponda).
- Tiene strings/códigos de error estables para mostrar en UI.
- Tiene comportamiento de auditoría al invocarse por MCP o IA.
- Tiene nota de rollback o declaración explícita de no mutación.
- Tiene fixture, smoke script o cobertura unitaria.
