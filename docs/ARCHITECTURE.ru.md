# Текущая архитектура

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · **Русский** · [Deutsch](ARCHITECTURE.de.md) · [Español](ARCHITECTURE.es.md) · [فارسی](ARCHITECTURE.fa.md)

**Статус:** карта текущей реализации. Каноническая версия продукта находится в [`VERSION`](../VERSION); design-only предложения вынесены в отдельные документы и помечены в [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

## Runtime-топология

```text
React renderer
  -> typed bridge commands
  -> Tauri command adapters
  -> authorization broker
  -> application/kernel crates
       vault | indexer | native-git | export-runner | canvas-engine
  -> filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  -> daemon IPC (scriptor-ipc envelopes)
  -> daemon handlers and shared kernel crates
```

Renderer не является границей полномочий. Native-операции независимо от UI-state валидируют scope, authorization, runtime payloads, paths, process policy и cancellation.

## Плоскости и владение

| Plane | Owner | Обязанности |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | композиция workspace, capture/rename workflows и presentation state |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | parsing недоверенных bridge/storage payloads |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | только mapping аргументов/результатов Tauri |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | одноразовые operation/scope grants и native confirmation |
| Vault | `crates/vault/` | безопасные paths, notes, config, scans, watcher events, audit records |
| Index | `crates/indexer/` | SQLite current schema, FTS, backlinks, graph и knowledge queries |
| Git | `crates/native-git/` | noninteractive status/diff/commit/conflict operations |
| External tools | `crates/system-bridge/src/process.rs` | executable policy, sanitized env, sandbox, bounds, cancellation, receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authenticated local RPC, frame bounds, resynchronizing event delivery, jobs, MCP bridge; command catalog владеет контрактом отдельно от dispatch |
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | все пять native Git mutations идут через bounded per-repo GitQueue worker с 64-slot backpressure; handle сбрасывается при vault swap; read-only whole-vault commands выполняются вне daemon state mutex через session-clone seam |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profiles, preflight, diagrams, Pandoc orchestration |
| Publish | `crates/publish-runner/`, desktop/CLI adapters | frontmatter-gated plan/review/apply, managed local Starlight output, stale-plan и output-drift protection |
| UI packages | `packages/*` | deep modules доступны только через package exports; MCP tool contracts/catalog отделены от runtime state и dispatch |

## Основные рабочие процессы

### Открытие и индексация vault

1. Renderer запрашивает открытие vault через typed bridge.
2. Native adapter валидирует path и обновляет scoped state.
3. Metadata discovery отделено от bounded content parsing.
4. Indexer применяет generation и сохраняет notes/links/FTS в SQLite.
5. Watcher группирует incremental changes; overflow/error выдаёт `RescanRequired`.
6. Desktop и daemon игнорируют stale generations и используют одинаковый full-rebuild recovery.

### Изменение note через MCP

1. Проверить tool и vault scope.
2. Сохранить и `fsync` intent с idempotency key и hash-chain link.
3. Выполнить atomic vault mutation.
4. Добавить outcome. Если процесс остановился между intent и outcome, startup reconciliation детерминированно разрешает pending record.

### Commit выбранных файлов

`crates/native-git/src/status.rs` создаёт изолированный временный index, инициализированный из `HEAD`, stages буквальные запрошенные paths, создаёт commit tree, обновляет branch и не меняет исходный index пользователя.

### Чтение документов vault

Reader на native boundary принимает только vault-relative paths PDF/EPUB. Native code разрешает и ограничивает каждый path до возврата bytes документа; renderer использует встроенные PDF/EPUB viewer assets и атомарно хранит annotations в vault sidecar. Активация Reader происходит прежде всего через command palette, без заявления о default shortcut.

### Обновление tasks и Kanban cards

Tasks индексируются из Markdown, а изменения до native mutation записываются обратно в исходную note через canonical vault save path. Kanban — альтернативный Markdown view: перемещение card переписывает source file, перемещая полную строку card под требуемый `##` heading, затем обновляет index. Оба пути отклоняют stale/invalid source state вместо молчаливого optimistic UI-only изменения.

### Публикация локального Starlight site

1. Desktop или CLI запрашивает у `crates/publish-runner` read-only plan, полученный из bounded symlink-aware vault scan.
2. Кандидаты — только notes с `publish: true`; sealed content отклоняется после opt-in gate.
3. Desktop показывает new/changed/orphaned items для review. Apply — отдельная native-authorized mutation.
4. Apply заново вычисляет eligibility и content hashes, отклоняет stale или придуманные renderer selections и удаляет только fresh paths, ранее принадлежащие publish state.
5. Managed output использует atomic writes и запрещает traversal, symlink indirection, source/output containment и unmanaged overwrites. Отсутствующие или вручную изменённые generated pages сохраняют managed ownership, но отображаются changed в следующем plan, чтобы reviewed apply мог их восстановить.

### Внешний процесс

Все поддерживаемые launches проходят process broker. Policy включает canonical executable resolution, optional binary hash, trusted workspace, environment allowlist, network policy, time/output limits, process group/job cancellation и structured outcome. Команды не собираются shell-строкой.

### Backup и restore

- Локальные `.scriptor/snapshots` — быстрые recovery snapshots.
- External targets создают disaster-recovery backups в каталоге, связанном с vault.
- Каждый backup содержит versioned SHA-256 manifest.
- Restore перед promotion проверяет path, size, hash и vault binding и записывает crash-visible restore journal.

## Модель данных и контроль масштаба

SQLite использует WAL, foreign keys, busy timeouts, current-schema validation, FTS и secondary indexes для vault/path и link adjacency. Graph API ограничены и сохраняют BFS depth/parent/path. Knowledge summaries и link resolution используют batch/aggregate queries. Scans ограничивают число файлов и размер notes.

## Границы доверия и отказов

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse из `unknown`; quarantine повреждённого persisted state |
| Filesystem | vault confinement, без symlink/traversal escape |
| SQLite | current-schema validation; явные busy/error surfaces |
| Watcher | generation IDs и full-rescan recovery |
| Event subscribers | bounded nonblocking queues; slow consumers отключаются; authenticated resubscription выдаёт `ResyncRequired` до возобновления обычной delivery |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | redaction, size rotation, bounded tail; mutation log hash chain |
| Release | immutable action pins, version contract, explicit unsigned trust records, checksums/SBOM/receipt, provenance attestations |

## Известная архитектурная работа

### Проверяемые процессы исходников, синхронизации и отображения

Исследовательские поверхности используют существующие границы vault/indexer. Таблица сначала сохраняет редактор и удерживает исходно показанную ревизию; изменённый источник требует перезагрузки и проверки. Capture/Zotero показывают импорт до записи отсутствующего назначения в исходный vault. Credentials остаются в памяти, смена ключа сбрасывает pagination.

PDF/EPUB ограничены 128 MiB; растровые изображения/аудио — 32 MiB, активные SVG/HTML исключены. MIME проверяется, object URL отзывается при смене источника/unmount. Протокол Reader выдаёт встроенный viewer, не произвольные пути.

Receipt связывает публикацию с fingerprints исходников/вывода. Deployment получает только приватный ограниченный временный snapshot, сверенный с receipt и удаляемый в конце. Адаптеры экспериментальны до доказательств packaging и live-provider.

Переименование сохраняет черновики до нативной мутации. Ошибка отменяет операцию и оставляет черновик; ссылки обновляются под охраной ревизии/навигации. Нативные stale-checks решающие. Уникальные имена recovery защищают старые backups. История читает максимум последние 256 KiB и 200 валидных записей; запись больше 16 KiB отклоняется, история больше 1 MiB уплотняется под vault-lock. Rename-recovery хранится отдельно без автоподчистки.

Цитаты разрешаются по текущей библиографии в текстовых узлах до sanitization. Группы сохраняют префиксы, локаторы и подавление автора; отсутствующий ключ оставляет исходник с доступной меткой. Код, ссылки и существующие цитаты исключены. Preview автор/год не меняет Markdown и не заменяет CSL.

`useWorkspaceShortcutPreferences` валидирует ограниченные версионные UI-данные; `WorkspaceShortcutBar` использует текущий каталог. Подписи/размеры не хранят исполняемых команд. Ошибка сохраняет черновик; palette восстанавливает скрытые строки.

`useWorkspaceComposition` связывает валидные vault-leaves с двумя dock-группами. Восстановление ссылок не активирует владельцев; навигация требует согласия. Скрытые/перемещённые вкладки сохраняют mounted-владельцев; вложенные диалоги не дают скрыть владельца. Lifecycle действует на лист, dirty-редакторы открываются последовательно. Основной редактор один; боковые Markdown-листы — read-only snapshots. Module manager проверяет manifest и текущую plugin-policy до сохранения preferences.

Отдельные исходники используют `commands/source_files.rs`, явный список текстовых форматов, bounded UTF-8, hash-save, строгое создание и immutable recovery. Они не входят в метаданные/историю Markdown-прозы. Несохранённая навигация решается до смены vault; вытесненные решения не блокируют переключение.

`calendar_sync` сохраняет публичную привязку папки/транспорта и OAuth client ID без миграции. Drive/Docs, Calendar/Tasks, Gmail имеют три отдельные OS-keychain записи с сервисными grants. Discovery валидирует bounded-страницы, отвергает частичные результаты/циклы и сохраняет write-roles Calendar. Смена аккаунта инвалидирует потребителей/reviews; OAuth-генерации не дают позднему login восстановить отключённые credentials. Локальное удаление не отзывает весь grant Google; это отдельное действие в аккаунте.

Продолжения удерживают исходные vault/account. Смена аккаунта инвалидирует discovery, сообщения, reviews и imports. Planner-блоки локальны; mappings/baselines принадлежат подтверждённому аккаунту и выбранному календарю/списку. Поздний ответ unmounted-planner не переписывает активный. Gmail перепроверяет контекст до save/index/navigation; отправленная запись может закончиться, устаревшие последствия подавляются.

Drive JSON и opaque Docs используют общую revision/conflict-модель и одноразовый нативный grant. Docs проверяет canonical envelope/checksum с сохранением Markdown-байтов. Rich-text преобразуется отдельно после review; медиа не переносится. [Руководство Google](guides/GOOGLE_INTEGRATIONS.ru.md).

Overleaf использует фиксированный Git-host через broker. Изолированный свежий repo сохраняет весь remote-index и материализует только выбранный blob; проверки объектов обходят текстовые фильтры. Review HEAD/содержимого предшествует обычному non-force push; локальная запись защищена content-CAS.

Постоянные Python-kernels — vault-owned broker-процессы конечной жизни, с разрешением на ячейку/источник, bounded output и собственными plots. Нативная transition-guard блокирует позднюю регистрацию; смена vault и restore останавливают старые kernels. Другие языки выполняются отдельно.

Graphviz — встроенный WebAssembly в отменяемом worker с deadline. DOT-fences и Diagram studio делят клиент; SVG показывается пассивной картинкой. Offline PDF остаётся native с ограниченными asset-snapshots, notices и уникальными artifacts. Renderer-fixtures не доказывают packaging/live-provider.

Adapter layer сохраняет composition root, но quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema и CLI benchmarks уже имеют сфокусированных owners. Дальнейшая декомпозиция идёт через характеризованные vertical workflows поверх typed application services, а не через big-bang rewrite. См. capability ledger.
