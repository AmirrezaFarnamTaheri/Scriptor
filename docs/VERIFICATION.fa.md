<div dir="ltr" align="center">

[English](VERIFICATION.md) · **فارسی** · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# شواهد راستی‌آزمایی

**تاریخ:** 2026-08-23 — شواهد محلی <bdi dir="ltr">repository</bdi>؛ این تاریخ به‌معنای آن نیست که همه <bdi dir="ltr">command</bdi>های زیر در این <bdi dir="ltr">session</bdi> دوباره اجرا شده‌اند.

این سند زنجیره <bdi dir="ltr">evidence</bdi> موجود در <bdi dir="ltr">repository</bdi> را برای <bdi dir="ltr">hygiene</bdi>، <bdi dir="ltr">contract</bdi>ها، <bdi dir="ltr">security</bdi>، <bdi dir="ltr">build</bdi>، <bdi dir="ltr">test</bdi>، <bdi dir="ltr">packaging</bdi> و <bdi dir="ltr">release provenance</bdi> توضیح می‌دهد. <bdi dir="ltr">command</bdi>ها، <bdi dir="ltr">filename</bdi>ها، <bdi dir="ltr">identifier</bdi>ها، <bdi dir="ltr">hash</bdi>ها و <bdi dir="ltr">output</bdi> ثبت‌شده ابزارها عمداً ترجمه نمی‌شوند، چون <bdi dir="ltr">evidence</bdi> فنی هستند نه <bdi dir="ltr">copy</bdi> محصول.

## ۱. <bdi dir="ltr">Hygiene</bdi> محلی، <bdi dir="ltr">Discovery</bdi> و بازبینی <bdi dir="ltr">Scope</bdi>

پیش از تفسیر نتیجه <bdi dir="ltr">test</bdi>، ابتدا مشخص می‌شود کدام <bdi dir="ltr">commit</bdi> و کدام <bdi dir="ltr">source</bdi> مرجع واقعی‌اند. <bdi dir="ltr">working-tree drift</bdi>، فایل <bdi dir="ltr">generated</bdi> غیرمنتظره، <bdi dir="ltr">artifact</bdi> محلی قدیمی و مستنداتی که با <bdi dir="ltr">implementation</bdi> تناقض دارند باید کنار گذاشته شوند.

بررسی‌های رایج و <bdi dir="ltr">native</bdi> خود <bdi dir="ltr">repository:</bdi>

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

این مرحله همچنین `package.json`، `pnpm-lock.yaml`، `Cargo.toml`، `Cargo.lock`، `rust-toolchain.toml`، <bdi dir="ltr">config</bdi> مربوط به <bdi dir="ltr">Tauri</bdi>، <bdi dir="ltr">workflow</bdi>های `.github/workflows/`، <bdi dir="ltr">script</bdi>های <bdi dir="ltr">release</bdi> و مستندات <bdi dir="ltr">architecture/maturity</bdi> را بررسی می‌کند. <bdi dir="ltr">implementation</bdi> روی همان <bdi dir="ltr">commit</bdi> دقیق <bdi dir="ltr">source of truth</bdi> است؛ <bdi dir="ltr">audit</bdi> یا <bdi dir="ltr">plan</bdi> تاریخی جای بررسی <bdi dir="ltr">state</bdi> فعلی را نمی‌گیرد.

**قاعده پذیرش:** <bdi dir="ltr">evidence</bdi> فقط زمانی به <bdi dir="ltr">release candidate</bdi> نسبت داده می‌شود که به همان <bdi dir="ltr">source commit</bdi> متصل باشد یا <bdi dir="ltr">provenance contract</bdi> آن یک <bdi dir="ltr">derivation</bdi> صریحاً <bdi dir="ltr">verify</bdi>شده را ثابت کند.

## ۲. <bdi dir="ltr">Gate</bdi> مربوط به <bdi dir="ltr">Security</bdi> و <bdi dir="ltr">Dependency</bdi>

بررسی <bdi dir="ltr">dependency</bdi> و <bdi dir="ltr">security</bdi> شامل <bdi dir="ltr">Node/pnpm</bdi>، <bdi dir="ltr">Rust/Cargo</bdi>، <bdi dir="ltr">GitHub Actions</bdi> و ابزارهای بیرونی است. <bdi dir="ltr">gate</bdi>های <bdi dir="ltr">native repository</bdi> مواردی مانند <bdi dir="ltr">workflow pinning</bdi>، <bdi dir="ltr">dependency policy</bdi>، <bdi dir="ltr">inventory</bdi> مربوط به <bdi dir="ltr">process launch</bdi> و <bdi dir="ltr">advisory</bdi>های شناخته‌شده را بررسی می‌کنند.

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

