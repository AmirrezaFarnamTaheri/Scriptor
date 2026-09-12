# Участие в разработке

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md) · [简体中文](CONTRIBUTING.zh-CN.md) · **Русский** · [Deutsch](CONTRIBUTING.de.md) · [Español](CONTRIBUTING.es.md)

## Перед изменением кода

1. Прочитайте [`PRODUCT.ru.md`](PRODUCT.ru.md), [`DESIGN.ru.md`](DESIGN.ru.md), [`docs/ARCHITECTURE.ru.md`](docs/ARCHITECTURE.ru.md) и [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).
2. Инструкции по onboarding участников, карта каталогов и точки входа находятся в [`docs/ONBOARDING.ru.md`](docs/ONBOARDING.ru.md).
3. Для TypeScript packages прочитайте [`packages/README.md`](packages/README.md); импортируйте packages только через объявленные entry points.
4. Сохраняйте без изменений несвязанные staged, unstaged и untracked изменения.

## Toolchain

Локальные gates используют Node.js 22.12 или новее (в CI закреплена 22.16.0), pnpm 10.33.0, Rust 1.96.0 и PowerShell 7 (`pwsh`). Для браузерных проверок доступности также нужен ChromeDriver, соответствующий установленной версии Chrome; задайте `CHROMEWEBDRIVER`, если он не обнаруживается автоматически.

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

## Разработка

```powershell
pnpm web:dev
pnpm desktop:dev
```

## Процесс внесения изменений

- До исправления воспроизведите ошибку тестом, который падает.
- Делайте изменения мутаций, рефакторинга, обновлений зависимостей и сгенерированных файлов удобными для ревью. Если PR меняет major- или minor-версию зависимости, в том же commit проверьте call sites по закреплённым upstream release notes: переименованный модуль или метод (например, в `fs4` 1.x `fs_std::FileExt::lock_exclusive` был перенесён в `FileExt::lock`) не скомпилируется ни на одной платформе, и эта ошибка скроет все последующие gates.
- Запускайте внешние команды через `crates/system-bridge/src/process.rs`.
- Валидируйте runtime JSON начиная с `unknown`; не добавляйте непроверенные assertions на границах доверия.
- Для каждой новой native-команды добавляйте классификацию авторизации.
- Используйте ограниченные queues/collections/output для долгоживущих или управляемых пользователем данных.
- Сначала обновляйте source-of-truth файлы, затем регенерируйте производные контракты.
- Обновляйте документацию и capability ledger при изменении зрелости или поддержки.

## Обязательные проверки

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
pnpm lint
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
pnpm test:rust
```

`pnpm test:rust` повторяет Rust-gate в CI: исключает `scriptor-desktop` (его покрывает `desktop-check.yml`) и инкубируемые engines (`scriptor-embeddings`, `scriptor-tantivy-indexer`, `scriptor-wasm-runtime`) из продуктового прогона, а затем отдельно проверяет эти engines через `test:rust:engines`. `scriptor-citation-engine` остаётся в продуктовом тестовом графе, потому что его BibLaTeX parser является поддерживаемой зависимостью indexer; лишь поверхность citeproc/rendering этого crate остаётся инкубируемой.

Запускайте целевые валидаторы package и соответствующие suites Playwright для изменённого поведения. Изменения UI должны иметь доказательства работы клавиатуры, семантики screen reader, состояний loading/empty/error, узкого viewport и масштаба 200 %.

`pnpm check:release` — широкий release gate, а не самый быстрый локальный цикл обратной связи. Сначала используйте целевые проверки выше, затем запускайте полный gate на машине с установленными desktop/browser prerequisites.

Терминология доказательств и platform/release gates определены в [`docs/VERIFICATION.ru.md`](docs/VERIFICATION.ru.md). Никогда не называйте статическую проверку исходного кода результатом компиляции, упаковки, native- или browser-верификации.

## Pull requests

Опишите:

- изменённое наблюдаемое поведение;
- затронутые границы полномочий/данных;
- выполненные тесты и команды с результатами;
- поведение миграции/rollback;
- screenshots для видимых пользователю изменений;
- непроверенные платформы или остаточные риски.

Не коммитьте секреты, сгенерированные build-каталоги, debug-логи или персональные данные vault.

## Лицензирование

Если не указано иное, вклад лицензируется по **AGPL-3.0-or-later**. Отправляя вклад, вы подтверждаете право лицензировать его на этих условиях. Политику отдельной лицензии см. в [`COMMERCIAL-LICENSING.ru.md`](COMMERCIAL-LICENSING.ru.md).

## Безопасность

Сообщайте об уязвимостях приватно в соответствии с [`SECURITY.ru.md`](SECURITY.ru.md).
