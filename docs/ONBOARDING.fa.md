<div dir="ltr" align="center">

[English](ONBOARDING.md) · **فارسی** · [简体中文](ONBOARDING.zh-CN.md) · [Русский](ONBOARDING.ru.md) · [Deutsch](ONBOARDING.de.md) · [Español](ONBOARDING.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای شروع برای مشارکت‌کنندگان <bdi dir="ltr">Scriptor</bdi>

> **مخاطب:** مشارکت‌کنندگان تازه‌وارد، <bdi dir="ltr">maintainer</bdi>ها و ممیزان کد. کاربران جدید بهتر است از [`README.fa.md`](../README.fa.md) و [`docs/guides/GETTING_STARTED.fa.md`](guides/GETTING_STARTED.fa.md) شروع کنند.
>
> برای قواعد <bdi dir="ltr">agent</bdi> ابتدا [`AGENTS.md`](../AGENTS.md) را بخوانید. <bdi dir="ltr">workflow</bdi> مشارکت، <bdi dir="ltr">PR</bdi>ها و بررسی‌های اجباری در [`CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md) توضیح داده شده‌اند.

## پشته فناوری

| لایه | فناوری | مرجع اصلی |
|---|---|---|
| **پوسته دسکتاپ** | <bdi dir="ltr">Tauri</bdi> 2 (<bdi dir="ltr">Rust</bdi>) | `apps/desktop/src-tauri/` |
| **موتورهای هسته** | <bdi dir="ltr">crate</bdi>های <bdi dir="ltr">workspace</bdi> در <bdi dir="ltr">Rust</bdi> (1.96.0، <bdi dir="ltr">Edition</bdi> 2024) | `crates/`, `rust-toolchain.toml` |
| **فرانت‌اند** | <bdi dir="ltr">React</bdi> 19، <bdi dir="ltr">Vite</bdi> 8، <bdi dir="ltr">TypeScript</bdi> 6، <bdi dir="ltr">Lucide React</bdi> | `package.json` |
| **مدیر بسته** | <bdi dir="ltr">pnpm</bdi> 10.33.0 | `package.json` (`packageManager`) |
| **استایل‌دهی** | <bdi dir="ltr">OKLCH</bdi> معنایی + <bdi dir="ltr">CSS custom properties</bdi>؛ بدون <bdi dir="ltr">Tailwind</bdi> و فونت <bdi dir="ltr">remote</bdi> | `src/index.css`, `src/styles/` |
| **پروتکل <bdi dir="ltr">IPC</bdi>** | <bdi dir="ltr">Rust</bdi> `ts-rs` → قراردادهای <bdi dir="ltr">TypeScript</bdi> | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **آزمون** | <bdi dir="ltr">Cargo test</bdi>، <bdi dir="ltr">Playwright E2E</bdi> + <bdi dir="ltr">visual</bdi>، <bdi dir="ltr">axe-core a11y</bdi> | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

فرمان‌های نصب در بخش **<bdi dir="ltr">Build from source</bdi>** فایل [`README.fa.md`](../README.fa.md) آمده‌اند. فهرست کامل بررسی‌های اجباری در [`CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md) است.

> <bdi dir="ltr">gate</bdi>های سریع محلی: `pnpm test:source` برای <bdi dir="ltr">contract</bdi> و <bdi dir="ltr">governance</bdi>، `pnpm check:changelog` برای <bdi dir="ltr">guard</bdi> یادداشت انتشار، `pnpm test:rust` برای <bdi dir="ltr">gate</bdi> هماهنگ با <bdi dir="ltr">CI</bdi> در <bdi dir="ltr">Rust</bdi> (بدون <bdi dir="ltr">scriptor-desktop</bdi> و موتورهای در حال <bdi dir="ltr">incubation</bdi>)، و `pnpm check:i18n` برای برابری <bdi dir="ltr">locale</bdi>ها.

## معماری در یک نگاه

توپولوژی <bdi dir="ltr">runtime</bdi>، مرزهای اعتماد و مالکیت <bdi dir="ltr">crate</bdi>ها در [`docs/ARCHITECTURE.fa.md`](ARCHITECTURE.fa.md) مستند شده‌اند. نمای کلی:

</div>

<div dir="ltr" align="left">

```
React renderer
  → typed bridge commands
  → Tauri command adapters
  → authorization broker
  → application/kernel crates (vault, indexer, native-git, export-runner, canvas-engine)
  → filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  → daemon IPC (scriptor-ipc envelopes)
  → daemon handlers and shared kernel crates
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">renderer</bdi> مرز اختیار نیست. عملیات <bdi dir="ltr">native</bdi> مستقل از وضعیت <bdi dir="ltr">UI</bdi>، <bdi dir="ltr">scope</bdi>، <bdi dir="ltr">authorization</bdi>، <bdi dir="ltr">payload</bdi>های <bdi dir="ltr">runtime</bdi>، <bdi dir="ltr">path</bdi>ها، <bdi dir="ltr">policy</bdi> اجرای <bdi dir="ltr">process</bdi> و <bdi dir="ltr">cancellation</bdi> را اعتبارسنجی می‌کنند.

## نقاط ورود کلیدی

| مؤلفه | نقطه ورود |
|---|---|
| پوسته دسکتاپ | `apps/desktop/src-tauri/src/lib.rs` |
| <bdi dir="ltr">React SPA</bdi> | `src/App.tsx`, `src/main.tsx` |
| هسته <bdi dir="ltr">vault</bdi> | `crates/vault/src/lib.rs` |
| <bdi dir="ltr">Indexer</bdi> / <bdi dir="ltr">search</bdi> / <bdi dir="ltr">graph</bdi> | `crates/indexer/src/lib.rs` |
| تعریف پروتکل <bdi dir="ltr">IPC</bdi> | `crates/ipc/src/lib.rs` |
| <bdi dir="ltr">Daemon IPC</bdi> | `crates/daemon/src/lib.rs` |
| <bdi dir="ltr">sandbox</bdi> اجرای <bdi dir="ltr">process</bdi> | `crates/system-bridge/src/process.rs` |
| <bdi dir="ltr">Design tokens</bdi> و <bdi dir="ltr">theme</bdi> | `src/index.css`, `src/styles/` |
| قرارداد <bdi dir="ltr">design</bdi> | [`DESIGN.fa.md`](../DESIGN.fa.md) |

## نقشه دایرکتوری‌ها

</div>

<div dir="ltr" align="left">

```
apps/desktop/         → Tauri 2 desktop shell application
crates/               → Rust workspace engines (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → TypeScript monorepo packages (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → Main React workspace SPA, UI components, custom hooks, styles
scripts/validation/   → Automated contract, governance, a11y, and source verification scripts
scripts/benchmarks/   → Latency, memory, and throughput performance benchmark scripts
docs/                 → Architectural specifications, capability maturity ledger, verification docs
e2e/                  → Playwright E2E and visual regression specifications
```

</div>

<div dir="rtl" lang="fa" align="right">

## قراردادها و حداقل کیفیت

فهرست کامل قراردادهای مشارکت در [`CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md) و [`AGENTS.md`](../AGENTS.md) است. موارد غیرقابل‌چشم‌پوشی:

- **<bdi dir="ltr">Local-first</bdi> و <bdi dir="ltr">Markdown-native</bdi>** — فایل‌های <bdi dir="ltr">Markdown</bdi> روی دیسک مرجع اصلی‌اند.
- **قراردادهای <bdi dir="ltr">IPC</bdi>** — هر فرمان <bdi dir="ltr">IPC</bdi> در <bdi dir="ltr">Rust</bdi> به <bdi dir="ltr">interface</bdi> متناظر <bdi dir="ltr">TypeScript</bdi> نگاشت می‌شود؛ <bdi dir="ltr">JSON</bdi> زمان اجرا که از `unknown` می‌آید پیش از استفاده اعتبارسنجی می‌شود.
- **<bdi dir="ltr">Process sandbox</bdi>** — اجرای <bdi dir="ltr">process</bdi> خارجی باید از `crates/system-bridge/src/process.rs` عبور کند و با `process-launch-inventory.json` اعتبارسنجی شود.
- **<bdi dir="ltr">UI</bdi> و <bdi dir="ltr">anti-slop</bdi>** — از [`DESIGN.fa.md`](../DESIGN.fa.md) پیروی کنید: بدون <bdi dir="ltr">gradient</bdi>های بنفش/<bdi dir="ltr">indigo</bdi> سبک <bdi dir="ltr">AI</bdi>، فقط فونت‌های سیستم، حداقل <bdi dir="ltr">WCAG</bdi> 2.2 <bdi dir="ltr">AA</bdi> و <bdi dir="ltr">touch target</bdi> با اندازه حداقل 44×44 <bdi dir="ltr">px.</bdi>
- **ایمنی <bdi dir="ltr">Rust</bdi>** — کد <bdi dir="ltr">production</bdi> از `.unwrap()` پرهیز می‌کند؛ `thiserror` در <bdi dir="ltr">library</bdi> و `anyhow` در <bdi dir="ltr">binary</bdi>؛ هر بلوک `unsafe` دارای توضیح صریح `// SAFETY:` است.

## برای هر کار کجا برویم

| کار | محل |
|---|---|
| منطق فایل <bdi dir="ltr">vault</bdi> | `crates/vault/src/` |
| <bdi dir="ltr">Indexer</bdi> یا <bdi dir="ltr">graph search</bdi> | `crates/indexer/src/` |
| متدهای <bdi dir="ltr">IPC</bdi> | `crates/ipc/src/` و `tsconfig.contracts.json` |
| مؤلفه <bdi dir="ltr">editor</bdi> | `packages/editor/src/` |
| <bdi dir="ltr">Canvas workspace</bdi> | `packages/canvas/src/` و `crates/canvas-engine/` |
| <bdi dir="ltr">Theme</bdi> یا <bdi dir="ltr">styling</bdi> | `src/index.css` و `src/styles/` |
| آزمون <bdi dir="ltr">E2E</bdi> / <bdi dir="ltr">visual</bdi> | `e2e/` و `playwright.e2e.config.ts` |
| <bdi dir="ltr">benchmark</bdi> عملکرد | `scripts/benchmarks/` و `perf-baselines.json` |

</div>