<bdi dir="ltr">exception</bdi>های <bdi dir="ltr">RustSec suppression</bdi> عمومی محسوب نمی‌شوند. تنها سطح <bdi dir="ltr">exception</bdi> مجاز، <bdi dir="ltr">ledger versioned</bdi> در [`security/RUSTSEC-EXCEPTIONS.fa.md`](security/RUSTSEC-EXCEPTIONS.fa.md) است که <bdi dir="ltr">owner</bdi>، <bdi dir="ltr">reachability</bdi>، تاریخ <bdi dir="ltr">review</bdi> و <bdi dir="ltr">exit condition</bdi> را ثبت می‌کند. <bdi dir="ltr">vulnerability-class advisory</bdi> جدید یا قابل <bdi dir="ltr">upgrade</bdi> همچنان <bdi dir="ltr">release blocker</bdi> است.

<bdi dir="ltr">process</bdi> <bdi dir="ltr">boundary</bdi> هم بخشی از <bdi dir="ltr">security gate</bdi> است: اجرای <bdi dir="ltr">external process</bdi> در <bdi dir="ltr">production</bdi> باید از <bdi dir="ltr">system bridge</bdi> تأییدشده عبور کند و با <bdi dir="ltr">process inventory</bdi> تطبیق داده شود. <bdi dir="ltr">secrets</bdi>، <bdi dir="ltr">network</bdi>، <bdi dir="ltr">filesystem</bdi>، <bdi dir="ltr">mutation</bdi>های <bdi dir="ltr">MCP</bdi> و <bdi dir="ltr">permission</bdi>های <bdi dir="ltr">plugin</bdi> باید در <bdi dir="ltr">native trust boundary</bdi> خود به‌صورت <bdi dir="ltr">fail-closed validate</bdi> شوند.

## ۳. سطح <bdi dir="ltr">Type</bdi>، <bdi dir="ltr">Contract</bdi> و <bdi dir="ltr">Boundary</bdi>

<bdi dir="ltr">Scriptor</bdi> از <bdi dir="ltr">contract</bdi>های <bdi dir="ltr">generated</bdi> میان <bdi dir="ltr">Rust</bdi> و <bdi dir="ltr">TypeScript</bdi> و <bdi dir="ltr">contract</bdi>های اضافی <bdi dir="ltr">source</bdi> استفاده می‌کند تا <bdi dir="ltr">renderer</bdi>، <bdi dir="ltr">Tauri</bdi>، <bdi dir="ltr">daemon</bdi>، <bdi dir="ltr">CLI/TUI</bdi> و <bdi dir="ltr">MCP</bdi> در <bdi dir="ltr">payload</bdi> بی‌صدا از هم <bdi dir="ltr">diverge</bdi> نشوند.

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

سطح <bdi dir="ltr">command</bdi> در [`contracts/COMMAND_CATALOG.fa.md`](contracts/COMMAND_CATALOG.fa.md) مستند شده است. <bdi dir="ltr">outcome</bdi>های <bdi dir="ltr">boundary</bdi> از [`contracts/BOUNDARY_OUTCOMES.fa.md`](contracts/BOUNDARY_OUTCOMES.fa.md) پیروی می‌کنند: `value`، `absent-optional`، `invalid`، `degraded`، `failed` و `recovered` نباید به یک <bdi dir="ltr">default value</bdi> واحد <bdi dir="ltr">collapse</bdi> شوند.

**قاعده پذیرش:** هر <bdi dir="ltr">command</bdi>، <bdi dir="ltr">RPC</bdi>، <bdi dir="ltr">MCP tool</bdi> یا <bdi dir="ltr">CLI entry point</bdi> جدید باید <bdi dir="ltr">owner</bdi>، <bdi dir="ltr">permission class</bdi>، <bdi dir="ltr">input/output</bdi> تایپ‌شده، <bdi dir="ltr">failure semantics</bdi>، <bdi dir="ltr">audit behavior</bdi> و قرارداد <bdi dir="ltr">rollback</bdi> یا <bdi dir="ltr">no-mutation</bdi> داشته باشد.

## ۴. <bdi dir="ltr">Build</bdi> و <bdi dir="ltr">UI Smoke</bdi>

<bdi dir="ltr">build</bdi> مربوط به <bdi dir="ltr">frontend</bdi> و <bdi dir="ltr">desktop</bdi> بررسی می‌کند که <bdi dir="ltr">surface</bdi>های <bdi dir="ltr">TypeScript/React</bdi>، <bdi dir="ltr">host</bdi> مربوط به <bdi dir="ltr">Tauri</bdi> و <bdi dir="ltr">bundled asset</bdi>ها با هم سازگار باشند.

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

