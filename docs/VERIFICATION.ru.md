# Проверка

[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · **Русский** · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

Каждый результат указывает точный commit, среду, архитектуру и артефакты. Старое выполнение не подтверждает новую реализацию.

## Свидетельства и текущий статус

Исполняемые проверки этого обзора проходят только на работниках GitHub. Локальные запуск приложения, установка, тесты, сборка, lint, проверка типов и форматирование не разрешены. Изучение исходников и написанные регрессионные тесты фиксируются отдельно от успешного выполнения.

| Свидетельство | Значение |
|---|---|
| Проверено исполнением | Указанная команда прошла на указанном исходном коде. |
| Статически проверено | Код или метаданные проверены без запуска продукта. |
| Изучено | Код, контракты или изображения просмотрены без исполняемого доказательства. |
| Ожидается | Не получено обязательное исполнение или ручное свидетельство. |
| Не прошло | Команда выполнена с неуспешным результатом. |

[Запись Google](validation/GOOGLE-INTEGRATIONS-2026-10-09.md) содержит пять сервисов, результаты работников и ограничения провайдера. [Ограничения зависимостей](validation/SUPPLY-CHAIN-2026-10-04.md) не снимаются успешной посторонней проверкой.

Текущие доказательства хранятся в датированных записях: [обзор продукта](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md), [масштаб](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md), [происхождение снимков](validation/SCREENSHOT-REFRESH-2026-10-08.md), [настройки](validation/WORKSPACE-SHORTCUTS-2026-10-08.md), [история](validation/HISTORICAL_VERIFICATION.md). Прежняя русская версия [сохраняет исторический текст с исправленными адресами ссылок](validation/localized-verification-history/VERIFICATION.ru.md). Исторические числа подтверждают происхождение, не текущую готовность. Активная документация требует локализации; архивы аудита с чувствительным происхождением исключены.

## Проверки репозитория

Работники запускают из корня:

```bash
pnpm check:source
pnpm check:governance
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:portal
pnpm check:renderer
pnpm check:export
pnpm check:headless
pnpm check:citations
pnpm check:knowledge
pnpm check:merge
```

`check:source` охватывает IPC, модули/процессы/unsafe Rust, нативную авторизацию, frontend, владельцев, benchmarks, доверие релизам и исключения RustSec. `check:governance` проверяет версии, неизменяемые Actions, границы пакетов, языки, документацию и лицензии.

## Полная инженерная проверка

Кандидату нужна чистая среда GitHub с инструментами из манифестов и замороженными lockfiles:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm check:contracts
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
pnpm audit --prod
```

`pnpm build` проверяет граф production-bundle и начальный gzip-бюджет; `pnpm lint` не допускает предупреждений ESLint. `check:release` требует PowerShell 7 (`pwsh`) на Linux/macOS. Axe нужен ChromeDriver, совместимый с Chrome; при отсутствии автоматического обнаружения `CHROMEWEBDRIVER` указывает каталог драйвера.

## Интерфейс и доступность

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

Ручная матрица: 320/375/768/1024/1440 CSS-пикселей, светлая/тёмная/контрастная темы, Windows/macOS/Linux, клавиатура, экранный диктор, масштаб текста 200 %, уменьшенная анимация, пустое состояние, загрузка, ошибка, успех, разрушительное подтверждение и длинное содержимое.

Меню Typography/Insert выводятся порталом за отсечение toolbar, остаются в viewport после resize/scroll и перемещаются ограниченными обновлениями DOM без цикла React. Клавиатурное открытие фокусирует первый пункт; работают стрелки, Home, End, Escape, Tab и внешний клик. Escape возвращает фокус кнопке.

Снимки ждут заголовка preview без `.preview-error`. Baseline применяются к стабильным поверхностям; состояния прикладываются к hosted-job. [Каталог](assets/screenshots/README.ru.md) разделяет свежие документальные снимки и сохранённые baseline.

## Релиз и восстановление

Все установщики собираются из точного проверенного тега. Архитектура работника до packaging должна совпасть: Windows x86_64, macOS aarch64, Linux x86_64/aarch64. В публикации ровно семь установщиков в `release-artifacts` и четыре записи `signing-evidence-<platform>-<architecture>.json` в `release-evidence`.

Официальные записи: `signed: false`, `notarized: false`, `signatureType: "none"`. Перед receipt выполняется `node scripts/release/verify-signing-evidence.mjs release-evidence production`. `SHA256SUMS` покрывает только семь установщиков; receipt schema 4 включает четыре нормализованные записи доверия. `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence` отклоняет изменение исходников, грязный checkout, лишние/отсутствующие файлы, опасные пути, symlinks, несовпадение checksum/SBOM и неполную идентичность целей.

Проверьте GitHub provenance, SBOM-аттестации и неизменяемую линию тега для каждого установщика. Release notes объясняют неизвестного издателя и отдельные команды checksum/аттестации. Зафиксируйте чистую установку и предупреждения ОС. Повреждённые backups должны отклоняться, восстановление работать на всех ОС, прерванные restore/MCP — восстанавливаться детерминированно. Нужны performance-gates сканирования, памяти, индекса, поиска, графа, редактора и экспорта.

## Инварианты и каноническая история

Ручной dispatch по умолчанию предварительный; публикация требует `publish: true` на существующем `v*`-теге. **Release Kickoff** проверяет успешную CI точного commit, требует точную `VERSION`, создаёт только новый неизменяемый тег и явно запускает Release. Изменение версии само не создаёт тег; конфликтующий тег — ошибка, его никогда не перемещают.

Автопубликация идёт после успешных сборок и quality-gates тега. Pages защищён средой `github-pages`. Update-manifest относится к неизменяемому релизу; rolling-тега и force-push нет. **Release** — единственный владелец публикации. Архитектура в именах предотвращает коллизии. Загрузка исключает распакованные внутренности и CI-доказательства; checksum установщиков и метаданные доверия проверяются отдельно.

Из полного канонического clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Также нужны разрешённый scanner секретов всей истории и hosted-свидетельства защиты веток, reviews, сред, тегов и релизов. Исходный контракт не доказывает публичный релиз. Завершение требует CI и **Visual review** точного текущего commit, затем production-tag workflow и опубликованные assets. Draft-PR откладывает тяжёлые gates; `ready_for_review` запускает полную матрицу.
