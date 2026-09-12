<div align="center">

# Scriptor

**فضای کاری محلی‌محور برای نوشتن حرفه‌ای و پژوهش با Markdown.**

[English](README.md) · **فارسی**

[![Version](https://img.shields.io/badge/version-1.0.8-0f766e.svg)](VERSION)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#download)
[![Stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#tech-stack)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

یادداشت‌های شما همان فایل‌های معمولی Markdown باقی می‌مانند. Scriptor روی این فایل‌ها ویرایش، پیوندهای بازگشتی، ارجاع‌دهی، تاریخچه نسخه‌ها، انتشار و خودکارسازی با مجوزهای صریح را اضافه می‌کند.

[دریافت](#download) · [شروع کار](docs/guides/GETTING_STARTED.md) · [قابلیت‌ها](docs/CAPABILITIES.md) · [توسعه افزونه](docs/plugins/AUTHOR_GUIDE.md) · [مشارکت](CONTRIBUTING.md)

</div>

![فضای کاری Scriptor با ویرایشگر، پیش‌نمایش رندرشده، پنل بازرس و نوار وضعیت جمع‌وجور](docs/assets/screenshots/workspace-light.png)

## محصول

Scriptor یک پوشه Markdown را باز می‌کند و قابلیت‌هایی مثل جست‌وجو، پیوندهای بازگشتی، تاریخچه، پیش‌نمایش و بررسی سلامت را به آن اضافه می‌کند. Markdown همچنان مرجع اصلی داده‌هاست؛ بنابراین هر یادداشت در ویرایشگرهای دیگر نیز خوانا و قابل استفاده می‌ماند.

Scriptor برای پروژه‌های بلندمدتی مثل کتاب، پایان‌نامه، مستندات فنی، مجموعه‌های پژوهشی و پایگاه‌های دانشی که به‌طور مستمر نگهداری می‌شوند طراحی شده است. پوسته دسکتاپ Tauri رابط کاربری را فراهم می‌کند و سرویس‌های Rust مدیریت مخزن یادداشت‌ها، نمایه‌سازی، Git، خروجی‌گیری و ارتباط بین‌فرایندی محلی را بر عهده دارند.

| کار با محتوای شما | Scriptor چه چیزی فراهم می‌کند |
|---|---|
| **نوشتن و بازبینی** | نمای متن منبع، نمای دو‌بخشی و نمای رندرشده؛ پیمایش بر اساس ساختار سند؛ قطعه‌متن‌ها؛ ویرایشگر قابل تنظیم؛ تاریخچه یادداشت |
| **ساخت و بررسی شواهد** | Wikilink، پیوند بازگشتی، ارجاع علمی، مرور گراف، بررسی سلامت و ترمیم پیوندهای حل‌نشده |
| **انتشار بازتولیدپذیر** | پروفایل‌های نام‌گذاری‌شده Pandoc برای HTML، PDF، DOCX، LaTeX، ePub و Reveal.js |
| **خودکارسازی با مرزبندی روشن** | گردش‌کارهای آگاه از Git، ابزارهای MCP با ثبت ممیزی، افزونه‌های مجوزمحور و یک daemon محلی |

## Scriptor در عمل

| نوشتن با متن منبع و پیش‌نمایش | بررسی ساختار و کیفیت یادداشت |
|---|---|
| ![ویرایشگر و پیش‌نمایش](docs/assets/screenshots/editor-preview.png) | ![پیش‌نمایش بازرس](docs/assets/screenshots/inspector-preview.png) |

| بررسی ارتباط‌ها | ترمیم و سامان‌دهی مخزن |
|---|---|
| ![گراف](docs/assets/screenshots/graph.png) | ![میزکار دانش](docs/assets/screenshots/knowledge-workbench.png) |

| گسترش فضای کاری | انتشار با پروفایل‌های نام‌گذاری‌شده |
|---|---|
| ![بازار افزونه‌ها](docs/assets/screenshots/plugins.png) | ![مرکز انتشار](docs/assets/screenshots/publish-center.png) |

[فهرست اسکرین‌شات‌ها](docs/assets/screenshots/README.md) حالت تاریک، Git، حل تعارض، Command Palette، MCP، تنظیمات، سلامت مخزن، تاریخچه یادداشت، میانبرهای صفحه‌کلید، فرایند آشنایی اولیه و چیدمان‌های فشرده را نیز پوشش می‌دهد. اسکریپت ثبت تصویر صبر می‌کند تا داده‌ها و پنل‌ها کاملاً بارگذاری شوند و اگر صفحه در وضعیت بارگذاری یا حالت تنزل‌یافته باقی بماند، اجرا را ناموفق اعلام می‌کند.

## قابلیت‌ها

- **نوشتن** — CodeMirror 6 به‌صورت پیش‌فرض، با امکان استفاده از Monaco؛ حالت دو‌بخشی و پیش‌نمایش؛ نوار قالب‌بندی؛ قطعه‌متن‌ها؛ حالت بدون حواس‌پرتی؛ ویرایشگر میانبرهای صفحه‌کلید
- **سامان‌دهی** — درخت مجازی‌سازی‌شده مخزن، inbox، یادداشت روزانه، نوع‌های یادداشت، قالب‌ها و نماهای ذخیره‌شده
- **ارتباط‌دهی** — Wikilink، پیوند بازگشتی، گراف دانش با پیمایش صفحه‌کلیدی، میزکار دانش و ترمیم پیوندهای حل‌نشده
- **ارجاع‌دهی** — سبک‌های CSL، ارجاع درون‌متنی `[@key]`، پیش‌نمایش کتابنامه و فایل‌های کتابنامه محلی
- **انتشار** — پروفایل‌های خروجی Pandoc برای HTML، PDF، DOCX، LaTeX، ePub و Reveal.js، به‌همراه انتشار محلی Starlight
- **خودکارسازی** — Git با حل‌کننده تعارض سه‌طرفه، ۲۲ ابزار MCP با لاگ ممیزی زنجیره‌شده بر پایه هش در JSONL، فهرست افزونه‌ها با حالت امن و daemon بدون رابط با tracing
- **بصری‌سازی** — بوم‌های Canvas با بارگذاری تنبل و انتقال کار `resvg` به worker، به‌همراه ثبت سریع از Portal
- **کار با سیستم** — Command Palette، حالت‌های فضای کاری، داشبورد سلامت مخزن، رابط ترمینالی و snapshotهای زمان‌بندی‌شده
- **بررسی املا** — Hunspell چندزبانه با پشتیبانی اختیاری از LanguageTool

برای مشاهده وضعیت فعلی قابلیت‌های منتشرشده، آزمایشی و صرفاً طراحی‌شده، به [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) مراجعه کنید.

<a id="download"></a>
## دریافت Scriptor

نصاب‌های نسخه تولیدی به‌عنوان دارایی‌های GitHub Release منتشر می‌شوند. نسخه فعلی **1.0.8** است.

- **Windows x86_64** — فایل‌های `.msi` و `.exe` مبتنی بر NSIS
- **macOS Apple Silicon (aarch64)** — فایل `.dmg`
- **Linux x86_64 و ARM64** — فایل‌های `.deb` و `.AppImage`

> **وضعیت اعتماد.** نصاب‌های رسمی بالادستی عمداً **بدون امضای دیجیتال** منتشر می‌شوند. هر انتشار شامل checksumهای SHA-256، یک SBOM با قالب CycloneDX، رسید انتشار، شواهد هویت کد منبع و attestationهای provenance گیت‌هاب است. پیش از نصب، برای فرایند کامل راستی‌آزمایی به [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md) مراجعه کنید.

[آخرین نسخه را دریافت کنید](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) یا [پروژه را از کد منبع بسازید](#build-from-source).

<a id="tech-stack"></a>
## پشته فناوری

- **پوسته دسکتاپ** — Tauri 2
- **رندرکننده** — React 19، Vite 8، TypeScript 6 و Lucide React
- **هسته** — فضای کاری Rust 1.96 با Edition 2024 و crateهای (`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`)
- **ماندگاری داده** — SQLite WAL + FTS5 در هسته مخزن
- **IPC** — RPC محلی با قاب‌بندی postcard و احراز اصالت HMAC (`scriptor-ipc` → `scriptor-daemon`)
- **قراردادها** — typeهای TypeScript تولیدشده از Rust با `ts-rs`
- **استایل‌دهی** — custom propertyهای معنایی CSS؛ بدون Tailwind و بدون فونت راه‌دور
- **ویرایشگر** — CodeMirror 6 به‌صورت پیش‌فرض، با Monaco به‌عنوان گزینه پیشرفته و غیراصلی

<a id="build-from-source"></a>
## ساخت از کد منبع

### پیش‌نیازها

- Node.js `22.16.0` با engines برابر `>=22.12.0`
- pnpm `10.33.0` که با Corepack مدیریت می‌شود
- Rust `1.96.0` از طریق `rustup` با componentهای `rustfmt` و `clippy`
- PowerShell 7 (`pwsh`) برای اسکریپت‌های انتشار، کانتینر و benchmark
- وابستگی‌های پلتفرمی Tauri 2 متناسب با سیستم‌عامل شما

### راه‌اندازی اولیه

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

### اجرا

```powershell
pnpm web:dev          # فقط پوسته وب؛ برای توسعه و آزمون‌های بصری
pnpm desktop:dev      # پوسته دسکتاپ Tauri
```

### راستی‌آزمایی

بررسی‌های سریع و بومی خود مخزن:

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

دروازه کامل انتشار:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`pnpm check:release` اجراکننده‌های قرارداد، آزمون‌های Rust، مجموعه آزمون‌های E2E و بصری Playwright، ممیزی‌های دسترس‌پذیری، smoke testهای daemon و TUI و دروازه‌های عملکرد را اجرا می‌کند. جزئیات بسته‌بندی و راستی‌آزمایی شواهد انتشار در [`scripts/release/README.md`](scripts/release/README.md) مستند شده است.

## معماری

توپولوژی فعلی زمان اجرا، مرزهای اعتماد و مالکیت crateها در [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) مستند شده‌اند. نمودارهای container و context نیز در [`docs/architecture/c4-container.md`](docs/architecture/c4-container.md) و [`docs/architecture/c4-context.md`](docs/architecture/c4-context.md) قرار دارند.

| لایه | نقاط ورود |
|---|---|
| دسکتاپ | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| مخزن | `crates/vault/src/lib.rs` |
| نمایه‌سازی / جست‌وجو / گراف | `crates/indexer/src/lib.rs` |
| IPC مربوط به daemon | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| ابزارهای خارجی | `crates/system-bridge/src/process.rs` |
| پکیج‌های فرانت‌اند | `packages/*/src/index.ts` |

## اصول

- **محلی‌محور.** Markdown مرجع اصلی داده‌ها باقی می‌ماند و قابل حمل است.
- **اختیار صریح.** عملیات مخرب، دسترسی به اطلاعات محرمانه، شبکه، اجرای فرایند، پشتیبان‌گیری و انتشار به مجوز محدود و مشخص نیاز دارند.
- **کار محدود و قابل‌کنترل.** اسکن‌ها، پیمایش گراف، صف‌های رویداد، خروجی subprocess، لاگ‌ها و دنباله‌های ممیزی همگی حد مشخص دارند.
- **تغییرات قابل بازیابی.** commitهای Git ایندکس را ایزوله می‌کنند، نوشتن از طریق MCP با رکوردهای intent/outcome انجام می‌شود و restore پیش از جایگزینی نهایی، manifestها را راستی‌آزمایی می‌کند.
- **برای هر مرز، یک قرارداد.** تعریف‌های IPC در Rust قراردادهای TypeScript را تولید می‌کنند و JSON زمان اجرا پیش از استفاده اعتبارسنجی می‌شود.
- **بیان صادقانه بلوغ قابلیت‌ها.** قابلیت‌های پیاده‌سازی‌شده، آزمایشی و صرفاً طراحی‌شده به‌صورت جداگانه در [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) مستند شده‌اند.

## مستندات

| مخاطب | از اینجا شروع کنید |
|---|---|
| کاربر جدید | [`docs/guides/GETTING_STARTED.md`](docs/guides/GETTING_STARTED.md) |
| علاقه‌مند به قابلیت‌ها | [`docs/CAPABILITIES.md`](docs/CAPABILITIES.md) و [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) |
| توسعه‌دهنده افزونه | [`docs/plugins/AUTHOR_GUIDE.md`](docs/plugins/AUTHOR_GUIDE.md) |
| مشارکت‌کننده | [`CONTRIBUTING.md`](CONTRIBUTING.md) و [`AGENTS.md`](AGENTS.md) |
| پژوهشگر امنیت | [`SECURITY.md`](SECURITY.md) و [`docs/ENCRYPTION-THREAT-MODEL.md`](docs/ENCRYPTION-THREAT-MODEL.md) |
| مدیر انتشار | [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) و [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md) |
| معمار نرم‌افزار | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) و [`docs/architecture/`](docs/architecture/) |
| ممیز | [`docs/_archived/AUDIT-2026-08-23.md`](docs/_archived/AUDIT-2026-08-23.md) و [`docs/FINAL-REMEDIATION-REPORT.md`](docs/FINAL-REMEDIATION-REPORT.md) |

فهرست کامل: [`docs/README.md`](docs/README.md).

## پشتیبانی

- **Issues** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **ایمیل** — Amirreza "Farnam" Taheri، [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
- **امنیت** — دستورالعمل [`SECURITY.md`](SECURITY.md) را دنبال کنید؛ آسیب‌پذیری‌های امنیتی را به‌صورت issue عمومی گزارش نکنید

## مشارکت

Scriptor از مشارکت‌ها استقبال می‌کند. گردش‌کار کامل، انتظارات از مشارکت‌کنندگان و دروازه‌های اثبات لازم در [`CONTRIBUTING.md`](CONTRIBUTING.md) آمده است. پیش از باز کردن pull request:

1. [`PRODUCT.md`](PRODUCT.md)، [`DESIGN.md`](DESIGN.md)، [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) و [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) را مطالعه کنید.
2. هرجا عملی است، ابتدا یک آزمون رفتاری بنویسید که پیش از اصلاح شکست بخورد.
3. فهرست کامل راستی‌آزمایی بالا را اجرا کنید؛ همه دروازه‌ها باید دقیقاً روی همان commit موفق باشند.
4. [`CHANGELOG.md`](CHANGELOG.md) و مستندات مرتبط با تغییر را به‌روزرسانی کنید.

## وضعیت پروژه

**در حال توسعه فعال.** نسخه `v1.0.8` نامزد فعلی انتشار تولیدی است. بخش‌های دسکتاپ، مخزن، نمایه‌ساز، دانش، Git، خروجی‌گیری، daemon و وب پیاده‌سازی و منتشر شده‌اند. جدول وضعیت قابلیت‌ها در [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) مرجع رسمی تشخیص قابلیت‌های پشتیبانی‌شده، آزمایشی و صرفاً طراحی‌شده است. نسخه موبایل، مخزن‌های رمزگذاری‌شده، embeddingهای محلی، Tantivy و میزبان WASM همچنان آزمایشی یا صرفاً در مرحله طراحی هستند.

## مجوز

Scriptor تحت مجوز **GNU AGPL-3.0-or-later** منتشر می‌شود. استفاده تجاری در صورت رعایت تعهدات این مجوز مجاز است. سازمان‌هایی که نمی‌خواهند الزامات AGPL را بپذیرند می‌توانند برای دریافت مجوز تجاری جداگانه درخواست دهند؛ جزئیات در [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md) آمده است.

## نگه‌دارنده پروژه

Amirreza "Farnam" Taheri · [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) · [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
