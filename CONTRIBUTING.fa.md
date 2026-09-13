<div dir="ltr" align="center">

[English](CONTRIBUTING.md) · **فارسی** · [简体中文](CONTRIBUTING.zh-CN.md) · [Русский](CONTRIBUTING.ru.md) · [Deutsch](CONTRIBUTING.de.md) · [Español](CONTRIBUTING.es.md)

</div>

<div dir="rtl" lang="fa">

# مشارکت در توسعه

## پیش از تغییر کد

1. [`PRODUCT.fa.md`](PRODUCT.fa.md)، [`DESIGN.fa.md`](DESIGN.fa.md)، [`docs/ARCHITECTURE.fa.md`](docs/ARCHITECTURE.fa.md) و [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) را بخوانید.
2. برای آشنایی مشارکت‌کننده، نقشه دایرکتوری‌ها و نقطه‌های ورود، به [`docs/ONBOARDING.fa.md`](docs/ONBOARDING.fa.md) مراجعه کنید.
3. برای packageهای TypeScript، [`packages/README.md`](packages/README.md) را بخوانید؛ packageها را فقط از entry pointهای اعلام‌شده import کنید.
4. تغییرات staged، unstaged و untracked نامرتبط را دست‌نخورده نگه دارید.

## زنجیره ابزار

<bdi dir="ltr">Gate</bdi>های محلی به Node.js نسخه 22.12 یا جدیدتر (CI روی 22.16.0 pin شده)، pnpm 10.33.0، Rust 1.96.0 و PowerShell 7 (`pwsh`) نیاز دارند. بررسی‌های دسترس‌پذیری مرورگر همچنین به ChromeDriver سازگار با نسخه نصب‌شده Chrome نیاز دارند؛ اگر به‌طور خودکار پیدا نمی‌شود، `CHROMEWEBDRIVER` را تنظیم کنید.

</div>

<div dir="ltr">

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

</div>

<div dir="rtl" lang="fa">

## توسعه

</div>

<div dir="ltr">

```powershell
pnpm web:dev
pnpm desktop:dev
```

</div>

<div dir="rtl" lang="fa">

## فرایند تغییر

- پیش از رفع bug، آن را با یک test شکست‌خورده بازتولید کنید.
- تغییرات مربوط به mutation، refactor، به‌روزرسانی dependency و فایل‌های generated را قابل review نگه دارید. وقتی PR نسخه major یا minor یک dependency را عوض می‌کند، در همان commit محل‌های استفاده را با release noteهای upstream پین‌شده تطبیق دهید: تغییر نام module یا method (برای نمونه در `fs4` 1.x، `fs_std::FileExt::lock_exclusive` به `FileExt::lock` منتقل شد) روی هیچ پلتفرمی compile نمی‌شود و failure آن همه gateهای بعدی را پشت خود پنهان می‌کند.
- فرمان‌های خارجی را از `crates/system-bridge/src/process.rs` عبور دهید.
- <bdi dir="ltr">JSON</bdi> زمان اجرا را از `unknown` اعتبارسنجی کنید؛ assertion بررسی‌نشده روی boundary اضافه نکنید.
- برای هر native command جدید، classification مجوز را اضافه کنید.
- برای داده‌های طولانی‌عمر یا تحت کنترل کاربر از queue، collection و output محدود استفاده کنید.
- ابتدا فایل‌های source-of-truth را به‌روزرسانی کنید و بعد contractهای مشتق‌شده را regenerate کنید.
- وقتی maturity یا support تغییر می‌کند، docs و capability ledger را هم به‌روزرسانی کنید.

## بررسی‌های الزامی

</div>

<div dir="ltr">

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

</div>

<div dir="rtl" lang="fa">

`pnpm test:rust` gate مربوط به Rust در CI را بازتاب می‌دهد: `scriptor-desktop` (که `desktop-check.yml` آن را پوشش می‌دهد) و engineهای در حال incubation (`scriptor-embeddings`، `scriptor-tantivy-indexer`، `scriptor-wasm-runtime`) از اجرای تست محصول کنار گذاشته می‌شوند و سپس با `test:rust:engines` جداگانه بررسی می‌شوند. `scriptor-citation-engine` در graph تست محصول باقی می‌ماند، چون parser مربوط به BibLaTeX آن یک dependency پشتیبانی‌شده indexer است؛ فقط سطح citeproc/rendering این crate همچنان در incubation است.

<bdi dir="ltr">Validator</bdi>های هدفمند package و suiteهای مرتبط Playwright را برای رفتار تغییرکرده اجرا کنید. تغییر UI باید شواهدی برای صفحه‌کلید، semantics مربوط به screen reader، وضعیت‌های loading/empty/error، viewport باریک و بزرگ‌نمایی ۲۰۰٪ داشته باشد.

`pnpm check:release` یک release gate گسترده است، نه سریع‌ترین حلقه feedback محلی. ابتدا بررسی‌های هدفمند بالا را اجرا کنید و سپس gate کامل را روی ماشینی با پیش‌نیازهای desktop/browser اجرا کنید.

اصطلاحات مربوط به proof و gateهای platform/release در [`docs/VERIFICATION.fa.md`](docs/VERIFICATION.fa.md) تعریف شده‌اند. هرگز یک بررسی static source را به‌عنوان نتیجه compiled، packaged، native یا browser-verified توصیف نکنید.

## Pull requestها

موارد زیر را توضیح دهید:

- رفتار قابل مشاهده‌ای که تغییر کرده است؛
- <bdi dir="ltr">boundary</bdi>های authority/data تحت تأثیر؛
- تست‌ها و فرمان‌های اجراشده همراه نتیجه؛
- رفتار migration/rollback؛
- <bdi dir="ltr">screenshot</bdi> برای تغییرات قابل مشاهده کاربر؛
- پلتفرم‌های راستی‌آزمایی‌نشده یا ریسک‌های باقی‌مانده.

<bdi dir="ltr">Secret</bdi>، دایرکتوری build تولیدشده، debug log یا داده شخصی vault را commit نکنید.

## مجوز

مگر آنکه خلافش ذکر شده باشد، contributionها تحت **AGPL-3.0-or-later** مجوز می‌گیرند. با ارسال contribution اعلام می‌کنید که حق اعطای مجوز با این شرایط را دارید. سیاست مجوز جداگانه در [`COMMERCIAL-LICENSING.fa.md`](COMMERCIAL-LICENSING.fa.md) آمده است.

## امنیت

آسیب‌پذیری‌ها را مطابق [`SECURITY.fa.md`](SECURITY.fa.md) به‌صورت خصوصی گزارش کنید.

</div>
