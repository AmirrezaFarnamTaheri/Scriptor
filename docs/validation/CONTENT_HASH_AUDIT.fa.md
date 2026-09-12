<div dir="ltr" align="center">

[English](CONTENT_HASH_AUDIT.md) · **فارسی** · [简体中文](CONTENT_HASH_AUDIT.zh-CN.md) · [Русский](CONTENT_HASH_AUDIT.ru.md) · [Deutsch](CONTENT_HASH_AUDIT.de.md) · [Español](CONTENT_HASH_AUDIT.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# ممیزی skip بر پایه Content Hash در مسیرهای incremental

**تاریخ:** 2026-06-27  
**وضعیت:** ممیزی کامل شد — شکاف کدی پیدا نشد؛ تفاوت برنامه desktop به‌عنوان trade-off معماری مستند شده است

---

## ۱. تابع مرکزی بررسی Hash

تنها مرجع برای تصمیم skip تابع `note_needs_reindex` در `crates/indexer/src/notes.rs:82-88` است:

</div>

<div dir="ltr" align="left">

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

</div>

<div dir="rtl" lang="fa" align="right">

این تابع با `crate::hash::content_hash` مقدار `sha256(markdown)` را محاسبه و با hash ذخیره‌شده در جدول `notes` مقایسه می‌کند. وقتی hashها برابر باشند `false` برمی‌گرداند، یعنی reindex skip می‌شود.

همه مسیرهای incremental در `apply_note_index_change` (`crates/indexer/src/rebuild.rs:189-213`) به هم می‌رسند؛ این تابع پیش از parse/upsert، `note_needs_reindex` را صدا می‌زند.

---

## ۲. نقاط ورود indexing incremental

### ۲.۱ Rebuild کامل

| نقطه ورود | فایل | بررسی hash؟ |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **بله** — مستقیم `note_needs_reindex` را فراخوانی می‌کند |

### ۲.۲ Daemon (`crates/daemon`)

همه مسیرهای daemon تابع `incremental_note(s)_index_with_cache` را صدا می‌زنند و آن به `apply_note_index_change` → `note_needs_reindex` delegate می‌کند.

| نقطه ورود | فایل:خط | trigger | بررسی hash؟ |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **بله** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **بله** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **بله** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | recovery هنگام open vault | **بله** |
| `cmd_save_note` | `command_gateway.rs:930` | gateway `vault_save_note` | **بله** |
| `cmd_rename_apply` | `command_gateway.rs:966` | gateway `vault_rename_apply` | **بله** |
| `vault_lint_fix` | `command_gateway.rs:332` | lint fix | **بله** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | frontmatter edit | **بله** |
| `indexer_update_note` | `command_gateway.rs:534` | reindex دستی | **بله** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | batch change | **بله** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | history restore | **بله**؛ از مسیر save + watcher catch-up |
| `apply_watch_batch` (watcher) | `watcher.rs:53` | filesystem event | **بله** |

**الگوی save/rollback در daemon** (`handler.rs:348-361`, `command_gateway.rs:928-943`): پس از این‌که `save_note_with_options` روی disk می‌نویسد، `incremental_note_index_with_cache` اجرا می‌شود. اگر indexing شکست بخورد، `rollback_save_note` state قبلی disk را restore می‌کند. این رفتار از ناسازگاری index و disk جلوگیری می‌کند.

### ۲.۳ Desktop App (`apps/desktop/src-tauri`)

برنامه desktop معماری **watcher-mediated** دارد: commandهای Tauri روی disk می‌نویسند و یک `VaultWatcher` پس‌زمینه با debounce برابر 300 ms تغییر را شناسایی و خودکار `incremental_notes_index` را فراخوانی می‌کند.

| نقطه ورود | فایل:خط | trigger | index call صریح؟ | بررسی hash؟ |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | خیر — watcher | **بله** (watcher) |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | خیر — watcher | **بله** (watcher) |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | خیر — watcher | **بله** (watcher) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | خیر — watcher | **بله** (watcher) |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | خیر — watcher | **بله** (watcher + removal در `apply_note_index_change`) |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **بله** | **بله** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **بله** | **بله** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **بله** | **بله** |

---

## ۳. تحلیل شکاف‌ها

### ۳.۱ پوشش Hash Check: کامل

هر مسیر indexing incremental — چه صریح و چه watcher-mediated — از `apply_note_index_change` → `note_needs_reindex` عبور می‌کند. هیچ مسیری comparison مربوط به content hash را دور نمی‌زند.

### ۳.۲ Desktop App: نبود rollback هنگام Save

مسیر save در daemon rollback تراکنشی دارد: اگر `incremental_note_index` پس از write روی disk شکست بخورد، `rollback_save_note` محتوای قبلی را restore می‌کند.

`vault_save_note` در desktop (`vault.rs:48-72`) روی disk می‌نویسد و فوراً برمی‌گردد. watcher به‌صورت async index می‌کند. اگر indexing شکست بخورد rollback وجود ندارد؛ فایل روی disk با state جدید می‌ماند و index stale می‌شود.

**اثر:** کم. watcher در filesystem event بعدی retry می‌کند و `rebuild_index` کامل همیشه می‌تواند recover کند. این trade-off آگاهانه برای ساده نگه‌داشتن مسیر desktop-only است.

### ۳.۳ پنجره از‌دست‌رفتن Watcher

اگر watcher اجرا نشود، تغییرهایی که commandهای Tauri روی disk می‌دهند تا `rebuild_index` بعدی یا فراخوانی صریح `indexer_update_note` index نمی‌شوند.

**اثر:** کم. watcher هنگام open شدن vault شروع می‌شود و در transport reconnect دوباره راه‌اندازی می‌شود (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## ۴. نتیجه

**هیچ شکاف کدی پیدا نشد.** همه مسیرهای indexing incremental پیش از parse+upsert کامل، content hash را با `note_needs_reindex` بررسی می‌کنند. تفاوت فقط در روش trigger کردن index است:

- **Daemon:** فراخوانی صریح با rollback protection
- **Desktop:** watcher-mediated بدون rollback

هر دو noteهای بدون تغییر را درست skip می‌کنند.

</div>