برای <bdi dir="ltr">evidence</bdi> مخصوص <bdi dir="ltr">desktop</bdi>، مسیرهای <bdi dir="ltr">build</bdi> مربوط به <bdi dir="ltr">Tauri</bdi> روی سیستم‌عامل‌های پشتیبانی‌شده اجرا می‌شوند. سبز بودن <bdi dir="ltr">web build</bdi> به‌تنهایی <bdi dir="ltr">desktop integration</bdi>، <bdi dir="ltr">native capability</bdi> یا تولید درست <bdi dir="ltr">installer</bdi> را ثابت نمی‌کند.

<bdi dir="ltr">UI</bdi> <bdi dir="ltr">smoke</bdi> حداقل باید بازکردن <bdi dir="ltr">vault</bdi>، <bdi dir="ltr">read/write note</bdi>، <bdi dir="ltr">readiness</bdi> مربوط به <bdi dir="ltr">index/search</bdi>، <bdi dir="ltr">state</bdi>های <bdi dir="ltr">error/recovery</bdi> و <bdi dir="ltr">navigation</bdi> اصلی را پوشش دهد. <bdi dir="ltr">mode</bdi>های <bdi dir="ltr">E2E</bdi> و <bdi dir="ltr">screenshot</bdi> نباید وارد <bdi dir="ltr">production bundle</bdi> شوند.

## ۵. <bdi dir="ltr">Test Suite</bdi>ها

<bdi dir="ltr">verification</bdi> ترکیبی از <bdi dir="ltr">source contract</bdi>های سریع، <bdi dir="ltr">test</bdi>های <bdi dir="ltr">JavaScript/TypeScript</bdi>، <bdi dir="ltr">test</bdi>های <bdi dir="ltr">Rust</bdi>، <bdi dir="ltr">Playwright E2E</bdi>، <bdi dir="ltr">accessibility</bdi> و <bdi dir="ltr">visual regression</bdi> است. هیچ‌کدام جای دیگری را نمی‌گیرد.

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

`pnpm check:release` <bdi dir="ltr">release gate</bdi> تجمیع‌شده است و <bdi dir="ltr">contract runner</bdi>ها، بررسی‌های <bdi dir="ltr">Rust</bdi>، <bdi dir="ltr">suite</bdi>های <bdi dir="ltr">Playwright</bdi>، <bdi dir="ltr">audit</bdi>های <bdi dir="ltr">accessibility</bdi>، <bdi dir="ltr">smoke</bdi>های <bdi dir="ltr">daemon/TUI</bdi> و <bdi dir="ltr">performance gate</bdi>های لازم برای <bdi dir="ltr">candidate</bdi> را اجرا می‌کند.

### <bdi dir="ltr">E2E</bdi> و <bdi dir="ltr">Visual</bdi>

<bdi dir="ltr">Playwright</bdi> برای <bdi dir="ltr">E2E functional</bdi> و <bdi dir="ltr">visual suite stable</bdi> از <bdi dir="ltr">config</bdi> و <bdi dir="ltr">output directory</bdi> جداگانه استفاده می‌کند. <bdi dir="ltr">screenshot canonical</bdi> مستندات <bdi dir="ltr">capture</bdi> تازه <bdi dir="ltr">source</bdi> فعلی است؛ <bdi dir="ltr">Windows snapshot stable</bdi> یک سطح جداگانه برای پذیرش <bdi dir="ltr">regression</bdi> است. [`assets/screenshots/README.fa.md`](assets/screenshots/README.fa.md) و [`VISUAL-REVIEW.fa.md`](VISUAL-REVIEW.fa.md) را ببینید.

تغییر عمدی <bdi dir="ltr">pixel</bdi> باید <bdi dir="ltr">review</bdi> و صریحاً <bdi dir="ltr">update</bdi> شود. <bdi dir="ltr">visual tolerance</bdi> سراسری برای پنهان‌کردن <bdi dir="ltr">regression</bdi> افزایش داده نمی‌شود.

### <bdi dir="ltr">Accessibility</bdi>

