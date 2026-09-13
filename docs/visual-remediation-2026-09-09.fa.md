<div dir="ltr" align="center">

[English](visual-remediation-2026-09-09.md) · **فارسی** · [简体中文](visual-remediation-2026-09-09.zh-CN.md) · [Русский](visual-remediation-2026-09-09.ru.md) · [Deutsch](visual-remediation-2026-09-09.de.md) · [Español](visual-remediation-2026-09-09.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# اصلاحات بصری — 2026-09-09

این checklist دومین بازبینی native-vision از workspace ویندوز و سطح‌های مرتبط را دنبال می‌کند. این سند عمداً در implementation branch نگه داشته شده تا هر اصلاح بتواند به‌صورت incremental اعمال و verify شود.

## P1 — معماری اطلاعات shell و editor

- [x] toolbar دائمی سه‌ردیفه editor به یک ردیف اصلی با progressive disclosure برای ابزارهای ثانویه تبدیل شود.
- [x] تکرار معنایی میان Source/Preview/Split و iconهای option مربوط به editor حذف شود.
- [x] state مربوط به active-mode، toggle و momentary-command از نظر بصری و معنایی متمایز باشد.
- [x] تراکم command در top-bar سراسری کم و entry pointهای تکراری ادغام شوند.
- [x] scope جست‌وجوی global، note search و command palette روشن شود: trigger سراسری صریحاً `Commands and notes` است، sidebar فقط note را جست‌وجو می‌کند و palette شروع note search را توضیح می‌دهد.
- [x] navigation تکراری `Vault`/recent-note حذف و utility actionهای sidebar روشن شوند.
- [x] chrome در split-mode کاهش یابد و عرض قابل استفاده editor/preview حفظ شود.
- [x] chrome دو‌سطحی status/output پایین ساده شود؛ affordance تکراری Jobs و noise مربوط به progress تکمیل‌شده حذف شوند.
- [x] مشکل واقعی بالاتر از status منفعل subsystem نمایش داده شود.

## P1 — اعتماد، state و نام‌گذاری

- [x] metricهای citation در Inspector همگرا شوند و تفاوت note-level با vault-level روشن شود.
- [x] عبارت‌های overlapشده Note Health / Note quality با health در سطح vault و Publish readiness در سطح note جایگزین شوند.
- [x] collision نام Preview میان surface mode editor و tab Inspector حذف شود (`Rendered output`).
- [x] profileهای Inspector به‌عنوان کنترل single-choice روشن باشند و description انتخاب‌شده بدون tooltip دیده شود.
- [x] terminology در Publish Center، جداسازی label/path profile و hierarchy actionهای export اصلاح شوند.
- [x] onboarding از state آگاه باشد و کاربر را به استفاده از کنترل background مسدودشده راهنمایی نکند.
- [x] terminology خام/مبهم merge جایگزین و پیش از apply، resolution صریح hunk اجباری شود.

## P2 — سطح‌های جداگانه

- [x] Settings به sectionهای قابل navigation با persistence model صریح و implementation jargon کمتر بازطراحی شود.
- [x] مدیریت installed-plugin/permission از marketplace browsing جدا شود، درحالی‌که چهار tab اصلی Store در یک ردیف بمانند.
- [x] levelهای authorization در MCP به‌عنوان security state نمایش داده شوند، نه tab عادی، و scope vault روشن باشد.
- [x] state سالم Vault Health به summary مثبت تبدیل و maintenance action کم‌اهمیت‌تر شود.
- [x] Note History به‌صورت comparison-first و restore-second با timestamp یکسان و preview read به‌شکل fail-closed طراحی شود.
- [x] empty stateهای Knowledge Workbench مثبت و غیرتکراری شوند.
- [x] direction در Graph، visibility edge متقابل، focus labeling، control، keyboard navigation و canvas utilization بهبود یابد.
- [x] actionهای rail در Git، status wording، pull strategy، confirmation و hierarchy workflow مربوط به commit ساده شوند.
- [x] conflict resolver از نظر بصری diff-first، همیشه closable و safe-by-default باشد.
- [x] categoryهای command palette، alignment میانبر و actionهای consequential روشن شوند.
- [x] Canvas خالی اولین action واضح داشته باشد؛ تا پیش از وجود content، export controlها کم‌اهمیت شوند و developer CLI leakage حذف شود.
- [x] surface واقعی مدیریت keyboard shortcut پیاده‌سازی شود و Settings reuse نشود.

## P2 — accessibility، responsive، theme و localization

- [x] targetهای coarse-pointer با اندازه 44px در کل cascade نهایی CSS حفظ شوند.
- [x] keyboard semantics برای Canvas، graph، toolbar menu، virtualized Git row و security-state control verify شود.
- [x] dark mode همه dialog/panelهای بازبینی‌شده verify شود، نه فقط workspace اصلی. پوشش خودکار Settings، MCP، Graph، Knowledge Workbench، Note History، Canvas، Plugins، Git/conflicts، Export & publish، Vault Health و onboarding را با assertion صریح dark-surface شامل می‌شود.
- [x] visual matrix برای Windows scaling، نام طولانی، داده بزرگ، loading/error state و destructive confirmation تکمیل شود. پوشش شامل Windows visual regression، device scale و app zoom برابر 125%، عرض compact/mobile/tablet، vaultهای virtualized بزرگ با filename بلند، slow-loading skeleton، failureهای editor/preview، destructive confirmation، Persian RTL و German expansion است.
- [x] رنگ‌های hard-coded implementation/theme که نیازمند semantic token هستند حذف شوند. sweep نهایی application chrome، status color، editor warning، reader surface، error overlay و primary-action foreground را روی semantic/theme token استاندارد کرد. literalهای باقی‌مانده عمداً palette definition، رنگ user/content، رنگ export/print، palette مربوط به data visualization/category یا fallback پشت semantic variable هستند.

## مسائل correctness و trust پیدا‌شده در detour

- [x] heuristic merge-ancestor reconstruction حذف و برای conflict block حل‌نشده/ناقص fail-closed شود.
- [x] initial-vault refresh که بلافاصله پس از `setVault`، React state قدیمی می‌خواند اصلاح شود.
- [x] plugin consent least-privilege باشد: فقط permissionهای required به‌صورت default، grantهای additive به‌ازای vault و revoke محدود به vault.
- [x] مسیرهای mutation مربوط به config vault serialize و state مربوط به MCP که runtime مالک آن است هنگام Settings save حفظ شود.
- [x] LanguageTool از network path پشتیبانی‌شده desktop عبور کند و failure سرویس را نشان دهد، نه این‌که بی‌صدا no issues گزارش کند.
- [x] task stateهای extended مطابق task parser render شوند.
- [x] وقتی selected revision یا current-note comparison قابل read نیست Note History restore غیرفعال شود.
- [x] Git pull strategy پشتیبانی‌شده native layer expose شود، نه hard-coded fast-forward.

## verification

هر مورد علامت‌خورده حداقل یکی از این شواهد را دارد: focused unit/component test، E2E interaction assertion، accessibility assertion یا visual contract برای state تحت‌تأثیر. آزمون screenshot سخت‌گیرانه‌تر می‌شود تا feature غایب failure بدهد، نه این‌که بی‌صدا fallback surface را capture کند.

آخرین recovery pass همچنین دومین authority UI با نام `splitPreview` را حذف کرد: اکنون `chrome.editorSurfaceMode` stateهای Source/Split/Rendered را هدایت می‌کند، layout preset و palette toggle از همین authority عبور می‌کنند و Inspector همان effective state را دریافت می‌کند. fixtureهای E2E مربوط به workspace chrome اکنون از production versioned-storage envelope استفاده می‌کنند، بنابراین وقتی قرار است custom layout آزمایش شود test بی‌صدا به default chrome برنمی‌گردد. accessible-name قدیمی و locatorهای بیش‌ازحد گسترده که CI قبلی پیدا کرده بود هم اصلاح شدند.

<bdi dir="ltr">workflow</bdi> موقت branch-only برای write که آن recovery بزرگ cross-file را به‌طور atomic اعمال می‌کرد، پس از commit موفق خودش را حذف کرد و بخشی از product/CI surface پیشنهادی نیست.

<bdi dir="ltr">PR</bdi> تا زمانی draft می‌ماند که current-head CI، desktop compile و visual-review سبز شوند و همه itemهای باقی‌مانده یا پیاده‌سازی یا همراه evidence صریحاً به follow-up scope منتقل شوند.

</div>
