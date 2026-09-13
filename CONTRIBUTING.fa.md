<div dir="ltr" align="center">

[English](CONTRIBUTING.md) · **فارسی** · [简体中文](CONTRIBUTING.zh-CN.md) · [Русский](CONTRIBUTING.ru.md) · [Deutsch](CONTRIBUTING.de.md) · [Español](CONTRIBUTING.es.md)

</div>

<div dir="rtl" lang="fa">

# مشارکت در توسعه

## پیش از تغییر کد

1. [`PRODUCT.fa.md`](PRODUCT.fa.md)، [`DESIGN.fa.md`](DESIGN.fa.md)، [`docs/ARCHITECTURE.fa.md`](docs/ARCHITECTURE.fa.md) و [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) را بخوانید.
2. برای آشنایی مشارکت‌کننده، نقشه دایرکتوری‌ها و نقطه‌های ورود، به [`docs/ONBOARDING.fa.md`](docs/ONBOARDING.fa.md) مراجعه کنید.
3. برای <bdi dir="ltr">package</bdi>های <bdi dir="ltr">TypeScript</bdi>، [`packages/README.md`](packages/README.md) را بخوانید؛ <bdi dir="ltr">package</bdi>ها را فقط از <bdi dir="ltr">entry point</bdi>های اعلام‌شده <bdi dir="ltr">import</bdi> کنید.
4. تغییرات <bdi dir="ltr">staged</bdi>، <bdi dir="ltr">unstaged</bdi> و <bdi dir="ltr">untracked</bdi> نامرتبط را دست‌نخورده نگه دارید.

## زنجیره ابزار

<bdi dir="ltr">Gate</bdi>های محلی به <bdi dir="ltr">Node.js</bdi> نسخه 22.12 یا جدیدتر (<bdi dir="ltr">CI</bdi> روی 22.16.0 <bdi dir="ltr">pin</bdi> شده)، <bdi dir="ltr">pnpm</bdi> 10.33.0، <bdi dir="ltr">Rust</bdi> 1.96.0 و <bdi dir="ltr">PowerShell</bdi> 7 (`pwsh`) نیاز دارند. بررسی‌های دسترس‌پذیری مرورگر همچنین به <bdi dir="ltr">ChromeDriver</bdi> سازگار با نسخه نصب‌شده <bdi dir="ltr">Chrome</bdi> نیاز دارند؛ اگر به‌طور خودکار پیدا نمی‌شود، `CHROMEWEBDRIVER` را تنظیم کنید.

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

- پیش از رفع <bdi dir="ltr">bug</bdi>، آن را با یک <bdi dir="ltr">test</bdi> شکست‌خورده بازتولید کنید.
- تغییرات مربوط به <bdi dir="ltr">mutation</bdi>، <bdi dir="ltr">refactor</bdi>، به‌روزرسانی <bdi dir="ltr">dependency</bdi> و فایل‌های <bdi dir="ltr">generated</bdi> را قابل <bdi dir="ltr">review</bdi> نگه دارید. وقتی <bdi dir="ltr">PR</bdi> نسخه <bdi dir="ltr">major</bdi> یا <bdi dir="ltr">minor</bdi> یک <bdi dir="ltr">dependency</bdi> را عوض می‌کند، در همان <bdi dir="ltr">commit</bdi> محل‌های استفاده را با <bdi dir="ltr">release note</bdi>های <bdi dir="ltr">upstream</bdi> پین‌شده تطبیق دهید: تغییر نام <bdi dir="ltr">module</bdi> یا <bdi dir="ltr">method</bdi> (برای نمونه در `fs4` 1.<bdi dir="ltr">x</bdi>، `fs_std::FileExt::lock_exclusive` به `FileExt::lock` منتقل شد) روی هیچ پلتفرمی <bdi dir="ltr">compile</bdi> نمی‌شود و <bdi dir="ltr">failure</bdi> آن همه <bdi dir="ltr">gate</bdi>های بعدی را پشت خود پنهان می‌کند.
- فرمان‌های خارجی را از `crates/system-bridge/src/process.rs` عبور دهید.
- <bdi dir="ltr">JSON</bdi> زمان اجرا را از `unknown` اعتبارسنجی کنید؛ <bdi dir="ltr">assertion</bdi> بررسی‌نشده روی <bdi dir="ltr">boundary</bdi> اضافه نکنید.
- برای هر <bdi dir="ltr">native command</bdi> جدید، <bdi dir="ltr">classification</bdi> مجوز را اضافه کنید.
- برای داده‌های طولانی‌عمر یا تحت کنترل کاربر از <bdi dir="ltr">queue</bdi>، <bdi dir="ltr">collection</bdi> و <bdi dir="ltr">output</bdi> محدود استفاده کنید.
- ابتدا فایل‌های <bdi dir="ltr">source-of-truth</bdi> را به‌روزرسانی کنید و بعد <bdi dir="ltr">contract</bdi>های مشتق‌شده را <bdi dir="ltr">regenerate</bdi> کنید.
- وقتی <bdi dir="ltr">maturity</bdi> یا <bdi dir="ltr">support</bdi> تغییر می‌کند، <bdi dir="ltr">docs</bdi> و <bdi dir="ltr">capability ledger</bdi> را هم به‌روزرسانی کنید.

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