<bdi dir="ltr">evidence</bdi> مربوط به <bdi dir="ltr">accessibility</bdi>، بررسی خودکار <bdi dir="ltr">axe</bdi> را با <bdi dir="ltr">contract</bdi>های <bdi dir="ltr">keyboard/focus</bdi> برای <bdi dir="ltr">modal</bdi>، <bdi dir="ltr">menu</bdi>، <bdi dir="ltr">Canvas/Graph</bdi>، <bdi dir="ltr">list</bdi>های <bdi dir="ltr">virtualized</bdi> و <bdi dir="ltr">security-state control</bdi> ترکیب می‌کند. حداقل هدف <bdi dir="ltr">surface</bdi> محصول <bdi dir="ltr">WCAG</bdi> 2.2 <bdi dir="ltr">AA</bdi> است و <bdi dir="ltr">target</bdi>های <bdi dir="ltr">coarse-pointer</bdi> حداقل 44×44 <bdi dir="ltr">px</bdi> می‌مانند.

### <bdi dir="ltr">Performance</bdi>

<bdi dir="ltr">benchmark</bdi>ها <bdi dir="ltr">baseline versioned</bdi> و <bdi dir="ltr">threshold</bdi> مشخص دارند. <bdi dir="ltr">performance gate</bdi> برای شناسایی <bdi dir="ltr">regression</bdi> در <bdi dir="ltr">startup</bdi>، <bdi dir="ltr">indexing</bdi>، <bdi dir="ltr">search</bdi>، <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">vault</bdi> بزرگ و <bdi dir="ltr">surface</bdi>های <bdi dir="ltr">memory-heavy</bdi> است؛ برای مقایسه مطلق <bdi dir="ltr">hardware</bdi> تصادفی طراحی نشده است.

## ۶. <bdi dir="ltr">Packaging</bdi> و راستی‌آزمایی <bdi dir="ltr">Installer</bdi>

<bdi dir="ltr">release</bdi> فقط پس از <bdi dir="ltr">packaging</bdi> موفق همه <bdi dir="ltr">platform</bdi>ها یک <bdi dir="ltr">desktop release</bdi> محسوب می‌شود. <bdi dir="ltr">matrix</bdi> پشتیبانی همان <bdi dir="ltr">Windows</bdi>، <bdi dir="ltr">macOS</bdi> و <bdi dir="ltr">Linux</bdi> اعلام‌شده در <bdi dir="ltr">README</bdi> و <bdi dir="ltr">release docs</bdi> است.

<bdi dir="ltr">Packaging</bdi> <bdi dir="ltr">evidence</bdi> مخصوصاً این موارد را بررسی می‌کند:

- <bdi dir="ltr">file</bdi> <bdi dir="ltr">type</bdi> و <bdi dir="ltr">architecture</bdi> مورد انتظار؛
- برابری نسخه در `VERSION`، <bdi dir="ltr">npm</bdi>، <bdi dir="ltr">Cargo</bdi> و <bdi dir="ltr">Tauri</bdi>؛
- نبود <bdi dir="ltr">marker</bdi> مربوط به <bdi dir="ltr">E2E/fault-injection</bdi> در <bdi dir="ltr">release bundle</bdi>؛
- نام <bdi dir="ltr">installer/bundle</bdi> و <bdi dir="ltr">checksum</bdi>ها؛
- نبود <bdi dir="ltr">symbolic link</bdi> غیرمنتظره یا <bdi dir="ltr">absolute/traversal path</bdi>؛
- <bdi dir="ltr">association</bdi> قابل بازتولید با <bdi dir="ltr">release commit.</bdi>

<bdi dir="ltr">entry</bdi> <bdi dir="ltr">point</bdi>های مرتبط زیر `scripts/release/` مستند شده‌اند؛ <bdi dir="ltr">release workflow artifact</bdi>های <bdi dir="ltr">platform</bdi> را می‌سازد و بعد در یک <bdi dir="ltr">evidence stage</bdi> مشترک جمع می‌کند.

## ۷. <bdi dir="ltr">Release Evidence</bdi>، <bdi dir="ltr">SBOM</bdi> و <bdi dir="ltr">Provenance</bdi>

<bdi dir="ltr">release</bdi> <bdi dir="ltr">pipeline</bdi> شواهد نهایی را **پس از** دانلود همه <bdi dir="ltr">artifact</bdi>های <bdi dir="ltr">platform</bdi> تولید می‌کند. فایل‌های مرجع شامل موارد زیر هستند:

</div>

<div dir="ltr" align="left">

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">verifier</bdi>، <bdi dir="ltr">receipt</bdi> را <bdi dir="ltr">allowlist</bdi> دقیق می‌داند. <bdi dir="ltr">artifact</bdi> گمشده، <bdi dir="ltr">artifact</bdi> اضافی خارج از <bdi dir="ltr">receipt</bdi>، <bdi dir="ltr">checksum</bdi> تکراری، <bdi dir="ltr">symbolic link</bdi>، <bdi dir="ltr">absolute/traversal path</bdi>، <bdi dir="ltr">source-tree drift</bdi> یا <bdi dir="ltr">SBOM metadata drift</bdi> همگی <bdi dir="ltr">promotion</bdi> را متوقف می‌کنند. [`evidence/README.fa.md`](evidence/README.fa.md) و [`RELEASE-SECURITY.fa.md`](RELEASE-SECURITY.fa.md) را ببینید.

