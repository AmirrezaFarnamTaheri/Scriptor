<div dir="ltr" align="center">

[English](DESIGN.md) · **فارسی** · [简体中文](DESIGN.zh-CN.md) · [Русский](DESIGN.ru.md) · [Deutsch](DESIGN.de.md) · [Español](DESIGN.es.md)

</div>

<div dir="rtl" lang="fa">

# سامانه طراحی

<bdi dir="ltr">Scriptor</bdi> یک رابط **عملیاتی** است: کاربر آن را برای نوشتن، پیمایش، بررسی، مقایسه و انتشار باز می‌کند. بیان بصری باید از این کارها پشتیبانی کند و هرگز با آن‌ها بر سر توجه رقابت نکند.

## جهت طراحی

- دقیق، آرام، روشن و فنی، بدون تقلید از <bdi dir="ltr">IDE.</bdi>
- سطوح خنثی زغالی/<bdi dir="ltr">Slate</bdi> با تنها یک رنگ تأکیدی معنایی و کنترل‌شده.
- اطلاعات متراکم با سلسله‌مراتب، ریتم و جداکننده‌ها تفکیک می‌شوند، نه با کارت‌های تو‌در‌تو.
- فونت <bdi dir="ltr">sans-serif</bdi> سیستم برای رابط و <bdi dir="ltr">monospace</bdi> سیستم برای کد و اعداد؛ بدون فونت راه‌دور.

## چیدمان

نسخه دسکتاپ چهار ناحیه عملکردی دارد:

1. نوار فرمان بالا؛
2. ریل مخزن/پیمایش؛
3. فضای کاری ویرایشگر/پیش‌نمایش؛
4. بازرس زمینه‌ای و سطوح وضعیت.

در عرض‌های کم، نواحی ثانویه در پیمایش فضای کاری موبایل جمع می‌شوند. هر تغییر در فضای کاری باید در عرض‌های `320`، `375`، `768`، `1024` و `1440` پیکسل و نیز در بزرگ‌نمایی ۲۰۰٪ بررسی شود. هیچ کنترلی نباید صرفاً به <bdi dir="ltr">hover</bdi> وابسته باشد.

## دستورالعمل‌های ضد «<bdi dir="ltr">slop</bdi>»

- گرادیان‌های پیش‌فرض بنفش/نیلی با ظاهر کلیشه‌ای <bdi dir="ltr">AI</bdi> ممنوع‌اند.
- تایپوگرافی بازاریابی بیش‌ازحد بزرگ در سطوح عملیاتی فضای کاری استفاده نمی‌شود.
- <bdi dir="ltr">glassmorphism</bdi> تزئینی یا درخشش محیطی ممنوع است؛ افکت‌های شیشه‌ای مبتنی بر <bdi dir="ltr">token</bdi> فقط برای <bdi dir="ltr">chrome</bdi> عملکردی رزرو شده‌اند.
- <bdi dir="ltr">emoji</bdi> به‌عنوان آیکون ساختاری رابط استفاده نمی‌شود؛ از مجموعه تثبیت‌شده <bdi dir="ltr">Lucide</bdi> استفاده کنید.
- <bdi dir="ltr">transform</bdi>های <bdi dir="ltr">scale</bdi> هنگام <bdi dir="ltr">hover</bdi> نباید باعث جابه‌جایی <bdi dir="ltr">layout</bdi> شوند.
- امتیاز عملکرد، گواهی تکمیل یا ادعای راستی‌آزمایی بدون شواهد ثبت‌شده ساخته نمی‌شود.

## <bdi dir="ltr">Token</bdi>ها و سفارشی‌سازی

<bdi dir="ltr">Token</bdi>های مرجع در `src/index.css` و `src/styles/` قرار دارند. کامپوننت‌های جدید باید برای سطوح، متن، کادر، فوکوس، خطر، هشدار، موفقیت، فاصله، <bdi dir="ltr">radius</bdi> و <bdi dir="ltr">motion</bdi> از متغیرهای معنایی استفاده کنند. رنگ یا سایه دلخواه نیازمند استثنای مستند است.

