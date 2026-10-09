<div dir="ltr" align="center">

[English](VERIFICATION.md) · **فارسی** · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راستی‌آزمایی

هر نتیجه باید شناسه دقیق commit منبع، محیط، معماری هدف و خروجی‌ها را مشخص کند. نتیجه نسخه قدیمی، پیاده‌سازی جدید را تأیید نمی‌کند.

## شواهد و وضعیت فعلی

تمام بررسی‌های اجرایی این بازبینی روی اجراگرهای GitHub انجام می‌شود. اجرای محلی برنامه، نصب، آزمون، ساخت، lint، بررسی نوع و قالب‌بندی برای این بازبینی مجاز نیست. بررسی منبع و آزمون رگرسیون نوشته‌شده جدا از اجرای موفق ثبت می‌شوند.

| شاهد | معنی |
|---|---|
| تأییدشده | فرمان مشخص روی منبع مشخص اجرا شده و موفق بوده است. |
| اعتبارسنجی ایستا | منبع یا فراداده بدون اجرای محصول بررسی شده است. |
| بازبینی‌شده | کد، قرارداد یا تصویر بدون شاهد اجرایی بررسی شده است. |
| در انتظار | اجرای لازم یا شاهد دستی هنوز موجود نیست. |
| ناموفق | فرمان اجرا شده و موفق نبوده است. |

[گزارش گوگل](validation/GOOGLE-INTEGRATIONS-2026-10-09.md) دامنه پنج سرویس، نتایج اجراگرها و محدودیت‌های ارائه‌دهنده را ثبت می‌کند. [محدودیت وابستگی‌ها](validation/SUPPLY-CHAIN-2026-10-04.md) با موفقیت یک مسیر نامرتبط رفع نمی‌شود.

شواهد جاری در گزارش‌های تاریخ‌دار نگهداری می‌شوند: [بازبینی محصول](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md)، [بزرگ‌نمایی](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md)، [منشأ تصاویر](validation/SCREENSHOT-REFRESH-2026-10-08.md)، [تنظیم فضای کاری](validation/WORKSPACE-SHORTCUTS-2026-10-08.md) و [تاریخچه](validation/HISTORICAL_VERIFICATION.md). [متن تاریخی نسخه فارسی قبلی با مقصد پیوندهای اصلاح‌شده بایگانی شده است](validation/localized-verification-history/VERIFICATION.fa.md). اعداد تاریخی سند منشأ هستند، نه ادعای تکمیل فعلی. راهنماهای فعال باید ترجمه شوند؛ سوابق ممیزی حساس به منشأ و اسناد بایگانی‌شده مستثنا هستند.

## بررسی‌های مخزن

اجراگرها از ریشه مخزن اجرا می‌کنند:


</div>

<div dir="ltr" align="left">

```bash
pnpm check:source
pnpm check:governance
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:portal
pnpm check:renderer
pnpm check:export
pnpm check:headless
pnpm check:citations
pnpm check:knowledge
pnpm check:merge
```

</div>

<div dir="rtl" lang="fa" align="right">


`check:source` قراردادهای IPC، سیاست ماژول/فرایند/unsafe در Rust، مجوز بومی، سیاست رابط، مالکیت، معیارهای عملکرد، اعتماد انتشار و استثناهای RustSec را پوشش می‌دهد. `check:governance` نسخه‌ها، Actions تغییرناپذیر، مرز بسته‌ها، زبان‌ها و قراردادهای مستندات و مجوز را بررسی می‌کند.

## دروازه کامل مهندسی

نامزد انتشار به محیط پاک GitHub، ابزارهای تعیین‌شده در manifest و lockfile ثابت نیاز دارد:


</div>

