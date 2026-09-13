[English](CONTENT_HASH_AUDIT.md) · [فارسی](CONTENT_HASH_AUDIT.fa.md) · **简体中文** · [Русский](CONTENT_HASH_AUDIT.ru.md) · [Deutsch](CONTENT_HASH_AUDIT.de.md) · [Español](CONTENT_HASH_AUDIT.es.md)

# 增量路径 Content-Hash 跳过逻辑审计

**日期：**2026-06-27  
**状态：**审计完成 — 未发现代码缺口；桌面应用差异记录为架构权衡

---

## 1. 中央 Hash 检查函数

决定是否跳过重建的唯一权威来源是 `crates/indexer/src/notes.rs:82-88` 中的 `note_needs_reindex`：

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

它通过 `crate::hash::content_hash` 计算 `sha256(markdown)`，并与 `notes` 表中保存的 hash 比较。相同时返回 `false`，即跳过工作。

所有增量路径都汇聚到 `apply_note_index_change`（`crates/indexer/src/rebuild.rs:189-213`），后者在任何 parse/upsert 之前调用 `note_needs_reindex`。

---

## 2. 增量索引入口

### 2.1 完整 Rebuild

| 入口 | 文件 | Hash 检查？ |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **是** — 直接调用 `note_needs_reindex` |

### 2.2 Daemon (`crates/daemon`)

所有 daemon 路径调用 `incremental_note(s)_index_with_cache`，再委托给 `apply_note_index_change` → `note_needs_reindex`。

| 入口 | 文件:行 | Trigger | Hash 检查？ |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **是** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **是** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **是** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | vault open recovery | **是** |
| `cmd_save_note` | `command_gateway.rs:930` | gateway `vault_save_note` | **是** |
| `cmd_rename_apply` | `command_gateway.rs:966` | gateway `vault_rename_apply` | **是** |
| `vault_lint_fix` | `command_gateway.rs:332` | lint fix | **是** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | frontmatter edit | **是** |
| `indexer_update_note` | `command_gateway.rs:534` | manual reindex | **是** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | batch changes | **是** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | history restore | **是**（save + watcher catch-up） |
| `apply_watch_batch` (watcher) | `watcher.rs:53` | filesystem events | **是** |

**Daemon save/rollback 模式**（`handler.rs:348-361`, `command_gateway.rs:928-943`）：`save_note_with_options` 写盘后调用 `incremental_note_index_with_cache`。若索引失败，`rollback_save_note` 恢复之前的磁盘状态，从而避免 index/disk 不一致。

### 2.3 Desktop App (`apps/desktop/src-tauri`)

桌面应用采用 **watcher-mediated** 架构：Tauri command 写盘，后台 `VaultWatcher` 以 300 ms debounce 发现变化并自动调用 `incremental_notes_index`。

| 入口 | 文件:行 | Trigger | 显式 index call？ | Hash 检查？ |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | 否 — watcher | **是**（watcher） |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | 否 — watcher | **是**（watcher） |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | 否 — watcher | **是**（watcher） |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | 否 — watcher | **是**（watcher） |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | 否 — watcher | **是**（watcher + `apply_note_index_change` removal） |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **是** | **是** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **是** | **是** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **是** | **是** |

---

## 3. 缺口分析

### 3.1 Hash 检查覆盖：完整

每条增量索引路径——无论显式还是 watcher-mediated——都汇聚到 `apply_note_index_change` → `note_needs_reindex`。没有路径绕过 content-hash 比较。

### 3.2 Desktop App：Save 后无 Rollback

Daemon save 路径有事务性 rollback：若写盘后的 `incremental_note_index` 失败，`rollback_save_note` 恢复旧内容。

桌面 `vault_save_note`（`vault.rs:48-72`）写盘后立即返回，watcher 异步索引。若索引失败，没有 rollback；文件保留新状态，而 index 保持旧状态。

**影响：**低。Watcher 会在下一个 filesystem event 重试，完整 `rebuild_index` 始终可以恢复。这是为简化 desktop-only 路径而做的有意权衡。

### 3.3 Watcher 漏失窗口

若 watcher 未运行，Tauri command 的磁盘变化不会被索引，直到下次 `rebuild_index` 或显式 `indexer_update_note`。

**影响：**低。Watcher 在打开 vault 时启动，并在 transport reconnect 时重启（`crates/daemon/src/transport.rs:244-245, 322-323`）。

---

## 4. 结论

**未发现代码缺口。** 所有增量路径都会在完整 parse+upsert 前通过 `note_needs_reindex` 检查 content hash。区别只在触发方式：

- **Daemon：**显式调用，并有 rollback protection
- **Desktop：**由 watcher 触发，无 rollback

两者都能正确跳过未变化笔记。