| نقش <bdi dir="ltr">Token</bdi> | متغیر <bdi dir="ltr">Runtime</bdi> | هدف / دامنه |
|---|---|---|
| تأکید اصلی | `--primary` | دکمه‌های اقدام اصلی، نشانگر تب فعال، <bdi dir="ltr">badge</bdi>های کلیدی |
| کهربایی ثانویه | `--amber` | هشدارها، <bdi dir="ltr">badge</bdi>های وضعیت میانی، تأکیدهای ثانویه |
| پس‌زمینه اصلی | `--bg` | پس‌زمینه ریشه <bdi dir="ltr">canvas</bdi> برنامه |
| سطح ثانویه | `--surface` | پنل‌ها، <bdi dir="ltr">sidebar</bdi>ها و کارت‌های <bdi dir="ltr">dialog</bdi> مودال |
| سطح برجسته | `--surface-raised` | حالت‌های <bdi dir="ltr">hover</bdi>، کارت‌های برجسته و آیتم‌های <bdi dir="ltr">dropdown</bdi> |
| متن اصلی | `--ink` / `--ink-strong` | متن بدنه و عنوان‌های با کنتراست بالا |
| تأکید کادر | `--border` | کادر ظریف پنل‌ها و لبه‌های شیشه‌ای |
| حلقه فوکوس | `--focus-ring` | <bdi dir="ltr">outline</bdi> فوکوس صفحه‌کلید |
| فونت نمایشی | `--font-sans` | انتخاب خانواده فونت <bdi dir="ltr">UI</bdi> (`system`, `inter`, `sf-pro`, `avenir-next`, `outfit`, `jetbrains-mono`, `georgia`) |
| تاری شیشه | `--glass-blur` | شدت <bdi dir="ltr">backdrop filter</bdi> (`none`, `subtle`, `glass`, `heavy`) |

### فهرست طرح‌های رنگی و <bdi dir="ltr">Custom Theme Builder</bdi>

<bdi dir="ltr">Scriptor</bdi> همراه با **۱۸ طرح رنگی داخلی و پرداخت‌شده** در سه دسته (`dark`، `light`، `contrast`) عرضه می‌شود:
- **تیره:** `Dark Midnight`، `Catppuccin Mocha`، `Dracula`، `Nord Frost`، `Tokyo Night`، `Solarized Dark`، `Gruvbox Dark`، `Emerald Forest`، `Cyberpunk Neon`، `Monokai Pro`، `Rosé Pine`، `Synthwave 84`، `One Dark Pro`، `Vitesse Dark`.
- **روشن:** `Light Modern`، `Sepia Paper`.
- **کنتراست بالا:** `High Contrast`، `OLED True Black`.

کاربر می‌تواند **<bdi dir="ltr">Custom Theme Builder</bdi>** را نیز باز کند و <bdi dir="ltr">theme</bdi>های سفارشی را بسازد، ویرایش کند، زنده پیش‌نمایش بگیرد یا حذف کند. این <bdi dir="ltr">theme</bdi>ها به‌صورت پویا زیر `scriptor:custom-themes` ذخیره می‌شوند.

## قرارداد تعامل

هر سطح ناهمگام باید فقط وضعیت‌هایی را نشان دهد که مالک آن واقعاً قادر به تعیینشان است. در صورت پشتیبانی، موارد زیر فراهم شوند:

- وضعیت بارگذاری یا پیشرفت؛
- <bdi dir="ltr">empty</bdi> <bdi dir="ltr">state</bdi> مفید؛
- <bdi dir="ltr">error</bdi> <bdi dir="ltr">state</bdi> قابل اقدام؛
- تأیید دیداری تغییر؛
- امکان لغو کار طولانی.

عملیات پرخطر باید دامنه و پیامد را در یک <bdi dir="ltr">prompt</bdi> تأیید بومی نشان دهند. کنترل غیرفعال باید دلیل خود را توضیح دهد. کنترل مخرب نباید اقدام پیش‌فرض باشد.

## حداقل دسترس‌پذیری

هدف: <bdi dir="ltr">WCAG</bdi> 2.2 <bdi dir="ltr">AA.</bdi>

- <bdi dir="ltr">HTML</bdi> معنایی پیش از <bdi dir="ltr">ARIA</bdi>؛
- نمایش واضح `:focus-visible` برای هر عنصر تعاملی؛
- ترتیب منطقی <bdi dir="ltr">Tab</bdi> و نبود <bdi dir="ltr">keyboard trap</bdi>؛
- <bdi dir="ltr">dialog</bdi>های مودال دارای <bdi dir="ltr">label/description</bdi>، فوکوس اولیه، محصورسازی فوکوس، رسیدگی به <bdi dir="ltr">Escape</bdi>، قفل <bdi dir="ltr">scroll</bdi> و بازگردانی فوکوس باشند؛
- <bdi dir="ltr">tab</bdi>ها از کلیدهای جهت، <bdi dir="ltr">Home</bdi>، <bdi dir="ltr">End</bdi> و <bdi dir="ltr">roving</bdi> `tabIndex` پشتیبانی کنند؛
- وضعیت فقط با رنگ منتقل نشود؛
- <bdi dir="ltr">motion</bdi> به `prefers-reduced-motion` احترام بگذارد؛
- کنترل‌های لمسی دست‌کم ۴۴×۴۴ پیکسل <bdi dir="ltr">CSS</bdi> باشند؛
- متن ویرایشگر و <bdi dir="ltr">UI</bdi> در بزرگ‌نمایی ۲۰۰٪ خوانا بماند؛
- <bdi dir="ltr">token</bdi>های متن ثالث روی سطوح اصلی خود کنتراست <bdi dir="ltr">WCAG AA</bdi> را حفظ کنند؛
- ویرایشگر تا زمانی که کاربر صراحتاً <bdi dir="ltr">override</bdi> نکرده از <bdi dir="ltr">theme</bdi> روشن/تیره برنامه پیروی کند.

