[English](CONTENT_HASH_AUDIT.md) · [فارسی](CONTENT_HASH_AUDIT.fa.md) · [简体中文](CONTENT_HASH_AUDIT.zh-CN.md) · [Русский](CONTENT_HASH_AUDIT.ru.md) · [Deutsch](CONTENT_HASH_AUDIT.de.md) · **Español**

# Auditoría del salto por hash de contenido en rutas incrementales

**Fecha:** 2026-06-27  
**Estado:** auditoría completa — no se encontraron huecos de código; la diferencia de la app de escritorio queda documentada como trade-off arquitectónico

---

## 1. Función central de comprobación de hash

La única fuente de verdad para decidir si se omite trabajo es `note_needs_reindex` en `crates/indexer/src/notes.rs:82-88`:

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

Calcula `sha256(markdown)` mediante `crate::hash::content_hash` y lo compara con el hash guardado en la tabla `notes`. Devuelve `false` —y se omite el trabajo— cuando coinciden.

Todas las rutas incrementales convergen en `apply_note_index_change` (`crates/indexer/src/rebuild.rs:189-213`), que llama a `note_needs_reindex` antes de parsear o hacer upsert.

---

## 2. Puntos de entrada de indexación incremental

### 2.1 Rebuild completo

| Punto de entrada | Archivo | ¿Hash? |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **Sí** — llama directamente a `note_needs_reindex` |

### 2.2 Daemon (`crates/daemon`)

Todas las rutas llaman a `incremental_note(s)_index_with_cache`, que delega en `apply_note_index_change` → `note_needs_reindex`.

| Punto de entrada | Archivo:Línea | Trigger | ¿Hash? |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **Sí** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **Sí** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **Sí** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | recuperación al abrir vault | **Sí** |
| `cmd_save_note` | `command_gateway.rs:930` | gateway `vault_save_note` | **Sí** |
| `cmd_rename_apply` | `command_gateway.rs:966` | gateway `vault_rename_apply` | **Sí** |
| `vault_lint_fix` | `command_gateway.rs:332` | corrección lint | **Sí** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | edición frontmatter | **Sí** |
| `indexer_update_note` | `command_gateway.rs:534` | reindex manual | **Sí** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | cambios batch | **Sí** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | restore de historial | **Sí** (save + catch-up del watcher) |
| `apply_watch_batch` (watcher) | `watcher.rs:53` | eventos filesystem | **Sí** |

**Patrón save/rollback del daemon** (`handler.rs:348-361`, `command_gateway.rs:928-943`): tras escribir `save_note_with_options`, se ejecuta `incremental_note_index_with_cache`. Si falla la indexación, `rollback_save_note` restaura el estado anterior del disco. Así se evita inconsistencia índice-disco.

### 2.3 App de escritorio (`apps/desktop/src-tauri`)

La app usa una arquitectura **mediada por watcher**: los comandos Tauri escriben en disco y un `VaultWatcher` en segundo plano, con debounce de 300 ms, detecta cambios y llama automáticamente a `incremental_notes_index`.

| Punto de entrada | Archivo:Línea | Trigger | ¿Llamada explícita al índice? | ¿Hash? |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | No — watcher | **Sí** (watcher) |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | No — watcher | **Sí** (watcher) |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | No — watcher | **Sí** (watcher) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | No — watcher | **Sí** (watcher) |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | No — watcher | **Sí** (watcher + eliminación en `apply_note_index_change`) |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **Sí** | **Sí** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **Sí** | **Sí** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **Sí** | **Sí** |

---

## 3. Análisis de huecos

### 3.1 Cobertura de hash: COMPLETA

Toda ruta incremental —explícita o mediada por watcher— converge en `apply_note_index_change` → `note_needs_reindex`. Ninguna evita la comparación de hash.

### 3.2 Desktop: sin rollback al guardar

La ruta save del daemon tiene rollback transaccional: si `incremental_note_index` falla después de escribir, `rollback_save_note` restaura el contenido anterior.

`vault_save_note` de desktop (`vault.rs:48-72`) escribe y devuelve inmediatamente. El watcher indexa de forma asíncrona. Si falla, no hay rollback: el archivo queda con el nuevo estado y el índice obsoleto.

**Impacto:** bajo. El watcher reintentará en el siguiente evento y un `rebuild_index` completo siempre puede recuperar. Es un trade-off deliberado por simplicidad.

### 3.3 Ventana de watcher perdido

Si el watcher no está funcionando, los cambios hechos por comandos Tauri no se indexan hasta el siguiente `rebuild_index` o una llamada explícita a `indexer_update_note`.

**Impacto:** bajo. El watcher arranca al abrir el vault y se reinicia al reconectar el transporte (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## 4. Conclusión

**No se encontraron huecos de código.** Todas las rutas incrementales comprueban el hash mediante `note_needs_reindex` antes del parse+upsert completo. Solo cambia cómo se dispara el índice:

- **Daemon:** llamadas explícitas con rollback
- **Desktop:** mediado por watcher, sin rollback

Ambos omiten correctamente notas sin cambios.
