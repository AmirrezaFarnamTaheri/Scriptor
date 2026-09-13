# محصول

**Scriptor** · *ابزار نوشتن حرفه‌ای* · منبع نسخه: [`VERSION`](VERSION)

## جایگاه محصول

<bdi dir="ltr">Scriptor</bdi> یک فضای کاری local-first بر پایه Markdown برای نوشتن حرفه‌ای و پژوهش است. این محصول نوشتن، مدیریت شواهد، ارجاع‌دهی، پیمایش گراف، بازبینی آگاه از Git، انتشار بازتولیدپذیر و خودکارسازی مجوزمحور را کنار هم قرار می‌دهد و در عین حال فایل‌های Markdown روی دیسک را مرجع اصلی نگه می‌دارد.

## زمینه عملیاتی

- برنامه دسکتاپ Tauri سطح اصلی محصول است.
- پوسته وب برای توسعه و آزمون بصری استفاده می‌شود.
- <bdi dir="ltr">daemon</bdi>، CLI/TUI، سرور MCP و فهرست محدود افزونه‌ها extensionهای عملیاتی همان مدل vault هستند.
- <bdi dir="ltr">Mobile</bdi>، vaultهای رمزگذاری‌شده، embeddings، Tantivy و WASM host مطابق [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) آزمایشی یا صرفاً طراحی‌شده باقی می‌مانند.

## شواهد موجود

ادعاهای محصول بر artifactهای repository متکی‌اند، نه زبان roadmap:

- [`README.fa.md`](README.fa.md) وضعیت انتشار فعلی و entry pointهای پشتیبانی‌شده را تعریف می‌کند.
- [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) قابلیت‌های پیاده‌سازی‌شده، آزمایشی و design-only را جدا می‌کند.
- [`docs/ARCHITECTURE.fa.md`](docs/ARCHITECTURE.fa.md) مالکیت componentها و مرزهای اعتماد را ثبت می‌کند.
- [`docs/VERIFICATION.fa.md`](docs/VERIFICATION.fa.md) مشخص می‌کند بررسی‌های فعلی چه چیزی را اثبات می‌کنند و چه چیزی به evidence در محیط clean نیاز دارد.
- [`DESIGN.fa.md`](DESIGN.fa.md) الزامات interaction، accessibility و visual system را تعیین می‌کند.

## اصول محصول

1. **فایل‌ها مرجع می‌مانند.** Markdown قابل حمل، قابل بازرسی و قابل بازیابی می‌ماند.
2. **اختیار صریح است.** عملیات native، network، process، plugin، MCP، backup، publishing و destructive از مرزهای permission نام‌گذاری‌شده عبور می‌کنند.
3. **کار محدود است.** scanها، graph traversalها، process output، logها، queueها و recordهای نگه‌داری‌شده limit صریح دارند.
4. **تغییر قابل بازیابی است.** تغییرات پراثر scope، side effectهای مرتب‌شده، failure state و recovery evidence را آشکار می‌کنند.
5. **بلوغ صادقانه بیان می‌شود.** رفتار پیاده‌سازی‌شده، کار آزمایشی و گزینه‌های طراحی هرگز معادل یکدیگر معرفی نمی‌شوند.
6. **فضای کاری در خدمت نوشتن است.** navigation، diagnostics و automation از سند پشتیبانی می‌کنند و جای آن را نمی‌گیرند.

## کاربران و کار اصلی

<bdi dir="ltr">Scriptor</bdi> برای نویسندگان، پژوهشگران، دانشجویان، نویسندگان فنی و knowledge workerهایی است که vaultهای Markdown بلندمدت نگه می‌دارند. آن‌ها از Scriptor برای ثبت مطالب، پیوند دادن شواهد، نگارش و بازبینی متن بلند، مدیریت citation، سنجش کیفیت دانش، انتشار بازتولیدپذیر و خودکارسازی کارهای محدود بدون واگذاری مالکیت فایل‌ها استفاده می‌کنند.

## وعده محصول

