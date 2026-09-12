[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · **Русский** · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

# Доказательства верификации

**Дата:** 2026-08-23 (локальные доказательства репозитория; это не утверждение, что каждый приведённый ниже command был повторно запущен в этой сессии)

Документ описывает хранящуюся в репозитории цепочку доказательств для hygiene, contracts, security, build, tests, packaging и release provenance. Записанные commands, filenames, identifiers, hashes и tool output сохраняются без перевода, поскольку это технические доказательства, а не продуктовый текст.

## 1. Локальная hygiene, discovery и проверка scope

До интерпретации результатов определяется, какой commit и какие источники являются авторитетными. Исключаются drift working tree, неожиданные generated files, устаревшие local artifacts и противоречащая реализации документация.

Типичные проверки репозитория:

```powershell
git status --short
git rev-parse HEAD
git ls-files
pnpm version:check
pnpm check:source
pnpm check:docs
pnpm check:i18n
```

Также проверяются `package.json`, `pnpm-lock.yaml`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, Tauri config, workflows в `.github/workflows/`, release scripts и документы архитектуры/зрелости. Источник истины — реализация точного commit; исторические планы и аудиты не заменяют проверку текущего состояния.

**Правило принятия:** evidence относится к release candidate только если привязана к тому же source commit или её provenance contract явно доказывает проверенную производность.

## 2. Security и dependency gate

Проверка охватывает Node/pnpm, Rust/Cargo, GitHub Actions и внешние tools. Repository-native gates проверяют pinning workflows, dependency policies, inventory запуска процессов и известные advisories.

```powershell
pnpm lint:actions
pnpm check:release-security
cargo deny check
cargo tree --workspace
```

RustSec exceptions не являются общей suppression-политикой. Единственная разрешённая поверхность — versioned ledger [`security/RUSTSEC-EXCEPTIONS.ru.md`](security/RUSTSEC-EXCEPTIONS.ru.md) с owner, reachability, review date и exit condition. Новая либо обновляемая vulnerability-class advisory остаётся release blocker.

Process boundary также входит в security gate: production-запуски внешних программ проходят через одобренную system bridge и сверяются с inventory. Secrets, network, filesystem, MCP mutations и plugin permissions валидируются fail-closed на своей native trust boundary.

## 3. Type, contract и boundary surface

Scriptor использует генерируемые Rust/TypeScript contracts и дополнительные source contracts, чтобы renderer, Tauri, daemon, CLI/TUI и MCP не расходились по payload незаметно.

```powershell
pnpm check:contracts
pnpm check:generated-contracts
pnpm lint:boundaries
pnpm check:source
pnpm check:frontend-quality
pnpm check:i18n
```

Command surface описана в [`contracts/COMMAND_CATALOG.ru.md`](contracts/COMMAND_CATALOG.ru.md). Boundary outcomes следуют [`contracts/BOUNDARY_OUTCOMES.ru.md`](contracts/BOUNDARY_OUTCOMES.ru.md): `value`, `absent-optional`, `invalid`, `degraded`, `failed` и `recovered` нельзя сводить к одному default value.

**Правило принятия:** каждый новый command, RPC, MCP tool или CLI entry point должен иметь owner, permission class, typed input/output, failure semantics, audit behavior и rollback/no-mutation contract.

## 4. Build и UI smoke

Frontend/desktop build проверяет совместимость TypeScript/React, Tauri host и bundled assets.

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
cargo check --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Desktop-specific release evidence требует выполнения Tauri build paths на поддерживаемых ОС. Зелёный web build сам по себе не доказывает desktop integration, native capabilities или корректное создание installer.

UI smoke минимум охватывает open vault, чтение/запись notes, readiness index/search, error/recovery states и основную navigation. E2E/screenshot modes не должны попадать в production bundles.

## 5. Test suites

Верификация сочетает быстрые source contracts, JavaScript/TypeScript tests, Rust tests, Playwright E2E, accessibility и visual regression. Ни один тип теста не заменяет остальные.

```powershell
pnpm test:source
pnpm test:rust
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm check:release
```

`pnpm check:release` — агрегированный release gate: он запускает contract runners, Rust checks, Playwright suites, accessibility audits, daemon/TUI smoke и performance gates, требуемые для кандидата.

### E2E и visual

Playwright использует раздельные configs/output dirs для функционального E2E и стабильной visual suite. Канонические docs screenshots — свежие captures текущего source; стабильные Windows snapshots — отдельная regression acceptance surface. См. [`assets/screenshots/README.ru.md`](assets/screenshots/README.ru.md) и [`VISUAL-REVIEW.ru.md`](VISUAL-REVIEW.ru.md).

Намеренные pixel changes проверяются и явно обновляются. Глобальная visual tolerance не повышается для сокрытия regression.

### Accessibility

Evidence сочетает автоматические axe checks и keyboard/focus contracts для modal surfaces, menus, Canvas/Graph, virtualized lists и security-state controls. Минимальная цель product surfaces — WCAG 2.2 AA; coarse-pointer targets не меньше 44×44 px.

### Performance

Benchmarks имеют versioned baselines и определённые thresholds. Gates выявляют regression запуска, indexing, search, graph, large vault и memory-heavy surfaces; они не предназначены для абсолютного сравнения произвольного hardware.

## 6. Packaging и installer verification

Release считается desktop release только после успешной упаковки всех платформ. Поддерживаемая matrix соответствует Windows, macOS и Linux, заявленным в README/release docs.

Packaging evidence проверяет:

- ожидаемые file types и architectures;
- равенство версии в `VERSION`, npm, Cargo и Tauri;
- отсутствие E2E/fault-injection markers в release bundle;
- installer/bundle names и checksums;
- отсутствие неожиданных symlink и absolute/traversal paths;
- воспроизводимую связь с release commit.

Entry points документированы в `scripts/release/`; release workflow создаёт platform artifacts и затем объединяет их в общей evidence stage.

## 7. Release evidence, SBOM и provenance

Pipeline создаёт финальные доказательства **после** скачивания всех platform artifacts. К авторитетным файлам относятся:

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

Verifier трактует receipt как точную allowlist. Missing artifact, лишний unreceipted artifact, duplicate checksum, symlink, absolute/traversal path, source-tree drift или SBOM metadata drift блокируют promotion. См. [`evidence/README.ru.md`](evidence/README.ru.md) и [`RELEASE-SECURITY.ru.md`](RELEASE-SECURITY.ru.md).

GitHub provenance attestations и записанная source identity создаются только после успешной локальной проверки evidence. Архив, созданный без канонического Git checkout, полезен для диагностики, но не принимается как production provenance.

## Визуальная верификация и документационные artifacts

Repository screenshots — документационные artifacts и сами по себе не доказывают release. Надёжная visual evidence фиксирует exact commit, OS/runner, browser/channel, viewport/device scale и результат соответствующей Playwright suite.

Галерея, capture rules и reviewer discipline описаны в [`assets/screenshots/README.ru.md`](assets/screenshots/README.ru.md) и [`VISUAL-REVIEW.ru.md`](VISUAL-REVIEW.ru.md).

## Известные ограничения repository evidence

- Документ фиксирует локальную evidence; дата выше не означает повторный запуск всех commands в каждой последующей сессии.
- Один зелёный job не заменяет commit-exact цепочку release gates.
- Local/historical CI logs нельзя приписывать другому commit.
- Platform-dependent packaging/signing/installer evidence должна возникать на соответствующей платформе или в предназначенном workflow.
- Наличие tests не превращает design-only/experimental capabilities в поддерживаемые production features. Ledger зрелости остаётся авторитетным.

## Интерпретация для release

Для production publication текущие gates должны быть зелёными на точном release commit, а созданные artifacts — доказуемо ссылаться на тот же commit. При конфликте исторической evidence с текущей реализацией приоритет имеют текущая воспроизводимая реализация и commit-bound verification.
