# Продукт

**Scriptor** · *Инструмент для серьёзной работы с текстом* · источник версии: [`VERSION`](VERSION)

## Позиционирование

Scriptor — local-first Markdown-пространство для серьёзного письма и исследований. Оно объединяет работу с текстом, управление доказательной базой, цитирование, навигацию по графу, Git-aware revision, воспроизводимую публикацию и автоматизацию с явными полномочиями, сохраняя Markdown-файлы на диске авторитетным источником.

## Контекст эксплуатации

- Tauri desktop application — основная поверхность продукта.
- Web shell используется для разработки и визуального тестирования.
- daemon, CLI/TUI, MCP server и ограниченный plugin catalog — эксплуатационные расширения той же модели vault.
- Mobile, encrypted vaults, embeddings, Tantivy и WASM host остаются экспериментальными или design-only согласно [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).

## Имеющиеся доказательства

Заявления о продукте основаны на артефактах репозитория, а не на формулировках roadmap:

- [`README.ru.md`](README.ru.md) определяет текущий release posture и поддерживаемые точки входа.
- [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md) разделяет реализованные, экспериментальные и design-only возможности.
- [`docs/ARCHITECTURE.ru.md`](docs/ARCHITECTURE.ru.md) фиксирует владение компонентами и границы доверия.
- [`docs/VERIFICATION.ru.md`](docs/VERIFICATION.ru.md) определяет, что доказывают текущие проверки и где нужны данные из чистой среды.
- [`DESIGN.ru.md`](DESIGN.ru.md) задаёт требования к взаимодействию, доступности и визуальной системе.

## Принципы продукта

1. **Файлы остаются авторитетными.** Markdown остаётся переносимым, проверяемым и восстанавливаемым.
2. **Полномочия явны.** Native-, network-, process-, plugin-, MCP-, backup-, publishing- и destructive-операции пересекают именованные границы разрешений.
3. **Работа ограничена.** Scans, graph traversals, process output, logs, queues и retained records имеют явные пределы.
4. **Изменения восстанавливаемы.** Высокоimpactные изменения показывают область, упорядоченные side effects, failure state и recovery evidence.
5. **Зрелость описывается честно.** Реализованное поведение, экспериментальная работа и варианты дизайна не выдаются за равноценные гарантии.
6. **Рабочее пространство служит письму.** Навигация, диагностика и автоматизация поддерживают документ, а не вытесняют его.

## Пользователи и их задача

Scriptor предназначен для писателей, исследователей, студентов, технических авторов и knowledge workers, поддерживающих долговечные Markdown-vaults. Они используют Scriptor, чтобы собирать материал, связывать доказательства, писать и редактировать длинные тексты, управлять цитатами, проверять качество знаний, воспроизводимо публиковать и автоматизировать ограниченные задачи без отказа от владения файлами.

## Обещание продукта

1. Markdown-файлы остаются переносимыми и авторитетными.
2. До высокорисковой операции пользователь может понять, что будет прочитано, записано, отправлено, выполнено или удалено.
3. Состояние index, graph, Git, export и backup наблюдаемо и восстанавливаемо.
4. Рабочая область письма остаётся спокойной и читаемой даже при плотной исследовательской работе.
5. Экспериментальные возможности помечаются и не выдаются за поставляемые гарантии.

## Поддерживаемые поверхности

| Поверхность | Зрелость |
|---|---|
| Web development shell | поддерживается для разработки и visual tests |
| Tauri desktop (Windows, macOS, Linux) | основная поверхность продукта |
| Headless daemon и CLI/TUI | поддерживаемые эксплуатационные поверхности |
| MCP stdio integration | поддерживается со scoped tools и durable audit records |
| Plugin catalog | manifest-first, ограниченная экспериментальная платформа |
| Google Calendar и Tasks | экспериментальные opt-in desktop integrations |
| Mobile, encrypted vaults, embeddings, Tantivy, WASM host | experimental или design-only |

Авторитетная матрица — [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).

## Метрики успеха

- отсутствие тихой потери данных и cross-vault mutation;
- ограниченные память и latency при росте vault;
- воспроизводимые релизы, привязанные к source, с явным trust status, checksums, CycloneDX SBOM, receipts и provenance attestations;
- полностью управляемые с клавиатуры и соответствующие WCAG 2.2 AA рабочие процессы;
- новый участник может найти ownership, contracts, tests и operational evidence без «археологии»;
- ключевые пользовательские сценарии работают без внешней сети, кроме явно включённых сервисов.

## Что продуктом не является

- proprietary storage как source of truth;
- ambient AI или plugin authority;
- скрытые network fallbacks;
- chat-first навигация, вытесняющая письмо;
- декоративный dashboard chrome, уменьшающий рабочую область;
- security claims для prototype encryption или неизолированного стороннего кода;
- production channels, скрывающие или искажающие намеренно unsigned trust status официальных upstream installers.

## Операционная модель

Scriptor — local-first продукт. Renderer считается недоверенным относительно native authority. Tauri commands, daemon RPC, MCP, external processes, Git, доступ к keychain и backup/restore — явные границы. Локальные logs и audit records ограничены и редактированы; mutation records высокой целостности соединяются hash-chain.

## Политика roadmap

Roadmap описывает варианты, а не текущее поведение. Capability переводится на следующий уровень только после появления:

- названного owner и source entry point;
- явной семантики trust и failure;
- positive, negative, restart, cancellation и recovery tests;
- модели authorization/privacy;
- ограниченных performance evidence;
- user/operator docs;
- release inclusion и support status в capability ledger.