<div dir="ltr" align="left">

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm check:contracts
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
pnpm audit --prod
```

</div>

<div dir="rtl" lang="fa" align="right">


`pnpm build` گراف بسته تولید و سقف اولیه gzip را بررسی می‌کند؛ `pnpm lint` هشدار ESLint را نمی‌پذیرد. `check:release` حتی در Linux و macOS به PowerShell 7 (`pwsh`) نیاز دارد. آزمون axe به ChromeDriver سازگار با Chrome نیاز دارد؛ اگر کشف خودکار ممکن نبود، `CHROMEWEBDRIVER` را به پوشه درایور اشاره دهید.

## رابط و دسترس‌پذیری


</div>

<div dir="ltr" align="left">

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

</div>

<div dir="rtl" lang="fa" align="right">


ماتریس دستی شامل عرض‌های 320/375/768/1024/1440 پیکسل CSS، پوسته روشن/تیره/پرکنتراست، Windows/macOS/Linux، کار صرفاً با صفحه‌کلید، آزمون صفحه‌خوان، بزرگ‌نمایی متن 200٪، حرکت کاهش‌یافته و حالت خالی، بارگذاری، خطا، موفقیت، تأیید مخرب و محتوای بلند است.

منوهای Typography و Insert باید بیرون برش نوار ابزار قرار گیرند، پس از تغییر اندازه و پیمایش در دید باقی بمانند و بدون حلقه رندر React با تغییر محدود DOM جابه‌جا شوند. باز شدن با صفحه‌کلید اولین گزینه را متمرکز می‌کند؛ کلیدهای جهت، Home، End، Escape، Tab و کلیک بیرون باید کار کنند. Escape تمرکز را به دکمه آغازگر برمی‌گرداند.

تصویر زمانی ثبت می‌شود که عنوان پیش‌نمایش دیده شود و `.preview-error` وجود نداشته باشد. فقط سطوح پایدار baseline دارند؛ تصاویر حالت به کار اجرایی میزبان پیوست می‌شوند. [فهرست تصاویر](assets/screenshots/README.fa.md) ثبت تازه مستندات را از baseline ذخیره‌شده جدا می‌کند.

## انتشار و بازیابی

همه نصب‌کننده‌ها باید از همان tag ممیزی‌شده ساخته شوند. پیش از بسته‌بندی معماری اجراگر باید با هدف تطبیق داشته باشد: Windows x86_64، macOS aarch64 و Linux x86_64/aarch64. ورودی انتشار دقیقاً هفت نصب‌کننده در `release-artifacts` و چهار رکورد `signing-evidence-<platform>-<architecture>.json` در `release-evidence` دارد.

رکورد رسمی شامل `signed: false`، `notarized: false` و `signatureType: "none"` است. پیش از رسید، `node scripts/release/verify-signing-evidence.mjs release-evidence production` اجرا می‌شود. `SHA256SUMS` فقط هفت نصب‌کننده را پوشش می‌دهد؛ رسید schema 4 چهار رکورد اعتماد عادی‌شده را دربر دارد. `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence` اختلاف منبع، checkout ناپاک، خروجی کم/اضافی، مسیر ناامن، symlink، اختلاف checksum/SBOM و هویت ناقص هدف را رد می‌کند.

منشأ GitHub، گواهی SBOM و تبار tag تغییرناپذیر هر نصب‌کننده را بررسی کنید. یادداشت انتشار باید هشدار ناشر ناشناس و فرمان checksum و گواهی تک‌فایل را توضیح دهد. نصب پاک و هشدار سیستم ثبت شوند. پشتیبان خراب باید رد شود و بازیابی روی هر سیستم ثابت شود؛ قطع بازیابی/MCP باید بازیابی قطعی داشته باشد. دروازه عملکرد پیمایش، حافظه، نمایه، جست‌وجو، گراف، ویرایشگر و خروجی نیز لازم است.

## قواعد انتشار و تاریخچه مرجع

اجرای دستی پیش‌فرض پیش‌نمایش است؛ انتشار به `publish: true` روی tag موجود `v*` نیاز دارد. **Release Kickoff** موفقیت CI همان commit را بررسی می‌کند، `VERSION` دقیق را می‌خواهد، فقط tag جدید تغییرناپذیر می‌سازد و Release را صریح اجرا می‌کند. تغییر نسخه به‌تنهایی tag نمی‌سازد؛ tag ناسازگار خطای قطعی است و جابه‌جا نمی‌شود.

انتشار خودکار پس از ساخت و کنترل کیفیت موفق tag انجام می‌شود. Pages با محیط `github-pages` محافظت می‌شود. manifest به انتشار تغییرناپذیر تعلق دارد؛ tag گردشی یا force-push وجود ندارد. **Release** تنها مالک انتشار است. نام دارای معماری مانع تصادم است. اجزای بازشده و شواهد CI وارد مرز بارگذاری نمی‌شوند؛ checksum نصب‌کننده و فراداده اعتماد جدا بررسی می‌شوند.

از clone مرجع با تاریخچه کامل:


</div>

<div dir="ltr" align="left">

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

</div>

<div dir="rtl" lang="fa" align="right">


اسکن مجاز اسرار تمام تاریخچه و شواهد میزبانی درباره حفاظت شاخه، بازبینی، محیط و تبار انتشار لازم است. موفقیت قرارداد منبع، انتشار عمومی را ثابت نمی‌کند. تکمیل به ماتریس CI و **Visual review** روی commit دقیق جاری، سپس گردش‌کار tag تولید و خروجی منتشرشده وابسته است. PR پیش‌نویس دروازه سنگین را به تعویق می‌اندازد؛ `ready_for_review` ماتریس کامل را آغاز می‌کند.

</div>