<bdi dir="ltr">GitHub</bdi> <bdi dir="ltr">provenance attestation</bdi> و <bdi dir="ltr">source identity</bdi> ثبت‌شده فقط پس از <bdi dir="ltr">verify</bdi> موفق <bdi dir="ltr">evidence</bdi> محلی تولید می‌شوند. <bdi dir="ltr">archive</bdi> محلی بدون <bdi dir="ltr">Git checkout canonical</bdi> برای <bdi dir="ltr">diagnosis</bdi> مفید است، اما <bdi dir="ltr">production provenance</bdi> قابل قبول نیست.

## راستی‌آزمایی بصری و <bdi dir="ltr">Artifact</bdi>های مستندات

<bdi dir="ltr">screenshot</bdi>های <bdi dir="ltr">repository artifact</bdi> مستندات هستند و به‌تنهایی <bdi dir="ltr">release</bdi> را ثابت نمی‌کنند. <bdi dir="ltr">visual evidence</bdi> معتبر باید <bdi dir="ltr">exact commit</bdi>، <bdi dir="ltr">OS/runner</bdi>، <bdi dir="ltr">browser/channel</bdi>، <bdi dir="ltr">viewport</bdi> یا <bdi dir="ltr">device scale</bdi> و نتیجه <bdi dir="ltr">Playwright suite</bdi> متناظر را ثبت کند.

قواعد <bdi dir="ltr">gallery</bdi>، <bdi dir="ltr">capture</bdi> و <bdi dir="ltr">review</bdi> در [`assets/screenshots/README.fa.md`](assets/screenshots/README.fa.md) و [`VISUAL-REVIEW.fa.md`](VISUAL-REVIEW.fa.md) مستند شده‌اند.

## محدودیت‌های شناخته‌شده <bdi dir="ltr">Repository Evidence</bdi>

- این سند <bdi dir="ltr">repository-local evidence</bdi> را ثبت می‌کند؛ تاریخ بالا به این معنا نیست که در هر <bdi dir="ltr">session</bdi> بعدی همه <bdi dir="ltr">command</bdi>ها دوباره اجرا شده‌اند.
- یک <bdi dir="ltr">job</bdi> سبز منفرد جای زنجیره <bdi dir="ltr">release gate</bdi> متصل به <bdi dir="ltr">exact commit</bdi> را نمی‌گیرد.
- <bdi dir="ltr">CI</bdi> <bdi dir="ltr">log</bdi> محلی یا تاریخی را نمی‌توان به <bdi dir="ltr">commit</bdi> دیگری نسبت داد.
- <bdi dir="ltr">evidence</bdi> وابسته به <bdi dir="ltr">platform</bdi> برای <bdi dir="ltr">packaging</bdi>، <bdi dir="ltr">signing</bdi> و <bdi dir="ltr">installer</bdi> باید روی همان <bdi dir="ltr">platform</bdi> پشتیبانی‌شده یا <bdi dir="ltr">workflow</bdi> مخصوص آن تولید شود.
- وجود <bdi dir="ltr">test</bdi>، <bdi dir="ltr">capability</bdi> آزمایشی یا <bdi dir="ltr">design-only</bdi> را خودکار به <bdi dir="ltr">production feature</bdi> پشتیبانی‌شده تبدیل نمی‌کند؛ <bdi dir="ltr">maturity ledger</bdi> همچنان مرجع است.

## تفسیر <bdi dir="ltr">Release</bdi>

برای <bdi dir="ltr">production release</bdi>، <bdi dir="ltr">gate</bdi>های فعلی باید روی <bdi dir="ltr">exact release commit</bdi> سبز باشند و <bdi dir="ltr">artifact</bdi>های تولیدشده باید به‌طور قابل اثبات همان <bdi dir="ltr">commit</bdi> را <bdi dir="ltr">reference</bdi> کنند. اگر <bdi dir="ltr">evidence</bdi> تاریخی با <bdi dir="ltr">implementation</bdi> فعلی تناقض داشته باشد، <bdi dir="ltr">implementation</bdi> قابل بازتولید فعلی به‌همراه <bdi dir="ltr">commit-bound verification</bdi> مرجع است.

</div>
