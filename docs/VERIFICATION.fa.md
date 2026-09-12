<div dir="ltr" align="center">

[English](VERIFICATION.md) · **فارسی** · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# شواهد راستی‌آزمایی

**تاریخ:** 2026-08-23 — شواهد محلی repository؛ این تاریخ به‌معنای آن نیست که همه commandهای زیر در این session دوباره اجرا شده‌اند.

این سند زنجیره evidence موجود در repository را برای hygiene، contractها، security، build، test، packaging و release provenance توضیح می‌دهد. commandها، filenameها، identifierها، hashها و output ثبت‌شده ابزارها عمداً ترجمه نمی‌شوند، چون evidence فنی هستند نه copy محصول.

## ۱. Hygiene محلی، Discovery و بازبینی Scope

پیش از تفسیر نتیجه test، ابتدا مشخص می‌شود کدام commit و کدام source مرجع واقعی‌اند. working-tree drift، فایل generated غیرمنتظره، artifact محلی قدیمی و مستنداتی که با implementation تناقض دارند باید کنار گذاشته شوند.

بررسی‌های رایج و native خود repository:

</div>

<div dir="ltr" align="left">

```powershell
git status --short
git rev-parse HEAD
git ls-files
pnpm version:check
pnpm check:source
pnpm check:docs
pnpm check:i18n
```

</div>

<div dir="rtl" lang="fa" align="right">

این مرحله همچنین `package.json`، `pnpm-lock.yaml`، `Cargo.toml`، `Cargo.lock`، `rust-toolchain.toml`، config مربوط به Tauri، workflowهای `.github/workflows/`، scriptهای release و مستندات architecture/maturity را بررسی می‌کند. implementation روی همان commit دقیق source of truth است؛ audit یا plan تاریخی جای بررسی state فعلی را نمی‌گیرد.

**قاعده پذیرش:** evidence فقط زمانی به release candidate نسبت داده می‌شود که به همان source commit متصل باشد یا provenance contract آن یک derivation صریحاً verifyشده را ثابت کند.

## ۲. Gate مربوط به Security و Dependency

بررسی dependency و security شامل Node/pnpm، Rust/Cargo، GitHub Actions و ابزارهای بیرونی است. gateهای native repository مواردی مانند workflow pinning، dependency policy، inventory مربوط به process launch و advisoryهای شناخته‌شده را بررسی می‌کنند.

</div>

<div dir="ltr" align="left">

```powershell
pnpm lint:actions
pnpm check:release-security
cargo deny check
cargo tree --workspace
```

</div>

<div dir="rtl" lang="fa" align="right">

exceptionهای RustSec suppression عمومی محسوب نمی‌شوند. تنها سطح exception مجاز، ledger versioned در [`security/RUSTSEC-EXCEPTIONS.fa.md`](security/RUSTSEC-EXCEPTIONS.fa.md) است که owner، reachability، تاریخ review و exit condition را ثبت می‌کند. vulnerability-class advisory جدید یا قابل upgrade همچنان release blocker است.

process boundary هم بخشی از security gate است: اجرای external process در production باید از system bridge تأییدشده عبور کند و با process inventory تطبیق داده شود. secrets، network، filesystem، mutationهای MCP و permissionهای plugin باید در native trust boundary خود به‌صورت fail-closed validate شوند.

## ۳. سطح Type، Contract و Boundary

Scriptor از contractهای generated میان Rust و TypeScript و contractهای اضافی source استفاده می‌کند تا renderer، Tauri، daemon، CLI/TUI و MCP در payload بی‌صدا از هم diverge نشوند.

</div>

<div dir="ltr" align="left">

```powershell
pnpm check:contracts
pnpm check:generated-contracts
pnpm lint:boundaries
pnpm check:source
pnpm check:frontend-quality
pnpm check:i18n
```

</div>

<div dir="rtl" lang="fa" align="right">

سطح command در [`contracts/COMMAND_CATALOG.fa.md`](contracts/COMMAND_CATALOG.fa.md) مستند شده است. outcomeهای boundary از [`contracts/BOUNDARY_OUTCOMES.fa.md`](contracts/BOUNDARY_OUTCOMES.fa.md) پیروی می‌کنند: `value`، `absent-optional`، `invalid`، `degraded`، `failed` و `recovered` نباید به یک default value واحد collapse شوند.

**قاعده پذیرش:** هر command، RPC، MCP tool یا CLI entry point جدید باید owner، permission class، input/output تایپ‌شده، failure semantics، audit behavior و قرارداد rollback یا no-mutation داشته باشد.

## ۴. Build و UI Smoke

build مربوط به frontend و desktop بررسی می‌کند که surfaceهای TypeScript/React، host مربوط به Tauri و bundled assetها با هم سازگار باشند.

</div>

<div dir="ltr" align="left">

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
cargo check --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

</div>

<div dir="rtl" lang="fa" align="right">

برای evidence مخصوص desktop، مسیرهای build مربوط به Tauri روی سیستم‌عامل‌های پشتیبانی‌شده اجرا می‌شوند. سبز بودن web build به‌تنهایی desktop integration، native capability یا تولید درست installer را ثابت نمی‌کند.

UI smoke حداقل باید بازکردن vault، read/write note، readiness مربوط به index/search، stateهای error/recovery و navigation اصلی را پوشش دهد. modeهای E2E و screenshot نباید وارد production bundle شوند.

## ۵. Test Suiteها

