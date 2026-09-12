[English](CONTENT_HASH_AUDIT.md) · [فارسی](CONTENT_HASH_AUDIT.fa.md) · [简体中文](CONTENT_HASH_AUDIT.zh-CN.md) · **Русский** · [Deutsch](CONTENT_HASH_AUDIT.de.md) · [Español](CONTENT_HASH_AUDIT.es.md)

# Аудит пропуска по content hash на инкрементальных путях

**Дата:** 2026-06-27  
**Статус:** аудит завершён — пробелов в коде не найдено; отличие desktop app задокументировано как архитектурный trade-off

---

## 1. Центральная функция проверки hash

Единственный источник истины для решения о пропуске — `note_needs_reindex` в `crates/indexer/src/notes.rs:82-88`:

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

Функция вычисляет `sha256(markdown)` через `crate::hash::content_hash` и сравнивает его с hash в таблице `notes`. При совпадении возвращается `false`, то есть работа пропускается.

Все инкрементальные пути сходятся в `apply_note_index_change` (`crates/indexer/src/rebuild.rs:189-213`), который вызывает `note_needs_reindex` до parse/upsert.

---

## 2. Точки входа инкрементальной индексации

### 2.1 Полная перестройка

| Точка входа | Файл | Hash check? |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **Да** — напрямую вызывает `note_needs_reindex` |

### 2.2 Daemon (`crates/daemon`)

Все пути daemon вызывают `incremental_note(s)_index_with_cache`, который делегирует в `apply_note_index_change` → `note_needs_reindex`.

| Точка входа | Файл:строка | Trigger | Hash check? |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **Да** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **Да** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **Да** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | recovery при open vault | **Да** |
| `cmd_save_note` | `command_gateway.rs:930` | gateway `vault_save_note` | **Да** |
| `cmd_rename_apply` | `command_gateway.rs:966` | gateway `vault_rename_apply` | **Да** |
| `vault_lint_fix` | `command_gateway.rs:332` | lint fix | **Да** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | frontmatter edit | **Да** |
| `indexer_update_note` | `command_gateway.rs:534` | manual reindex | **Да** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | batch changes | **Да** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | history restore | **Да** (save + watcher catch-up) |
| `apply_watch_batch` (watcher) | `watcher.rs:53` | filesystem events | **Да** |

**Daemon save/rollback pattern** (`handler.rs:348-361`, `command_gateway.rs:928-943`): после записи `save_note_with_options` вызывается `incremental_note_index_with_cache`. При ошибке индексации `rollback_save_note` восстанавливает предыдущее состояние на диске, предотвращая рассинхронизацию index/disk.

### 2.3 Desktop App (`apps/desktop/src-tauri`)

Desktop использует архитектуру через **watcher**: Tauri commands пишут на диск, а фоновый `VaultWatcher` с debounce 300 ms обнаруживает изменения и автоматически вызывает `incremental_notes_index`.

| Точка входа | Файл:строка | Trigger | Явный index call? | Hash check? |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | Нет — watcher | **Да** (watcher) |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | Нет — watcher | **Да** (watcher) |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | Нет — watcher | **Да** (watcher) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | Нет — watcher | **Да** (watcher) |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | Нет — watcher | **Да** (watcher + removal в `apply_note_index_change`) |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **Да** | **Да** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **Да** | **Да** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **Да** | **Да** |

---

## 3. Анализ пробелов

### 3.1 Покрытие hash check: ПОЛНОЕ

Каждый инкрементальный путь — явный или watcher-mediated — проходит `apply_note_index_change` → `note_needs_reindex`. Обхода сравнения content hash нет.

### 3.2 Desktop App: нет rollback после save

Путь daemon имеет транзакционный rollback: если `incremental_note_index` падает после disk write, `rollback_save_note` восстанавливает прежний контент.

Desktop `vault_save_note` (`vault.rs:48-72`) пишет на диск и сразу возвращает управление. Watcher индексирует асинхронно. При ошибке rollback отсутствует: файл остаётся новым, а index — устаревшим.

**Влияние:** низкое. Watcher повторит попытку на следующем событии, а полный `rebuild_index` всегда может восстановить. Это сознательный trade-off ради простоты desktop-пути.

### 3.3 Окно пропуска watcher

Если watcher не работает, изменения Tauri-команд не индексируются до следующего `rebuild_index` или явного `indexer_update_note`.

**Влияние:** низкое. Watcher запускается при open vault и перезапускается при transport reconnect (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## 4. Вывод

**Пробелов в коде не найдено.** Все инкрементальные пути проверяют content hash через `note_needs_reindex` до полного parse+upsert. Отличается только способ запуска:

- **Daemon:** явные вызовы с rollback protection
- **Desktop:** watcher-mediated без rollback

Оба корректно пропускают неизменённые заметки.