1. فایل‌های Markdown قابل حمل و مرجع باقی می‌مانند.
2. کاربر پیش از عملیات پرریسک می‌تواند بفهمد چه چیزی خوانده، نوشته، ارسال، اجرا یا حذف خواهد شد.
3. وضعیت index، graph، Git، export و backup قابل مشاهده و بازیابی است.
4. فضای نوشتن زیر بار پژوهش متراکم همچنان آرام و خوانا می‌ماند.
5. قابلیت‌های آزمایشی برچسب‌گذاری می‌شوند و به‌عنوان تضمین منتشرشده معرفی نمی‌شوند.

## سطوح پشتیبانی‌شده

| سطح | بلوغ |
|---|---|
| Web development shell | برای توسعه و visual test پشتیبانی می‌شود |
| Tauri desktop (Windows, macOS, Linux) | سطح اصلی محصول |
| Headless daemon و CLI/TUI | سطوح عملیاتی پشتیبانی‌شده |
| MCP stdio integration | با scoped tools و audit recordهای durable پشتیبانی می‌شود |
| Plugin catalog | پلتفرم manifest-first، محدود و آزمایشی |
| Google Calendar و Tasks | integrationهای آزمایشی و opt-in دسکتاپ |
| Mobile، encrypted vaults، embeddings، Tantivy، WASM host | آزمایشی یا design-only |

ماتریس مرجع در [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) است.

## معیارهای موفقیت

- بدون از دست رفتن خاموش داده یا mutation میان vaultها؛
- حافظه و latency محدود با رشد اندازه vault؛
- <bdi dir="ltr">release</bdi>های بازتولیدپذیر و قابل انتساب به source با trust status صریح، checksum، CycloneDX SBOM، receipt و provenance attestation؛
- <bdi dir="ltr">workflow</bdi>های کامل با keyboard و مطابق WCAG 2.2 AA؛
- مشارکت‌کننده جدید بدون «باستان‌شناسی» بتواند ownership، contractها، testها و operational evidence را پیدا کند؛
- <bdi dir="ltr">workflow</bdi>های اصلی کاربر بدون network خارجی کار کنند، مگر سرویس‌هایی که صریحاً opt-in شده‌اند.

## موارد خارج از محصول

- <bdi dir="ltr">storage</bdi> اختصاصی به‌عنوان source of truth؛
- اختیار محیطی AI یا plugin؛
- <bdi dir="ltr">fallback</bdi> شبکه پنهان؛
- <bdi dir="ltr">navigation</bdi> مبتنی بر chat که نوشتن را کنار بزند؛
- <bdi dir="ltr">dashboard</bdi> chrome تزئینی که فضای کار را کم کند؛
- ادعای امنیت برای prototype encryption یا third-party code بدون isolation؛
- <bdi dir="ltr">channel</bdi>های production که trust status عمداً unsigned نصب‌کننده upstream را پنهان یا نادرست نمایش دهند.

## مدل عملیاتی

<bdi dir="ltr">Scriptor</bdi> local-first است. renderer نسبت به اختیار native غیرقابل اعتماد فرض می‌شود. Tauri commandها، daemon RPC، MCP، external processها، Git، دسترسی keychain و backup/restore مرزهای صریح‌اند. log و audit recordهای محلی محدود و redactشده‌اند؛ mutation recordهای با integrity بالا به‌صورت hash-chain نگه‌داری می‌شوند.

## سیاست roadmap

<bdi dir="ltr">Roadmap</bdi> گزینه‌ها را توصیف می‌کند، نه رفتار فعلی. یک capability فقط وقتی ارتقا پیدا می‌کند که داشته باشد:

- <bdi dir="ltr">owner</bdi> و source entry point نام‌گذاری‌شده؛
- <bdi dir="ltr">semantics</bdi> صریح trust و failure؛
- <bdi dir="ltr">test</bdi>های positive، negative، restart و recovery؛
- مدل authorization/privacy؛
- <bdi dir="ltr">evidence</bdi> عملکرد محدود؛
- مستندات user/operator؛
- وضعیت release inclusion و support در capability ledger.
