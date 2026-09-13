<div dir="ltr" align="center">
[English](README.md) · **فارسی** · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div align="center">

# <bdi dir="ltr">Scriptor</bdi>

**فضای کاری محلی‌محور برای نوشتن حرفه‌ای و پژوهش با <bdi dir="ltr">Markdown.</bdi>**

[<bdi dir="ltr">English</bdi>](README.md) · **فارسی**

[![<bdi dir="ltr">Version</bdi>](https://img.shields.io/badge/version-1.0.8-0f766e.svg)](<bdi dir="ltr">VERSION</bdi>)
[![<bdi dir="ltr">License: AGPL-3.0-or-later</bdi>](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](<bdi dir="ltr">LICENSE</bdi>)
[![<bdi dir="ltr">Platforms</bdi>](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#<bdi dir="ltr">download</bdi>)
[![<bdi dir="ltr">Stack</bdi>](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#<bdi dir="ltr">tech-stack</bdi>)
[![<bdi dir="ltr">CI</bdi>](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](<bdi dir="ltr">https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml</bdi>)

یادداشت‌های شما همان فایل‌های معمولی <bdi dir="ltr">Markdown</bdi> باقی می‌مانند. <bdi dir="ltr">Scriptor</bdi> روی این فایل‌ها ویرایش، پیوندهای بازگشتی، ارجاع‌دهی، تاریخچه نسخه‌ها، انتشار و خودکارسازی با مجوزهای صریح را اضافه می‌کند.

[دریافت](#download) · [شروع کار](docs/guides/GETTING_STARTED.md) · [قابلیت‌ها](docs/CAPABILITIES.md) · [توسعه افزونه](docs/plugins/AUTHOR_GUIDE.md) · [مشارکت](CONTRIBUTING.md)

</div>

![فضای کاری <bdi dir="ltr">Scriptor</bdi> با ویرایشگر، پیش‌نمایش رندرشده، پنل بازرس و نوار وضعیت جمع‌وجور](docs/assets/screenshots/workspace-light.png)

## محصول

<bdi dir="ltr">Scriptor</bdi> یک پوشه <bdi dir="ltr">Markdown</bdi> را باز می‌کند و قابلیت‌هایی مثل جست‌وجو، پیوندهای بازگشتی، تاریخچه، پیش‌نمایش و بررسی سلامت را به آن اضافه می‌کند. <bdi dir="ltr">Markdown</bdi> همچنان مرجع اصلی داده‌هاست؛ بنابراین هر یادداشت در ویرایشگرهای دیگر نیز خوانا و قابل استفاده می‌ماند.

<bdi dir="ltr">Scriptor</bdi> برای پروژه‌های بلندمدتی مثل کتاب، پایان‌نامه، مستندات فنی، مجموعه‌های پژوهشی و پایگاه‌های دانشی که به‌طور مستمر نگهداری می‌شوند طراحی شده است. پوسته دسکتاپ <bdi dir="ltr">Tauri</bdi> رابط کاربری را فراهم می‌کند و سرویس‌های <bdi dir="ltr">Rust</bdi> مدیریت مخزن یادداشت‌ها، نمایه‌سازی، <bdi dir="ltr">Git</bdi>، خروجی‌گیری و ارتباط بین‌فرایندی محلی را بر عهده دارند.

| کار با محتوای شما | <bdi dir="ltr">Scriptor</bdi> چه چیزی فراهم می‌کند |
|---|---|
| **نوشتن و بازبینی** | نمای متن منبع، نمای دو‌بخشی و نمای رندرشده؛ پیمایش بر اساس ساختار سند؛ قطعه‌متن‌ها؛ ویرایشگر قابل تنظیم؛ تاریخچه یادداشت |
| **ساخت و بررسی شواهد** | <bdi dir="ltr">Wikilink</bdi>، پیوند بازگشتی، ارجاع علمی، مرور گراف، بررسی سلامت و ترمیم پیوندهای حل‌نشده |
| **انتشار بازتولیدپذیر** | پروفایل‌های نام‌گذاری‌شده <bdi dir="ltr">Pandoc</bdi> برای <bdi dir="ltr">HTML</bdi>، <bdi dir="ltr">PDF</bdi>، <bdi dir="ltr">DOCX</bdi>، <bdi dir="ltr">LaTeX</bdi>، <bdi dir="ltr">ePub</bdi> و <bdi dir="ltr">Reveal.js</bdi> |
| **خودکارسازی با مرزبندی روشن** | گردش‌کارهای آگاه از <bdi dir="ltr">Git</bdi>، ابزارهای <bdi dir="ltr">MCP</bdi> با ثبت ممیزی، افزونه‌های مجوزمحور و یک <bdi dir="ltr">daemon</bdi> محلی |

## <bdi dir="ltr">Scriptor</bdi> در عمل

| نوشتن با متن منبع و پیش‌نمایش | بررسی ساختار و کیفیت یادداشت |
|---|---|
| ![ویرایشگر و پیش‌نمایش](docs/assets/screenshots/editor-preview.png) | ![پیش‌نمایش بازرس](docs/assets/screenshots/inspector-preview.png) |

| بررسی ارتباط‌ها | ترمیم و سامان‌دهی مخزن |
|---|---|
| ![گراف](docs/assets/screenshots/graph.png) | ![میزکار دانش](docs/assets/screenshots/knowledge-workbench.png) |

| گسترش فضای کاری | انتشار با پروفایل‌های نام‌گذاری‌شده |
|---|---|
| ![بازار افزونه‌ها](docs/assets/screenshots/plugins.png) | ![مرکز انتشار](docs/assets/screenshots/publish-center.png) |

[فهرست اسکرین‌شات‌ها](docs/assets/screenshots/README.md) حالت تاریک، <bdi dir="ltr">Git</bdi>، حل تعارض، <bdi dir="ltr">Command Palette</bdi>، <bdi dir="ltr">MCP</bdi>، تنظیمات، سلامت مخزن، تاریخچه یادداشت، میانبرهای صفحه‌کلید، فرایند آشنایی اولیه و چیدمان‌های فشرده را نیز پوشش می‌دهد. اسکریپت ثبت تصویر صبر می‌کند تا داده‌ها و پنل‌ها کاملاً بارگذاری شوند و اگر صفحه در وضعیت بارگذاری یا حالت تنزل‌یافته باقی بماند، اجرا را ناموفق اعلام می‌کند.

## قابلیت‌ها

- **نوشتن** — <bdi dir="ltr">CodeMirror</bdi> 6 به‌صورت پیش‌فرض، با امکان استفاده از <bdi dir="ltr">Monaco</bdi>؛ حالت دو‌بخشی و پیش‌نمایش؛ نوار قالب‌بندی؛ قطعه‌متن‌ها؛ حالت بدون حواس‌پرتی؛ ویرایشگر میانبرهای صفحه‌کلید
- **سامان‌دهی** — درخت مجازی‌سازی‌شده مخزن، <bdi dir="ltr">inbox</bdi>، یادداشت روزانه، نوع‌های یادداشت، قالب‌ها و نماهای ذخیره‌شده
- **ارتباط‌دهی** — <bdi dir="ltr">Wikilink</bdi>، پیوند بازگشتی، گراف دانش با پیمایش صفحه‌کلیدی، میزکار دانش و ترمیم پیوندهای حل‌نشده
- **ارجاع‌دهی** — سبک‌های <bdi dir="ltr">CSL</bdi>، ارجاع درون‌متنی `[@key]`، پیش‌نمایش کتابنامه و فایل‌های کتابنامه محلی
- **انتشار** — پروفایل‌های خروجی <bdi dir="ltr">Pandoc</bdi> برای <bdi dir="ltr">HTML</bdi>، <bdi dir="ltr">PDF</bdi>، <bdi dir="ltr">DOCX</bdi>، <bdi dir="ltr">LaTeX</bdi>، <bdi dir="ltr">ePub</bdi> و <bdi dir="ltr">Reveal.js</bdi>، به‌همراه انتشار محلی <bdi dir="ltr">Starlight</bdi>
- **خودکارسازی** — <bdi dir="ltr">Git</bdi> با حل‌کننده تعارض سه‌طرفه، ۲۲ ابزار <bdi dir="ltr">MCP</bdi> با لاگ ممیزی زنجیره‌شده بر پایه هش در <bdi dir="ltr">JSONL</bdi>، فهرست افزونه‌ها با حالت امن و <bdi dir="ltr">daemon</bdi> بدون رابط با <bdi dir="ltr">tracing</bdi>
- **بصری‌سازی** — بوم‌های <bdi dir="ltr">Canvas</bdi> با بارگذاری تنبل و انتقال کار `resvg` به <bdi dir="ltr">worker</bdi>، به‌همراه ثبت سریع از <bdi dir="ltr">Portal</bdi>
- **کار با سیستم** — <bdi dir="ltr">Command Palette</bdi>، حالت‌های فضای کاری، داشبورد سلامت مخزن، رابط ترمینالی و <bdi dir="ltr">snapshot</bdi>های زمان‌بندی‌شده
- **بررسی املا** — <bdi dir="ltr">Hunspell</bdi> چندزبانه با پشتیبانی اختیاری از <bdi dir="ltr">LanguageTool</bdi>

برای مشاهده وضعیت فعلی قابلیت‌های منتشرشده، آزمایشی و صرفاً طراحی‌شده، به [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) مراجعه کنید.

<a id="download"></a>
## دریافت <bdi dir="ltr">Scriptor</bdi>

نصاب‌های نسخه تولیدی به‌عنوان دارایی‌های <bdi dir="ltr">GitHub Release</bdi> منتشر می‌شوند. نسخه فعلی **1.0.8** است.

- **<bdi dir="ltr">Windows x86_64</bdi>** — فایل‌های `.msi` و `.exe` مبتنی بر <bdi dir="ltr">NSIS</bdi>
- **<bdi dir="ltr">macOS Apple Silicon</bdi> (<bdi dir="ltr">aarch64</bdi>)** — فایل `.dmg`
- **<bdi dir="ltr">Linux x86_64</bdi> و <bdi dir="ltr">ARM64</bdi>** — فایل‌های `.deb` و `.AppImage`

> **وضعیت اعتماد.** نصاب‌های رسمی بالادستی عمداً **بدون امضای دیجیتال** منتشر می‌شوند. هر انتشار شامل <bdi dir="ltr">checksum</bdi>های <bdi dir="ltr">SHA-256</bdi>، یک <bdi dir="ltr">SBOM</bdi> با قالب <bdi dir="ltr">CycloneDX</bdi>، رسید انتشار، شواهد هویت کد منبع و <bdi dir="ltr">attestation</bdi>های <bdi dir="ltr">provenance</bdi> گیت‌هاب است. پیش از نصب، برای فرایند کامل راستی‌آزمایی به [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md) مراجعه کنید.

[آخرین نسخه را دریافت کنید](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) یا [پروژه را از کد منبع بسازید](#build-from-source).

<a id="tech-stack"></a>
## پشته فناوری

- **پوسته دسکتاپ** — <bdi dir="ltr">Tauri</bdi> 2
- **رندرکننده** — <bdi dir="ltr">React</bdi> 19، <bdi dir="ltr">Vite</bdi> 8، <bdi dir="ltr">TypeScript</bdi> 6 و <bdi dir="ltr">Lucide React</bdi>
- **هسته** — فضای کاری <bdi dir="ltr">Rust</bdi> 1.96 با <bdi dir="ltr">Edition</bdi> 2024 و <bdi dir="ltr">crate</bdi>های (`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`)
- **ماندگاری داده** — <bdi dir="ltr">SQLite WAL</bdi> + <bdi dir="ltr">FTS5</bdi> در هسته مخزن
- **<bdi dir="ltr">IPC</bdi>** — <bdi dir="ltr">RPC</bdi> محلی با قاب‌بندی <bdi dir="ltr">postcard</bdi> و احراز اصالت <bdi dir="ltr">HMAC</bdi> (`scriptor-ipc` → `scriptor-daemon`)
- **قراردادها** — <bdi dir="ltr">type</bdi>های <bdi dir="ltr">TypeScript</bdi> تولیدشده از <bdi dir="ltr">Rust</bdi> با `ts-rs`
- **استایل‌دهی** — <bdi dir="ltr">custom property</bdi>های معنایی <bdi dir="ltr">CSS</bdi>؛ بدون <bdi dir="ltr">Tailwind</bdi> و بدون فونت راه‌دور
- **ویرایشگر** — <bdi dir="ltr">CodeMirror</bdi> 6 به‌صورت پیش‌فرض، با <bdi dir="ltr">Monaco</bdi> به‌عنوان گزینه پیشرفته و غیراصلی

<a id="build-from-source"></a>
## ساخت از کد منبع

### پیش‌نیازها

- <bdi dir="ltr">Node.js</bdi> `22.16.0` با <bdi dir="ltr">engines</bdi> برابر `>=22.12.0`
- <bdi dir="ltr">pnpm</bdi> `10.33.0` که با <bdi dir="ltr">Corepack</bdi> مدیریت می‌شود
- <bdi dir="ltr">Rust</bdi> `1.96.0` از طریق `rustup` با <bdi dir="ltr">component</bdi>های `rustfmt` و `clippy`
- <bdi dir="ltr">PowerShell</bdi> 7 (`pwsh`) برای اسکریپت‌های انتشار، کانتینر و <bdi dir="ltr">benchmark</bdi>
- وابستگی‌های پلتفرمی <bdi dir="ltr">Tauri</bdi> 2 متناسب با سیستم‌عامل شما

### راه‌اندازی اولیه

<div dir="ltr">
```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```
</div>

### اجرا

<div dir="ltr">
```powershell
pnpm web:dev          # فقط پوسته وب؛ برای توسعه و آزمون‌های بصری
pnpm desktop:dev      # پوسته دسکتاپ Tauri
```
</div>

### راستی‌آزمایی

بررسی‌های سریع و بومی خود مخزن:

<div dir="ltr">
```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```
</div>

دروازه کامل انتشار:

<div dir="ltr">
```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```
</div>

`pnpm check:release` اجراکننده‌های قرارداد، آزمون‌های <bdi dir="ltr">Rust</bdi>، مجموعه آزمون‌های <bdi dir="ltr">E2E</bdi> و بصری <bdi dir="ltr">Playwright</bdi>، ممیزی‌های دسترس‌پذیری، <bdi dir="ltr">smoke test</bdi>های <bdi dir="ltr">daemon</bdi> و <bdi dir="ltr">TUI</bdi> و دروازه‌های عملکرد را اجرا می‌کند. جزئیات بسته‌بندی و راستی‌آزمایی شواهد انتشار در [`scripts/release/README.md`](scripts/release/README.md) مستند شده است.

## معماری

توپولوژی فعلی زمان اجرا، مرزهای اعتماد و مالکیت <bdi dir="ltr">crate</bdi>ها در [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) مستند شده‌اند. نمودارهای <bdi dir="ltr">container</bdi> و <bdi dir="ltr">context</bdi> نیز در [`docs/architecture/c4-container.md`](docs/architecture/c4-container.md) و [`docs/architecture/c4-context.md`](docs/architecture/c4-context.md) قرار دارند.

| لایه | نقاط ورود |
|---|---|
| دسکتاپ | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| مخزن | `crates/vault/src/lib.rs` |
| نمایه‌سازی / جست‌وجو / گراف | `crates/indexer/src/lib.rs` |
| <bdi dir="ltr">IPC</bdi> مربوط به <bdi dir="ltr">daemon</bdi> | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| <bdi dir="ltr">Git</bdi> | `crates/native-git/src/lib.rs` |
| ابزارهای خارجی | `crates/system-bridge/src/process.rs` |
| پکیج‌های فرانت‌اند | `packages/*/src/index.ts` |

## اصول

- **محلی‌محور.** <bdi dir="ltr">Markdown</bdi> مرجع اصلی داده‌ها باقی می‌ماند و قابل حمل است.
- **اختیار صریح.** عملیات مخرب، دسترسی به اطلاعات محرمانه، شبکه، اجرای فرایند، پشتیبان‌گیری و انتشار به مجوز محدود و مشخص نیاز دارند.
- **کار محدود و قابل‌کنترل.** اسکن‌ها، پیمایش گراف، صف‌های رویداد، خروجی <bdi dir="ltr">subprocess</bdi>، لاگ‌ها و دنباله‌های ممیزی همگی حد مشخص دارند.
- **تغییرات قابل بازیابی.** <bdi dir="ltr">commit</bdi>های <bdi dir="ltr">Git</bdi> ایندکس را ایزوله می‌کنند، نوشتن از طریق <bdi dir="ltr">MCP</bdi> با رکوردهای <bdi dir="ltr">intent/outcome</bdi> انجام می‌شود و <bdi dir="ltr">restore</bdi> پیش از جایگزینی نهایی، <bdi dir="ltr">manifest</bdi>ها را راستی‌آزمایی می‌کند.
- **برای هر مرز، یک قرارداد.** تعریف‌های <bdi dir="ltr">IPC</bdi> در <bdi dir="ltr">Rust</bdi> قراردادهای <bdi dir="ltr">TypeScript</bdi> را تولید می‌کنند و <bdi dir="ltr">JSON</bdi> زمان اجرا پیش از استفاده اعتبارسنجی می‌شود.
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

- **<bdi dir="ltr">Issues</bdi>** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **ایمیل** — <bdi dir="ltr">Amirreza</bdi> "<bdi dir="ltr">Farnam</bdi>" <bdi dir="ltr">Taheri</bdi>، [<bdi dir="ltr">taherifarnam</bdi>@<bdi dir="ltr">gmail.com</bdi>](mailto:taherifarnam@gmail.com)
- **امنیت** — دستورالعمل [`SECURITY.md`](SECURITY.md) را دنبال کنید؛ آسیب‌پذیری‌های امنیتی را به‌صورت <bdi dir="ltr">issue</bdi> عمومی گزارش نکنید

## مشارکت

<bdi dir="ltr">Scriptor</bdi> از مشارکت‌ها استقبال می‌کند. گردش‌کار کامل، انتظارات از مشارکت‌کنندگان و دروازه‌های اثبات لازم در [`CONTRIBUTING.md`](CONTRIBUTING.md) آمده است. پیش از باز کردن <bdi dir="ltr">pull request:</bdi>

1. [`PRODUCT.md`](PRODUCT.md)، [`DESIGN.md`](DESIGN.md)، [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) و [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) را مطالعه کنید.
2. هرجا عملی است، ابتدا یک آزمون رفتاری بنویسید که پیش از اصلاح شکست بخورد.
3. فهرست کامل راستی‌آزمایی بالا را اجرا کنید؛ همه دروازه‌ها باید دقیقاً روی همان <bdi dir="ltr">commit</bdi> موفق باشند.
4. [`CHANGELOG.md`](CHANGELOG.md) و مستندات مرتبط با تغییر را به‌روزرسانی کنید.

## وضعیت پروژه

**در حال توسعه فعال.** نسخه `v1.0.8` نامزد فعلی انتشار تولیدی است. بخش‌های دسکتاپ، مخزن، نمایه‌ساز، دانش، <bdi dir="ltr">Git</bdi>، خروجی‌گیری، <bdi dir="ltr">daemon</bdi> و وب پیاده‌سازی و منتشر شده‌اند. جدول وضعیت قابلیت‌ها در [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) مرجع رسمی تشخیص قابلیت‌های پشتیبانی‌شده، آزمایشی و صرفاً طراحی‌شده است. نسخه موبایل، مخزن‌های رمزگذاری‌شده، <bdi dir="ltr">embedding</bdi>های محلی، <bdi dir="ltr">Tantivy</bdi> و میزبان <bdi dir="ltr">WASM</bdi> همچنان آزمایشی یا صرفاً در مرحله طراحی هستند.

## مجوز

<bdi dir="ltr">Scriptor</bdi> تحت مجوز **<bdi dir="ltr">GNU AGPL-3.0-or-later</bdi>** منتشر می‌شود. استفاده تجاری در صورت رعایت تعهدات این مجوز مجاز است. سازمان‌هایی که نمی‌خواهند الزامات <bdi dir="ltr">AGPL</bdi> را بپذیرند می‌توانند برای دریافت مجوز تجاری جداگانه درخواست دهند؛ جزئیات در [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md) آمده است.

## نگه‌دارنده پروژه

<bdi dir="ltr">Amirreza</bdi> "<bdi dir="ltr">Farnam</bdi>" <bdi dir="ltr">Taheri</bdi> · [<bdi dir="ltr">taherifarnam</bdi>@<bdi dir="ltr">gmail.com</bdi>](mailto:taherifarnam@gmail.com) · [<bdi dir="ltr">GitHub</bdi>](https://github.com/AmirrezaFarnamTaheri/Scriptor)


</div>
