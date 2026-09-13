<div dir="ltr" align="center">

[English](CONTENT_HASH_AUDIT.md) · **فارسی** · [简体中文](CONTENT_HASH_AUDIT.zh-CN.md) · [Русский](CONTENT_HASH_AUDIT.ru.md) · [Deutsch](CONTENT_HASH_AUDIT.de.md) · [Español](CONTENT_HASH_AUDIT.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# ممیزی <bdi dir="ltr">skip</bdi> بر پایه <bdi dir="ltr">Content Hash</bdi> در مسیرهای <bdi dir="ltr">incremental</bdi>

**تاریخ:** 2026-06-27  
**وضعیت:** ممیزی کامل شد — شکاف کدی پیدا نشد؛ تفاوت برنامه <bdi dir="ltr">desktop</bdi> به‌عنوان <bdi dir="ltr">trade-off</bdi> معماری مستند شده است

---

## ۱. تابع مرکزی بررسی <bdi dir="ltr">Hash</bdi>

تنها مرجع برای تصمیم <bdi dir="ltr">skip</bdi> تابع `note_needs_reindex` در `crates/indexer/src/notes.rs:82-88` است:

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

این تابع با `crate::hash::content_hash` مقدار `sha256(markdown)` را محاسبه و با <bdi dir="ltr">hash</bdi> ذخیره‌شده در جدول `notes` مقایسه می‌کند. وقتی <bdi dir="ltr">hash</bdi>ها برابر باشند `false` برمی‌گرداند، یعنی <bdi dir="ltr">reindex skip</bdi> می‌شود.

همه مسیرهای <bdi dir="ltr">incremental</bdi> در `apply_note_index_change` (`crates/indexer/src/rebuild.rs:189-213`) به هم می‌رسند؛ این تابع پیش از <bdi dir="ltr">parse/upsert</bdi>، `note_needs_reindex` را صدا می‌زند.

---

## ۲. نقاط ورود <bdi dir="ltr">indexing incremental</bdi>

### ۲.۱ <bdi dir="ltr">Rebuild</bdi> کامل

| نقطه ورود | فایل | بررسی <bdi dir="ltr">hash</bdi>؟ |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **بله** — مستقیم `note_needs_reindex` را فراخوانی می‌کند |

### ۲.۲ <bdi dir="ltr">Daemon</bdi> (`crates/daemon`)

همه مسیرهای <bdi dir="ltr">daemon</bdi> تابع `incremental_note(s)_index_with_cache` را صدا می‌زنند و آن به `apply_note_index_change` → `note_needs_reindex` <bdi dir="ltr">delegate</bdi> می‌کند.

| نقطه ورود | فایل:خط | <bdi dir="ltr">trigger</bdi> | بررسی <bdi dir="ltr">hash</bdi>؟ |
|---|---|---|---|
| `save_note` | `handler.rs:349` | <bdi dir="ltr">RPC</bdi> `SaveNote` | **بله** |
| `update_note_index` | `handler.rs:369` | <bdi dir="ltr">RPC</bdi> `UpdateNoteIndex` | **بله** |
| `rename_note_apply` | `handler.rs:392` | <bdi dir="ltr">RPC</bdi> `RenameNoteApply` | **بله** |
| `open_vault_invoke` (<bdi dir="ltr">pending reindex</bdi>) | `handler.rs:207` | <bdi dir="ltr">recovery</bdi> هنگام <bdi dir="ltr">open vault</bdi> | **بله** |
| `cmd_save_note` | `command_gateway.rs:930` | <bdi dir="ltr">gateway</bdi> `vault_save_note` | **بله** |
| `cmd_rename_apply` | `command_gateway.rs:966` | <bdi dir="ltr">gateway</bdi> `vault_rename_apply` | **بله** |
| `vault_lint_fix` | `command_gateway.rs:332` | <bdi dir="ltr">lint fix</bdi> | **بله** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | <bdi dir="ltr">frontmatter edit</bdi> | **بله** |
| `indexer_update_note` | `command_gateway.rs:534` | <bdi dir="ltr">reindex</bdi> دستی | **بله** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | <bdi dir="ltr">batch change</bdi> | **بله** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | <bdi dir="ltr">history restore</bdi> | **بله**؛ از مسیر <bdi dir="ltr">save</bdi> + <bdi dir="ltr">watcher catch-up</bdi> |
| `apply_watch_batch` (<bdi dir="ltr">watcher</bdi>) | `watcher.rs:53` | <bdi dir="ltr">filesystem event</bdi> | **بله** |

**الگوی <bdi dir="ltr">save/rollback</bdi> در <bdi dir="ltr">daemon</bdi>** (`handler.rs:348-361`, `command_gateway.rs:928-943`): پس از این‌که `save_note_with_options` روی <bdi dir="ltr">disk</bdi> می‌نویسد، `incremental_note_index_with_cache` اجرا می‌شود. اگر <bdi dir="ltr">indexing</bdi> شکست بخورد، `rollback_save_note` <bdi dir="ltr">state</bdi> قبلی <bdi dir="ltr">disk</bdi> را <bdi dir="ltr">restore</bdi> می‌کند. این رفتار از ناسازگاری <bdi dir="ltr">index</bdi> و <bdi dir="ltr">disk</bdi> جلوگیری می‌کند.

### ۲.۳ <bdi dir="ltr">Desktop App</bdi> (`apps/desktop/src-tauri`)

برنامه <bdi dir="ltr">desktop</bdi> معماری **<bdi dir="ltr">watcher-mediated</bdi>** دارد: <bdi dir="ltr">command</bdi>های <bdi dir="ltr">Tauri</bdi> روی <bdi dir="ltr">disk</bdi> می‌نویسند و یک `VaultWatcher` پس‌زمینه با <bdi dir="ltr">debounce</bdi> برابر 300 <bdi dir="ltr">ms</bdi> تغییر را شناسایی و خودکار `incremental_notes_index` را فراخوانی می‌کند.

| نقطه ورود | فایل:خط | <bdi dir="ltr">trigger</bdi> | <bdi dir="ltr">index call</bdi> صریح؟ | بررسی <bdi dir="ltr">hash</bdi>؟ |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | <bdi dir="ltr">Tauri command</bdi> | خیر — <bdi dir="ltr">watcher</bdi> | **بله** (<bdi dir="ltr">watcher</bdi>) |
| `vault_rename_apply` | `vault.rs:110-131` | <bdi dir="ltr">Tauri command</bdi> | خیر — <bdi dir="ltr">watcher</bdi> | **بله** (<bdi dir="ltr">watcher</bdi>) |
| `vault_frontmatter_set` | `vault.rs:321-347` | <bdi dir="ltr">Tauri command</bdi> | خیر — <bdi dir="ltr">watcher</bdi> | **بله** (<bdi dir="ltr">watcher</bdi>) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | <bdi dir="ltr">Tauri command</bdi> | خیر — <bdi dir="ltr">watcher</bdi> | **بله** (<bdi dir="ltr">watcher</bdi>) |
| `vault_delete_note` | `vault.rs:240-244` | <bdi dir="ltr">Tauri command</bdi> | خیر — <bdi dir="ltr">watcher</bdi> | **بله** (<bdi dir="ltr">watcher</bdi> + <bdi dir="ltr">removal</bdi> در `apply_note_index_change`) |
| `vault_lint_fix` | `vault.rs:439-450` | <bdi dir="ltr">Tauri command</bdi> | **بله** | **بله** |
| `indexer_update_note` | `indexer.rs:33-38` | <bdi dir="ltr">Tauri command</bdi> | **بله** | **بله** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | <bdi dir="ltr">Tauri command</bdi> | **بله** | **بله** |

---

## ۳. تحلیل شکاف‌ها

### ۳.۱ پوشش <bdi dir="ltr">Hash Check:</bdi> کامل

هر مسیر <bdi dir="ltr">indexing incremental</bdi> — چه صریح و چه <bdi dir="ltr">watcher-mediated</bdi> — از `apply_note_index_change` → `note_needs_reindex` عبور می‌کند. هیچ مسیری <bdi dir="ltr">comparison</bdi> مربوط به <bdi dir="ltr">content hash</bdi> را دور نمی‌زند.

### ۳.۲ <bdi dir="ltr">Desktop App:</bdi> نبود <bdi dir="ltr">rollback</bdi> هنگام <bdi dir="ltr">Save</bdi>

مسیر <bdi dir="ltr">save</bdi> در <bdi dir="ltr">daemon rollback</bdi> تراکنشی دارد: اگر `incremental_note_index` پس از <bdi dir="ltr">write</bdi> روی <bdi dir="ltr">disk</bdi> شکست بخورد، `rollback_save_note` محتوای قبلی را <bdi dir="ltr">restore</bdi> می‌کند.

`vault_save_note` در <bdi dir="ltr">desktop</bdi> (`vault.rs:48-72`) روی <bdi dir="ltr">disk</bdi> می‌نویسد و فوراً برمی‌گردد. <bdi dir="ltr">watcher</bdi> به‌صورت <bdi dir="ltr">async index</bdi> می‌کند. اگر <bdi dir="ltr">indexing</bdi> شکست بخورد <bdi dir="ltr">rollback</bdi> وجود ندارد؛ فایل روی <bdi dir="ltr">disk</bdi> با <bdi dir="ltr">state</bdi> جدید می‌ماند و <bdi dir="ltr">index stale</bdi> می‌شود.

**اثر:** کم. <bdi dir="ltr">watcher</bdi> در <bdi dir="ltr">filesystem event</bdi> بعدی <bdi dir="ltr">retry</bdi> می‌کند و `rebuild_index` کامل همیشه می‌تواند <bdi dir="ltr">recover</bdi> کند. این <bdi dir="ltr">trade-off</bdi> آگاهانه برای ساده نگه‌داشتن مسیر <bdi dir="ltr">desktop-only</bdi> است.

### ۳.۳ پنجره از‌دست‌رفتن <bdi dir="ltr">Watcher</bdi>

اگر <bdi dir="ltr">watcher</bdi> اجرا نشود، تغییرهایی که <bdi dir="ltr">command</bdi>های <bdi dir="ltr">Tauri</bdi> روی <bdi dir="ltr">disk</bdi> می‌دهند تا `rebuild_index` بعدی یا فراخوانی صریح `indexer_update_note` <bdi dir="ltr">index</bdi> نمی‌شوند.

**اثر:** کم. <bdi dir="ltr">watcher</bdi> هنگام <bdi dir="ltr">open</bdi> شدن <bdi dir="ltr">vault</bdi> شروع می‌شود و در <bdi dir="ltr">transport reconnect</bdi> دوباره راه‌اندازی می‌شود (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## ۴. نتیجه

**هیچ شکاف کدی پیدا نشد.** همه مسیرهای <bdi dir="ltr">indexing incremental</bdi> پیش از <bdi dir="ltr">parse+upsert</bdi> کامل، <bdi dir="ltr">content hash</bdi> را با `note_needs_reindex` بررسی می‌کنند. تفاوت فقط در روش <bdi dir="ltr">trigger</bdi> کردن <bdi dir="ltr">index</bdi> است:

- **<bdi dir="ltr">Daemon:</bdi>** فراخوانی صریح با <bdi dir="ltr">rollback protection</bdi>
- **<bdi dir="ltr">Desktop:</bdi>** <bdi dir="ltr">watcher-mediated</bdi> بدون <bdi dir="ltr">rollback</bdi>

هر دو <bdi dir="ltr">note</bdi>های بدون تغییر را درست <bdi dir="ltr">skip</bdi> می‌کنند.

</div>
