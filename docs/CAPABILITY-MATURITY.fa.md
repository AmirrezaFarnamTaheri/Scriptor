<div dir="ltr" align="center">
[English](CAPABILITY-MATURITY.md) · **فارسی** · [简体中文](CAPABILITY-MATURITY.zh-CN.md) · [Русский](CAPABILITY-MATURITY.ru.md) · [Deutsch](CAPABILITY-MATURITY.de.md) · [Español](CAPABILITY-MATURITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# دفتر بلوغ قابلیت‌ها

[English](CAPABILITY-MATURITY.md) · [简体中文](CAPABILITY-MATURITY.zh-CN.md) · [Русский](CAPABILITY-MATURITY.ru.md) · [Deutsch](CAPABILITY-MATURITY.de.md) · [Español](CAPABILITY-MATURITY.es.md) · **فارسی**

این دفتر مرجع رسمی برای ادعاهای پشتیبانی است. **Implemented** یعنی source وجود دارد. **Supported** علاوه بر آن به تست یکپارچه، inclusion در release، مستندات و owner مشخص نیاز دارد. **Experimental** فقط با opt-in فعال می‌شود و ممکن است تغییر کند. **Design-only** نباید به‌عنوان قابلیت در دسترس معرفی شود.

| قابلیت | وضعیت | Source / Evidence | وضعیت در Release |
|---|---|---|---|
| خواندن/نوشتن/config در vault Markdown | Supported | <bdi dir="ltr">`crates/vault/`، Tauri/daemon adapters</bdi> | Included |
| index و search با SQLite/FTS | Supported | <bdi dir="ltr">`crates/indexer/`</bdi> | Included |
| Backlinks/knowledge/graph | Supported, bounded | <bdi dir="ltr">`crates/indexer/src/knowledge.rs`, `graph.rs`</bdi> | Included |
| Desktop workspace | Supported | <bdi dir="ltr">`src/`, `apps/desktop/`</bdi> | Included |
| Reader فایل PDF/EPUB داخل vault با annotation | Experimental | <bdi dir="ltr">`src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json`</bdi> | فقط desktop محلی؛ پیش از ادعای support به اثبات کامل browser/accessibility و release-gate نیاز دارد |
| ویرایش task مبتنی بر Markdown | Experimental | <bdi dir="ltr">`crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx`</bdi> | source Markdown را از مسیر vault write به‌روزرسانی می‌کند؛ پیش از ادعای support به end-to-end proof در محیط clean نیاز دارد |
| Markdown Kanban | Experimental | <bdi dir="ltr">`crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx`</bdi> | جابه‌جایی card، خط کامل source را زیر heading درخواستی <bdi dir="ltr">`##`</bdi> منتقل می‌کند؛ پیش از ادعای support به browser-flow proof نیاز دارد |
| CodeMirror Markdown editor | Default supported editor | <bdi dir="ltr">`packages/editor/src/codemirror.tsx`</bdi> | Included |
| Monaco editor | Advanced/lazy editor | <bdi dir="ltr">`src/components/shell/EditorWorkspace.tsx`</bdi> | Included, non-default |
| Git operations/conflict UI | Supported | <bdi dir="ltr">`crates/native-git/`, `src/components/GitPanel.tsx`</bdi> | Included |
| Export/Pandoc profiles | Supported with external-tool policy | <bdi dir="ltr">`crates/export-runner/`, `packages/export/`</bdi> | Included؛ Pandoc جداست |
| Citation parsing/bibliography UI | Supported, bounded | <bdi dir="ltr">`crates/indexer/src/citations.rs`، renderer citeproc path</bdi> | Included؛ bibliography local، بدون ادعای Zotero sync |
| Local Starlight publishing | Experimental | <bdi dir="ltr">`crates/publish-runner/`، desktop plan/review/apply، CLI adapter</bdi> | فقط local output؛ source/security contractها pass می‌شوند اما اثبات کامل Cargo/browser برای release هنوز لازم است |
| Canvas | Supported | <bdi dir="ltr">`crates/canvas-engine/`, `packages/canvas/`</bdi> | Included |
| Daemon IPC / CLI / TUI | Supported | <bdi dir="ltr">`crates/daemon/`, `crates/ipc/`, `crates/cli/`</bdi> | Daemon sidecar included |
| Canonical MCP server | Supported (legacy compatibility codecs؛ adoption مربوط به current spec صریح است) | <bdi dir="ltr">`packages/mcp/`</bdi> | Included |
| Trusted automation stdio | Supported with audit/authorization؛ <bdi dir="ltr">`mcp-stdio`</bdi> به‌عنوان CLI alias باقی مانده | <bdi dir="ltr">`crates/daemon/src/automation_stdio.rs`</bdi> | Included |
| Manifest-first plugins | Experimental | <bdi dir="ltr">`packages/plugin-api/`</bdi> | فقط first-party catalog |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | <bdi dir="ltr">`commands/backup.rs`</bdi> | Included |
| External DR backups | Supported foundation؛ drill در هر release لازم است | <bdi dir="ltr">`commands/backup.rs`</bdi> | Included |
| Encrypted vaults | فقط Experimental primitives | <bdi dir="ltr">`crates/vault/src/encryption.rs`</bdi> | vault mode پشتیبانی‌شده نیست |
| Rust citation-engine (BibLaTeX parsing) | Supported | <bdi dir="ltr">`crates/citation-engine/`, `crates/indexer/src/bibliography.rs`</bdi> | indexer فایل‌های <bdi dir="ltr">`.bib`</bdi> را با engine و hayagriva grammar parse می‌کند؛ fatal parse error به warning تبدیل می‌شود، failure مربوط به conversion هر entry skip می‌شود؛ citeproc rendering surface آن crate همچنان incubating است |
| Zotero Web API connector | Experimental / library-only | <bdi dir="ltr">`packages/zotero-connector/`</bdi> | read-only library؛ داخل محصول compose نشده و sync UI عرضه‌شده ندارد |
| Google Calendar and Tasks | Experimental desktop integration | <bdi dir="ltr">`apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts`</bdi> | OAuth PKCE و token در OS-keychain؛ Google client ID پیکربندی‌شده و browser-flow evidence گسترده‌تر پیش از ادعای support لازم است |
| Gmail native bridge (manager UI composed, capability-gated) | Experimental desktop integration | <bdi dir="ltr">`apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_gmail.ts`</bdi> | پشت capability افزونه <bdi dir="ltr">`scriptor.gmail-manager`</bdi> است؛ فقط وقتی plugin صریحاً enable شده list می‌شود و هر native command شامل read/auth دوباره capability را در boundary بررسی می‌کند؛ message listing محدود با fetch هم‌زمان |
| Desktop Git mutation queue (GitQueue) | Integrated | <bdi dir="ltr">`crates/native-git/src/queue.rs`</bdi> | همه desktop Git mutationها وارد bounded per-repo worker می‌شوند؛ source-contracts، serialization + 64-slot backpressure را تست می‌کند؛ daemon-side Git commands همچنان با daemon state mutex سریال می‌شوند |
| Semantic (embedding) search | Experimental opt-in | <bdi dir="ltr">`crates/embeddings/`, `crates/daemon/src/handler.rs`</bdi> | opt-in از section <bdi dir="ltr">`semantic`</bdi> در vault config (ollama local server یا OpenAI با keychain key کاربر)؛ vault sync فقط noteهای تغییرکرده را embed می‌کند و sealed spanها را ابتدا redact می‌کند؛ بدون config به keyword-only search برمی‌گردد؛ cosine query به‌صورت zero-copy روی reusable scratch buffer اجرا می‌شود |
| Tantivy index | Evaluation | <bdi dir="ltr">`crates/tantivy-indexer/`</bdi> | از default workspace build و release binary حذف است؛ benchmark تاریخ 2026-09-01 روی release build و vault با 2k note: warm search برابر 0.0ms در برابر 7.8ms برای FTS5، هر دو بسیار کمتر از budget 100ms. با API batch commit یعنی <bdi dir="ltr">`stage_note` + `commit_batch`</bdi> ساخت index برابر 452ms در برابر حدود 8s برای FTS5 rebuild است؛ اما FTS5 همه budgetها را برآورده می‌کند و transactionally به note cache متصل است، بنابراین محصول FTS5 را نگه می‌دارد. Tantivy به‌عنوان replacement آماده برای نیاز احتمالی sub-millisecond semantic-scale search در incubating می‌ماند. مقایسه: <bdi dir="ltr">`cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>`</bdi> |
| WASM plugin host | Incubating | <bdi dir="ltr">`crates/wasm-runtime/`</bdi> | خارج از default workspace build |
| Mobile app | Design-only | <bdi dir="ltr">`docs/architecture/MOBILE_ARCHITECTURE.md`</bdi> | Not shipped |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## دروازه ارتقا به Supported

یک قابلیت فقط وقتی به Supported ارتقا پیدا می‌کند که همه موارد زیر وجود داشته باشند:

1. owner مشخص و support window؛
2. public contract پایدار و current-schema policy؛
3. تست‌های positive، negative، restart، cancellation و recovery؛
4. authorization/privacy model؛
5. bounded performance evidence؛
6. مستندات کاربر و operator؛
7. inclusion در release و artifact verification؛
8. changelog entry.

</div>


</div>