`pnpm test:rust` <bdi dir="ltr">gate</bdi> مربوط به <bdi dir="ltr">Rust</bdi> در <bdi dir="ltr">CI</bdi> را بازتاب می‌دهد: `scriptor-desktop` (که `desktop-check.yml` آن را پوشش می‌دهد) و <bdi dir="ltr">engine</bdi>های در حال <bdi dir="ltr">incubation</bdi> (`scriptor-embeddings`، `scriptor-tantivy-indexer`، `scriptor-wasm-runtime`) از اجرای تست محصول کنار گذاشته می‌شوند و سپس با `test:rust:engines` جداگانه بررسی می‌شوند. `scriptor-citation-engine` در <bdi dir="ltr">graph</bdi> تست محصول باقی می‌ماند، چون <bdi dir="ltr">parser</bdi> مربوط به <bdi dir="ltr">BibLaTeX</bdi> آن یک <bdi dir="ltr">dependency</bdi> پشتیبانی‌شده <bdi dir="ltr">indexer</bdi> است؛ فقط سطح <bdi dir="ltr">citeproc/rendering</bdi> این <bdi dir="ltr">crate</bdi> همچنان در <bdi dir="ltr">incubation</bdi> است.

<bdi dir="ltr">Validator</bdi>های هدفمند <bdi dir="ltr">package</bdi> و <bdi dir="ltr">suite</bdi>های مرتبط <bdi dir="ltr">Playwright</bdi> را برای رفتار تغییرکرده اجرا کنید. تغییر <bdi dir="ltr">UI</bdi> باید شواهدی برای صفحه‌کلید، <bdi dir="ltr">semantics</bdi> مربوط به <bdi dir="ltr">screen reader</bdi>، وضعیت‌های <bdi dir="ltr">loading/empty/error</bdi>، <bdi dir="ltr">viewport</bdi> باریک و بزرگ‌نمایی ۲۰۰٪ داشته باشد.

`pnpm check:release` یک <bdi dir="ltr">release gate</bdi> گسترده است، نه سریع‌ترین حلقه <bdi dir="ltr">feedback</bdi> محلی. ابتدا بررسی‌های هدفمند بالا را اجرا کنید و سپس <bdi dir="ltr">gate</bdi> کامل را روی ماشینی با پیش‌نیازهای <bdi dir="ltr">desktop/browser</bdi> اجرا کنید.

اصطلاحات مربوط به <bdi dir="ltr">proof</bdi> و <bdi dir="ltr">gate</bdi>های <bdi dir="ltr">platform/release</bdi> در [`docs/VERIFICATION.fa.md`](docs/VERIFICATION.fa.md) تعریف شده‌اند. هرگز یک بررسی <bdi dir="ltr">static source</bdi> را به‌عنوان نتیجه <bdi dir="ltr">compiled</bdi>، <bdi dir="ltr">packaged</bdi>، <bdi dir="ltr">native</bdi> یا <bdi dir="ltr">browser-verified</bdi> توصیف نکنید.

## <bdi dir="ltr">Pull request</bdi>ها

موارد زیر را توضیح دهید:

- رفتار قابل مشاهده‌ای که تغییر کرده است؛
- <bdi dir="ltr">boundary</bdi>های <bdi dir="ltr">authority/data</bdi> تحت تأثیر؛
- تست‌ها و فرمان‌های اجراشده همراه نتیجه؛
- رفتار <bdi dir="ltr">migration/rollback</bdi>؛
- <bdi dir="ltr">screenshot</bdi> برای تغییرات قابل مشاهده کاربر؛
- پلتفرم‌های راستی‌آزمایی‌نشده یا ریسک‌های باقی‌مانده.

<bdi dir="ltr">Secret</bdi>، دایرکتوری <bdi dir="ltr">build</bdi> تولیدشده، <bdi dir="ltr">debug log</bdi> یا داده شخصی <bdi dir="ltr">vault</bdi> را <bdi dir="ltr">commit</bdi> نکنید.

## مجوز

مگر آنکه خلافش ذکر شده باشد، <bdi dir="ltr">contribution</bdi>ها تحت **<bdi dir="ltr">AGPL-3.0-or-later</bdi>** مجوز می‌گیرند. با ارسال <bdi dir="ltr">contribution</bdi> اعلام می‌کنید که حق اعطای مجوز با این شرایط را دارید. سیاست مجوز جداگانه در [`COMMERCIAL-LICENSING.fa.md`](COMMERCIAL-LICENSING.fa.md) آمده است.

## امنیت

آسیب‌پذیری‌ها را مطابق [`SECURITY.fa.md`](SECURITY.fa.md) به‌صورت خصوصی گزارش کنید.

</div>