verification ترکیبی از source contractهای سریع، testهای JavaScript/TypeScript، testهای Rust، Playwright E2E، accessibility و visual regression است. هیچ‌کدام جای دیگری را نمی‌گیرد.

</div>

<div dir="ltr" align="left">

```powershell
pnpm test:source
pnpm test:rust
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm check:release
```

</div>

<div dir="rtl" lang="fa" align="right">

`pnpm check:release` release gate تجمیع‌شده است و contract runnerها، بررسی‌های Rust، suiteهای Playwright، auditهای accessibility، smokeهای daemon/TUI و performance gateهای لازم برای candidate را اجرا می‌کند.

### E2E و Visual

Playwright برای E2E functional و visual suite stable از config و output directory جداگانه استفاده می‌کند. screenshot canonical مستندات capture تازه source فعلی است؛ Windows snapshot stable یک سطح جداگانه برای پذیرش regression است. [`assets/screenshots/README.fa.md`](assets/screenshots/README.fa.md) و [`VISUAL-REVIEW.fa.md`](VISUAL-REVIEW.fa.md) را ببینید.

تغییر عمدی pixel باید review و صریحاً update شود. visual tolerance سراسری برای پنهان‌کردن regression افزایش داده نمی‌شود.

### Accessibility

evidence مربوط به accessibility، بررسی خودکار axe را با contractهای keyboard/focus برای modal، menu، Canvas/Graph، listهای virtualized و security-state control ترکیب می‌کند. حداقل هدف surface محصول WCAG 2.2 AA است و targetهای coarse-pointer حداقل 44×44 px می‌مانند.

### Performance

benchmarkها baseline versioned و threshold مشخص دارند. performance gate برای شناسایی regression در startup، indexing، search، graph، vault بزرگ و surfaceهای memory-heavy است؛ برای مقایسه مطلق hardware تصادفی طراحی نشده است.

## ۶. Packaging و راستی‌آزمایی Installer

release فقط پس از packaging موفق همه platformها یک desktop release محسوب می‌شود. matrix پشتیبانی همان Windows، macOS و Linux اعلام‌شده در README و release docs است.

Packaging evidence مخصوصاً این موارد را بررسی می‌کند:

- file type و architecture مورد انتظار؛
- برابری نسخه در `VERSION`، npm، Cargo و Tauri؛
- نبود marker مربوط به E2E/fault-injection در release bundle؛
- نام installer/bundle و checksumها؛
- نبود symbolic link غیرمنتظره یا absolute/traversal path؛
- association قابل بازتولید با release commit.

entry pointهای مرتبط زیر `scripts/release/` مستند شده‌اند؛ release workflow artifactهای platform را می‌سازد و بعد در یک evidence stage مشترک جمع می‌کند.

## ۷. Release Evidence، SBOM و Provenance

release pipeline شواهد نهایی را **پس از** دانلود همه artifactهای platform تولید می‌کند. فایل‌های مرجع شامل موارد زیر هستند:

</div>

<div dir="ltr" align="left">

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

</div>

<div dir="rtl" lang="fa" align="right">

verifier، receipt را allowlist دقیق می‌داند. artifact گمشده، artifact اضافی خارج از receipt، checksum تکراری، symbolic link، absolute/traversal path، source-tree drift یا SBOM metadata drift همگی promotion را متوقف می‌کنند. [`evidence/README.fa.md`](evidence/README.fa.md) و [`RELEASE-SECURITY.fa.md`](RELEASE-SECURITY.fa.md) را ببینید.

GitHub provenance attestation و source identity ثبت‌شده فقط پس از verify موفق evidence محلی تولید می‌شوند. archive محلی بدون Git checkout canonical برای diagnosis مفید است، اما production provenance قابل قبول نیست.

## راستی‌آزمایی بصری و Artifactهای مستندات

screenshotهای repository artifact مستندات هستند و به‌تنهایی release را ثابت نمی‌کنند. visual evidence معتبر باید exact commit، OS/runner، browser/channel، viewport یا device scale و نتیجه Playwright suite متناظر را ثبت کند.

قواعد gallery، capture و review در [`assets/screenshots/README.fa.md`](assets/screenshots/README.fa.md) و [`VISUAL-REVIEW.fa.md`](VISUAL-REVIEW.fa.md) مستند شده‌اند.

## محدودیت‌های شناخته‌شده Repository Evidence

- این سند repository-local evidence را ثبت می‌کند؛ تاریخ بالا به این معنا نیست که در هر session بعدی همه commandها دوباره اجرا شده‌اند.
- یک job سبز منفرد جای زنجیره release gate متصل به exact commit را نمی‌گیرد.
- CI log محلی یا تاریخی را نمی‌توان به commit دیگری نسبت داد.
- evidence وابسته به platform برای packaging، signing و installer باید روی همان platform پشتیبانی‌شده یا workflow مخصوص آن تولید شود.
- وجود test، capability آزمایشی یا design-only را خودکار به production feature پشتیبانی‌شده تبدیل نمی‌کند؛ maturity ledger همچنان مرجع است.

## تفسیر Release

برای production release، gateهای فعلی باید روی exact release commit سبز باشند و artifactهای تولیدشده باید به‌طور قابل اثبات همان commit را reference کنند. اگر evidence تاریخی با implementation فعلی تناقض داشته باشد، implementation قابل بازتولید فعلی به‌همراه commit-bound verification مرجع است.

</div>