## حرکت

<bdi dir="ltr">Motion</bdi> فقط تغییر وضعیت را منتقل می‌کند. <bdi dir="ltr">transition</bdi>های پیش‌فرض ۱۲۰ تا ۲۲۰ میلی‌ثانیه‌اند و از <bdi dir="ltr">opacity</bdi> یا <bdi dir="ltr">transform</bdi>هایی استفاده می‌کنند که <bdi dir="ltr">semantics</bdi> بلوک دربرگیرنده را تغییر ندهند. عرض یا ارتفاع حیاتی برای <bdi dir="ltr">layout</bdi> هرگز به‌طور پیوسته <bdi dir="ltr">animate</bdi> نمی‌شود. حالت <bdi dir="ltr">reduced-motion transition</bdi>های غیرضروری و <bdi dir="ltr">smooth scrolling</bdi> را حذف می‌کند.

## معماری کامپوننت

- داده و <bdi dir="ltr">orchestration</bdi> در <bdi dir="ltr">hook</bdi> یا <bdi dir="ltr">domain controller</bdi> قرار می‌گیرد؛
- کامپوننت‌های نمایشی <bdi dir="ltr">props</bdi> تایپ‌شده می‌گیرند؛
- <bdi dir="ltr">overlay</bdi>های مشترک از <bdi dir="ltr">primitive</bdi> یکپارچه <bdi dir="ltr">dialog/panel</bdi> استفاده می‌کنند؛
- کامپوننت‌های بیش از ۲۰۰ خط نامزد <bdi dir="ltr">decomposition</bdi> هستند؛
- <bdi dir="ltr">package</bdi>ها فقط از <bdi dir="ltr">entry point</bdi>های اعلام‌شده رفتار را <bdi dir="ltr">expose</bdi> می‌کنند؛
- وضعیت‌های <bdi dir="ltr">loading</bdi>، <bdi dir="ltr">empty</bdi>، <bdi dir="ltr">error</bdi> و <bdi dir="ltr">success</bdi> نزد مالکی می‌مانند که واقعاً قادر به تعیین آن‌هاست.

## نتایج ممیزی <bdi dir="ltr">Slop</bdi>

تا تاریخ ۲۰۲۶-۰۸-۰۹:
- **<bdi dir="ltr">Emoji</bdi> خام:** ۰ مورد در فایل‌های <bdi dir="ltr">TSX</bdi> تولیدی (۱۰۰٪ آیکون <bdi dir="ltr">SVG</bdi> از <bdi dir="ltr">Lucide</bdi>).
- **`transition: all` کنترل‌نشده:** ۰ مورد در ۴۳۳ فایل <bdi dir="ltr">CSS</bdi> و <bdi dir="ltr">TSX.</bdi>
- **<bdi dir="ltr">cast</bdi> صریح `any` در <bdi dir="ltr">UI:</bdi>** ۰ مورد در کامپوننت‌های <bdi dir="ltr">TSX</bdi> تولیدی.
- **راستی‌آزمایی قرارداد:** ۴۳ مجموعه <bdi dir="ltr">unit test</bdi> و <bdi dir="ltr">validation</bdi> در `pnpm check:source` با موفقیت کامل عبور می‌کنند.

## راستی‌آزمایی بصری

پروژه‌های <bdi dir="ltr">Playwright theme</bdi>های روشن/تیره، <bdi dir="ltr">breakpoint</bdi>های <bdi dir="ltr">desktop/mobile</bdi>، سطوح مودال، <bdi dir="ltr">editor/preview</bdi>، <bdi dir="ltr">knowledge workbench</bdi>، <bdi dir="ltr">settings</bdi>، <bdi dir="ltr">graph</bdi> و وضعیت‌های اصلی <bdi dir="ltr">workflow</bdi> را پوشش می‌دهند. <bdi dir="ltr">Release candidate</bdi> منجمدشده همچنین تا زمانی که این بررسی‌ها به‌شکل قابل‌اعتماد خودکار نشده‌اند، بررسی دستی در بزرگ‌نمایی ۲۰۰٪، <bdi dir="ltr">screen reader</bdi> و <bdi dir="ltr">native shell</bdi> را الزامی می‌داند. آستانه‌های <bdi dir="ltr">snapshot</bdi> نباید جابه‌جایی تمام صفحه را پنهان کنند. برای جزئیات به [`docs/validation/FRONTEND_QUALITY.fa.md`](docs/validation/FRONTEND_QUALITY.fa.md) مراجعه کنید.

</div>
