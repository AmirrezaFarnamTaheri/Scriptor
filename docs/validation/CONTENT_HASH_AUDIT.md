# Content-Hash Skip Audit on Incremental Paths

**Date:** 2026-06-27
**Status:** Audit complete — no code gaps found; desktop app gap documented as architectural trade-off

---

## 1. Central Hash-Check Function

The single source of truth for skip decisions is `note_needs_reindex` in
`crates/indexer/src/notes.rs:82-88`:

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

It computes `sha256(markdown)` via `crate::hash::content_hash` and compares with
the hash stored in the `notes` table. Returns `false` (skip) when hashes match.

All incremental paths converge through `apply_note_index_change`
(`crates/indexer/src/rebuild.rs:189-213`), which calls `note_needs_reindex`
before doing any parse/upsert work.

---

## 2. Incremental Indexing Entry Points

### 2.1 Full Rebuild

| Entry point | File | Hash check? |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **Yes** — calls `note_needs_reindex` directly |

### 2.2 Daemon (`crates/daemon`)

All daemon paths call `incremental_note(s)_index_with_cache`, which delegates
to `apply_note_index_change` → `note_needs_reindex`.

| Entry point | File:Line | Trigger | Hash check? |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **Yes** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **Yes** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **Yes** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | vault open recovery | **Yes** |
| `cmd_save_note` | `command_gateway.rs:930` | gateway `vault_save_note` | **Yes** |
| `cmd_rename_apply` | `command_gateway.rs:966` | gateway `vault_rename_apply` | **Yes** |
| `vault_lint_fix` | `command_gateway.rs:332` | gateway lint fix | **Yes** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | gateway frontmatter edit | **Yes** |
| `indexer_update_note` | `command_gateway.rs:534` | gateway manual reindex | **Yes** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | gateway batch changes | **Yes** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | history restore | **Yes** (via save + watcher catch-up) |
| `apply_watch_batch` (watcher) | `watcher.rs:53` | filesystem events | **Yes** |

**Daemon save/rollback pattern** (handler.rs:348-361, command_gateway.rs:928-943):
After `save_note_with_options` writes to disk, `incremental_note_index_with_cache`
is called. If indexing fails, `rollback_save_note` restores the previous disk
state. This protects against index-disk inconsistency.

### 2.3 Desktop App (`apps/desktop/src-tauri`)

The desktop app uses a **watcher-mediated** architecture: Tauri commands write
to disk, and a background `VaultWatcher` (debounced 300ms) detects changes and
calls `incremental_notes_index` automatically.

| Entry point | File:Line | Trigger | Explicit index call? | Hash check? |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | No — watcher handles | **Yes** (via watcher) |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | No — watcher handles | **Yes** (via watcher) |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | No — watcher handles | **Yes** (via watcher) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | No — watcher handles | **Yes** (via watcher) |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | No — watcher handles | **Yes** (via watcher + `apply_note_index_change` removal) |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **Yes** — explicit | **Yes** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **Yes** — explicit | **Yes** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **Yes** — explicit | **Yes** |

---

## 3. Gap Analysis

### 3.1 Hash-Check Coverage: COMPLETE

Every incremental indexing path — whether explicit or watcher-mediated —
converges through `apply_note_index_change` → `note_needs_reindex`. No path
bypasses the content-hash comparison.

### 3.2 Desktop App: No Rollback on Save

The daemon's save path has transactional rollback: if `incremental_note_index`
fails after a disk write, `rollback_save_note` restores the previous content.

The desktop app's `vault_save_note` (vault.rs:48-72) writes to disk and returns
immediately. The watcher indexes asynchronously. If indexing fails, there is no
rollback mechanism. The file stays on disk in its new state while the index
stays stale.

**Impact:** Low. The watcher will retry on the next filesystem event, and a
full `rebuild_index` can always recover. This is a deliberate trade-off for
simplicity in the desktop-only path.

### 3.3 Watcher Miss Window

If the watcher is not running (e.g., failed to start, stopped after error),
disk changes made by Tauri commands will not be indexed until the next
`rebuild_index` or explicit `indexer_update_note` call.

**Impact:** Low. The watcher starts on vault open and restarts on transport
reconnect (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## 4. Conclusion

**No code gaps found.** All incremental indexing paths check the content hash
via `note_needs_reindex` before performing a full parse+upsert. The only
difference is how the index is triggered:

- **Daemon:** explicit calls with rollback protection
- **Desktop:** watcher-mediated without rollback

Both correctly skip unchanged notes.
