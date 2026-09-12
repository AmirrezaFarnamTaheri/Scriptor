<div dir="ltr" align="center">

[English](ONBOARDING.md) · **فارسی** · [简体中文](ONBOARDING.zh-CN.md) · [Русский](ONBOARDING.ru.md) · [Deutsch](ONBOARDING.de.md) · [Español](ONBOARDING.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای شروع برای مشارکت‌کنندگان Scriptor

> **مخاطب:** مشارکت‌کنندگان تازه‌وارد، maintainerها و ممیزان کد. کاربران جدید بهتر است از [`README.fa.md`](../README.fa.md) و [`docs/guides/GETTING_STARTED.fa.md`](guides/GETTING_STARTED.fa.md) شروع کنند.
>
> برای قواعد agent ابتدا [`AGENTS.md`](../AGENTS.md) را بخوانید. workflow مشارکت، PRها و بررسی‌های اجباری در [`CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md) توضیح داده شده‌اند.

## پشته فناوری

| لایه | فناوری | مرجع اصلی |
|---|---|---|
| **پوسته دسکتاپ** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **موتورهای هسته** | crateهای workspace در Rust (1.96.0، Edition 2024) | `crates/`, `rust-toolchain.toml` |
| **فرانت‌اند** | React 19، Vite 8، TypeScript 6، Lucide React | `package.json` |
| **مدیر بسته** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **استایل‌دهی** | OKLCH معنایی + CSS custom properties؛ بدون Tailwind و فونت remote | `src/index.css`, `src/styles/` |
| **پروتکل IPC** | Rust `ts-rs` → قراردادهای TypeScript | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **آزمون** | Cargo test، Playwright E2E + visual، axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

فرمان‌های نصب در بخش **Build from source** فایل [`README.fa.md`](../README.fa.md) آمده‌اند. فهرست کامل بررسی‌های اجباری در [`CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md) است.

> gateهای سریع محلی: `pnpm test:source` برای contract و governance، `pnpm check:changelog` برای guard یادداشت انتشار، `pnpm test:rust` برای gate هماهنگ با CI در Rust (بدون scriptor-desktop و موتورهای در حال incubation)، و `pnpm check:i18n` برای برابری localeها.

## معماری در یک نگاه

توپولوژی runtime، مرزهای اعتماد و مالکیت crateها در [`docs/ARCHITECTURE.fa.md`](ARCHITECTURE.fa.md) مستند شده‌اند. نمای کلی:

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

renderer مرز اختیار نیست. عملیات native مستقل از وضعیت UI، scope، authorization، payloadهای runtime، pathها، policy اجرای process و cancellation را اعتبارسنجی می‌کنند.

## نقاط ورود کلیدی

| مؤلفه | نقطه ورود |
|---|---|
| پوسته دسکتاپ | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| هسته vault | `crates/vault/src/lib.rs` |
| Indexer / search / graph | `crates/indexer/src/lib.rs` |
| تعریف پروتکل IPC | `crates/ipc/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs` |
| sandbox اجرای process | `crates/system-bridge/src/process.rs` |
| Design tokens و theme | `src/index.css`, `src/styles/` |
| قرارداد design | [`DESIGN.fa.md`](../DESIGN.fa.md) |

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

- **Local-first و Markdown-native** — فایل‌های Markdown روی دیسک مرجع اصلی‌اند.
- **قراردادهای IPC** — هر فرمان IPC در Rust به interface متناظر TypeScript نگاشت می‌شود؛ JSON زمان اجرا که از `unknown` می‌آید پیش از استفاده اعتبارسنجی می‌شود.
- **Process sandbox** — اجرای process خارجی باید از `crates/system-bridge/src/process.rs` عبور کند و با `process-launch-inventory.json` اعتبارسنجی شود.
- **UI و anti-slop** — از [`DESIGN.fa.md`](../DESIGN.fa.md) پیروی کنید: بدون gradientهای بنفش/indigo سبک AI، فقط فونت‌های سیستم، حداقل WCAG 2.2 AA و touch target با اندازه حداقل 44×44 px.
- **ایمنی Rust** — کد production از `.unwrap()` پرهیز می‌کند؛ `thiserror` در library و `anyhow` در binary؛ هر بلوک `unsafe` دارای توضیح صریح `// SAFETY:` است.

## برای هر کار کجا برویم

| کار | محل |
|---|---|
| منطق فایل vault | `crates/vault/src/` |
| Indexer یا graph search | `crates/indexer/src/` |
| متدهای IPC | `crates/ipc/src/` و `tsconfig.contracts.json` |
| مؤلفه editor | `packages/editor/src/` |
| Canvas workspace | `packages/canvas/src/` و `crates/canvas-engine/` |
| Theme یا styling | `src/index.css` و `src/styles/` |
| آزمون E2E / visual | `e2e/` و `playwright.e2e.config.ts` |
| benchmark عملکرد | `scripts/benchmarks/` و `perf-baselines.json` |

</div>
