<div dir="ltr" align="center">

[English](visual-remediation-2026-09-09.md) · **فارسی** · [简体中文](visual-remediation-2026-09-09.zh-CN.md) · [Русский](visual-remediation-2026-09-09.ru.md) · [Deutsch](visual-remediation-2026-09-09.de.md) · [Español](visual-remediation-2026-09-09.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# اصلاحات بصری — 2026-09-09

این <bdi dir="ltr">checklist</bdi> دومین بازبینی <bdi dir="ltr">native-vision</bdi> از <bdi dir="ltr">workspace</bdi> ویندوز و سطح‌های مرتبط را دنبال می‌کند. این سند عمداً در <bdi dir="ltr">implementation branch</bdi> نگه داشته شده تا هر اصلاح بتواند به‌صورت <bdi dir="ltr">incremental</bdi> اعمال و <bdi dir="ltr">verify</bdi> شود.

## <bdi dir="ltr">P1</bdi> — معماری اطلاعات <bdi dir="ltr">shell</bdi> و <bdi dir="ltr">editor</bdi>

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">toolbar</bdi> دائمی سه‌ردیفه <bdi dir="ltr">editor</bdi> به یک ردیف اصلی با <bdi dir="ltr">progressive disclosure</bdi> برای ابزارهای ثانویه تبدیل شود.
- [<bdi dir="ltr">x</bdi>] تکرار معنایی میان <bdi dir="ltr">Source/Preview/Split</bdi> و <bdi dir="ltr">icon</bdi>های <bdi dir="ltr">option</bdi> مربوط به <bdi dir="ltr">editor</bdi> حذف شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">state</bdi> مربوط به <bdi dir="ltr">active-mode</bdi>، <bdi dir="ltr">toggle</bdi> و <bdi dir="ltr">momentary-command</bdi> از نظر بصری و معنایی متمایز باشد.
- [<bdi dir="ltr">x</bdi>] تراکم <bdi dir="ltr">command</bdi> در <bdi dir="ltr">top-bar</bdi> سراسری کم و <bdi dir="ltr">entry point</bdi>های تکراری ادغام شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">scope</bdi> جست‌وجوی <bdi dir="ltr">global</bdi>، <bdi dir="ltr">note search</bdi> و <bdi dir="ltr">command palette</bdi> روشن شود: <bdi dir="ltr">trigger</bdi> سراسری صریحاً `Commands and notes` است، <bdi dir="ltr">sidebar</bdi> فقط <bdi dir="ltr">note</bdi> را جست‌وجو می‌کند و <bdi dir="ltr">palette</bdi> شروع <bdi dir="ltr">note search</bdi> را توضیح می‌دهد.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">navigation</bdi> تکراری `Vault`/<bdi dir="ltr">recent-note</bdi> حذف و <bdi dir="ltr">utility action</bdi>های <bdi dir="ltr">sidebar</bdi> روشن شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">chrome</bdi> در <bdi dir="ltr">split-mode</bdi> کاهش یابد و عرض قابل استفاده <bdi dir="ltr">editor/preview</bdi> حفظ شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">chrome</bdi> دو‌سطحی <bdi dir="ltr">status/output</bdi> پایین ساده شود؛ <bdi dir="ltr">affordance</bdi> تکراری <bdi dir="ltr">Jobs</bdi> و <bdi dir="ltr">noise</bdi> مربوط به <bdi dir="ltr">progress</bdi> تکمیل‌شده حذف شوند.
- [<bdi dir="ltr">x</bdi>] مشکل واقعی بالاتر از <bdi dir="ltr">status</bdi> منفعل <bdi dir="ltr">subsystem</bdi> نمایش داده شود.

## <bdi dir="ltr">P1</bdi> — اعتماد، <bdi dir="ltr">state</bdi> و نام‌گذاری

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">metric</bdi>های <bdi dir="ltr">citation</bdi> در <bdi dir="ltr">Inspector</bdi> همگرا شوند و تفاوت <bdi dir="ltr">note-level</bdi> با <bdi dir="ltr">vault-level</bdi> روشن شود.
- [<bdi dir="ltr">x</bdi>] عبارت‌های <bdi dir="ltr">overlap</bdi>شده <bdi dir="ltr">Note Health</bdi> / <bdi dir="ltr">Note quality</bdi> با <bdi dir="ltr">health</bdi> در سطح <bdi dir="ltr">vault</bdi> و <bdi dir="ltr">Publish readiness</bdi> در سطح <bdi dir="ltr">note</bdi> جایگزین شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">collision</bdi> نام <bdi dir="ltr">Preview</bdi> میان <bdi dir="ltr">surface mode editor</bdi> و <bdi dir="ltr">tab Inspector</bdi> حذف شود (`Rendered output`).
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">profile</bdi>های <bdi dir="ltr">Inspector</bdi> به‌عنوان کنترل <bdi dir="ltr">single-choice</bdi> روشن باشند و <bdi dir="ltr">description</bdi> انتخاب‌شده بدون <bdi dir="ltr">tooltip</bdi> دیده شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">terminology</bdi> در <bdi dir="ltr">Publish Center</bdi>، جداسازی <bdi dir="ltr">label/path profile</bdi> و <bdi dir="ltr">hierarchy action</bdi>های <bdi dir="ltr">export</bdi> اصلاح شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">onboarding</bdi> از <bdi dir="ltr">state</bdi> آگاه باشد و کاربر را به استفاده از کنترل <bdi dir="ltr">background</bdi> مسدودشده راهنمایی نکند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">terminology</bdi> خام/مبهم <bdi dir="ltr">merge</bdi> جایگزین و پیش از <bdi dir="ltr">apply</bdi>، <bdi dir="ltr">resolution</bdi> صریح <bdi dir="ltr">hunk</bdi> اجباری شود.

## <bdi dir="ltr">P2</bdi> — سطح‌های جداگانه

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">Settings</bdi> به <bdi dir="ltr">section</bdi>های قابل <bdi dir="ltr">navigation</bdi> با <bdi dir="ltr">persistence model</bdi> صریح و <bdi dir="ltr">implementation jargon</bdi> کمتر بازطراحی شود.
- [<bdi dir="ltr">x</bdi>] مدیریت <bdi dir="ltr">installed-plugin/permission</bdi> از <bdi dir="ltr">marketplace browsing</bdi> جدا شود، درحالی‌که چهار <bdi dir="ltr">tab</bdi> اصلی <bdi dir="ltr">Store</bdi> در یک ردیف بمانند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">level</bdi>های <bdi dir="ltr">authorization</bdi> در <bdi dir="ltr">MCP</bdi> به‌عنوان <bdi dir="ltr">security state</bdi> نمایش داده شوند، نه <bdi dir="ltr">tab</bdi> عادی، و <bdi dir="ltr">scope vault</bdi> روشن باشد.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">state</bdi> سالم <bdi dir="ltr">Vault Health</bdi> به <bdi dir="ltr">summary</bdi> مثبت تبدیل و <bdi dir="ltr">maintenance action</bdi> کم‌اهمیت‌تر شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">Note History</bdi> به‌صورت <bdi dir="ltr">comparison-first</bdi> و <bdi dir="ltr">restore-second</bdi> با <bdi dir="ltr">timestamp</bdi> یکسان و <bdi dir="ltr">preview read</bdi> به‌شکل <bdi dir="ltr">fail-closed</bdi> طراحی شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">empty state</bdi>های <bdi dir="ltr">Knowledge Workbench</bdi> مثبت و غیرتکراری شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">direction</bdi> در <bdi dir="ltr">Graph</bdi>، <bdi dir="ltr">visibility edge</bdi> متقابل، <bdi dir="ltr">focus labeling</bdi>، <bdi dir="ltr">control</bdi>، <bdi dir="ltr">keyboard navigation</bdi> و <bdi dir="ltr">canvas utilization</bdi> بهبود یابد.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">action</bdi>های <bdi dir="ltr">rail</bdi> در <bdi dir="ltr">Git</bdi>، <bdi dir="ltr">status wording</bdi>، <bdi dir="ltr">pull strategy</bdi>، <bdi dir="ltr">confirmation</bdi> و <bdi dir="ltr">hierarchy workflow</bdi> مربوط به <bdi dir="ltr">commit</bdi> ساده شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">conflict resolver</bdi> از نظر بصری <bdi dir="ltr">diff-first</bdi>، همیشه <bdi dir="ltr">closable</bdi> و <bdi dir="ltr">safe-by-default</bdi> باشد.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">category</bdi>های <bdi dir="ltr">command palette</bdi>، <bdi dir="ltr">alignment</bdi> میانبر و <bdi dir="ltr">action</bdi>های <bdi dir="ltr">consequential</bdi> روشن شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">Canvas</bdi> خالی اولین <bdi dir="ltr">action</bdi> واضح داشته باشد؛ تا پیش از وجود <bdi dir="ltr">content</bdi>، <bdi dir="ltr">export control</bdi>ها کم‌اهمیت شوند و <bdi dir="ltr">developer CLI leakage</bdi> حذف شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">surface</bdi> واقعی مدیریت <bdi dir="ltr">keyboard shortcut</bdi> پیاده‌سازی شود و <bdi dir="ltr">Settings reuse</bdi> نشود.

## <bdi dir="ltr">P2</bdi> — <bdi dir="ltr">accessibility</bdi>، <bdi dir="ltr">responsive</bdi>، <bdi dir="ltr">theme</bdi> و <bdi dir="ltr">localization</bdi>

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">target</bdi>های <bdi dir="ltr">coarse-pointer</bdi> با اندازه 44<bdi dir="ltr">px</bdi> در کل <bdi dir="ltr">cascade</bdi> نهایی <bdi dir="ltr">CSS</bdi> حفظ شوند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">keyboard semantics</bdi> برای <bdi dir="ltr">Canvas</bdi>، <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">toolbar menu</bdi>، <bdi dir="ltr">virtualized Git row</bdi> و <bdi dir="ltr">security-state control verify</bdi> شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">dark mode</bdi> همه <bdi dir="ltr">dialog/panel</bdi>های بازبینی‌شده <bdi dir="ltr">verify</bdi> شود، نه فقط <bdi dir="ltr">workspace</bdi> اصلی. پوشش خودکار <bdi dir="ltr">Settings</bdi>، <bdi dir="ltr">MCP</bdi>، <bdi dir="ltr">Graph</bdi>، <bdi dir="ltr">Knowledge Workbench</bdi>، <bdi dir="ltr">Note History</bdi>، <bdi dir="ltr">Canvas</bdi>، <bdi dir="ltr">Plugins</bdi>، <bdi dir="ltr">Git/conflicts</bdi>، <bdi dir="ltr">Export</bdi> & <bdi dir="ltr">publish</bdi>، <bdi dir="ltr">Vault Health</bdi> و <bdi dir="ltr">onboarding</bdi> را با <bdi dir="ltr">assertion</bdi> صریح <bdi dir="ltr">dark-surface</bdi> شامل می‌شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">visual matrix</bdi> برای <bdi dir="ltr">Windows scaling</bdi>، نام طولانی، داده بزرگ، <bdi dir="ltr">loading/error state</bdi> و <bdi dir="ltr">destructive confirmation</bdi> تکمیل شود. پوشش شامل <bdi dir="ltr">Windows visual regression</bdi>، <bdi dir="ltr">device scale</bdi> و <bdi dir="ltr">app zoom</bdi> برابر 125%، عرض <bdi dir="ltr">compact/mobile/tablet</bdi>، <bdi dir="ltr">vault</bdi>های <bdi dir="ltr">virtualized</bdi> بزرگ با <bdi dir="ltr">filename</bdi> بلند، <bdi dir="ltr">slow-loading skeleton</bdi>، <bdi dir="ltr">failure</bdi>های <bdi dir="ltr">editor/preview</bdi>، <bdi dir="ltr">destructive confirmation</bdi>، <bdi dir="ltr">Persian RTL</bdi> و <bdi dir="ltr">German expansion</bdi> است.
- [<bdi dir="ltr">x</bdi>] رنگ‌های <bdi dir="ltr">hard-coded implementation/theme</bdi> که نیازمند <bdi dir="ltr">semantic token</bdi> هستند حذف شوند. <bdi dir="ltr">sweep</bdi> نهایی <bdi dir="ltr">application chrome</bdi>، <bdi dir="ltr">status color</bdi>، <bdi dir="ltr">editor warning</bdi>، <bdi dir="ltr">reader surface</bdi>، <bdi dir="ltr">error overlay</bdi> و <bdi dir="ltr">primary-action foreground</bdi> را روی <bdi dir="ltr">semantic/theme token</bdi> استاندارد کرد. <bdi dir="ltr">literal</bdi>های باقی‌مانده عمداً <bdi dir="ltr">palette definition</bdi>، رنگ <bdi dir="ltr">user/content</bdi>، رنگ <bdi dir="ltr">export/print</bdi>، <bdi dir="ltr">palette</bdi> مربوط به <bdi dir="ltr">data visualization/category</bdi> یا <bdi dir="ltr">fallback</bdi> پشت <bdi dir="ltr">semantic variable</bdi> هستند.

## مسائل <bdi dir="ltr">correctness</bdi> و <bdi dir="ltr">trust</bdi> پیدا‌شده در <bdi dir="ltr">detour</bdi>

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">heuristic merge-ancestor reconstruction</bdi> حذف و برای <bdi dir="ltr">conflict block</bdi> حل‌نشده/ناقص <bdi dir="ltr">fail-closed</bdi> شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">initial-vault refresh</bdi> که بلافاصله پس از `setVault`، <bdi dir="ltr">React state</bdi> قدیمی می‌خواند اصلاح شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">plugin consent least-privilege</bdi> باشد: فقط <bdi dir="ltr">permission</bdi>های <bdi dir="ltr">required</bdi> به‌صورت <bdi dir="ltr">default</bdi>، <bdi dir="ltr">grant</bdi>های <bdi dir="ltr">additive</bdi> به‌ازای <bdi dir="ltr">vault</bdi> و <bdi dir="ltr">revoke</bdi> محدود به <bdi dir="ltr">vault.</bdi>
- [<bdi dir="ltr">x</bdi>] مسیرهای <bdi dir="ltr">mutation</bdi> مربوط به <bdi dir="ltr">config vault serialize</bdi> و <bdi dir="ltr">state</bdi> مربوط به <bdi dir="ltr">MCP</bdi> که <bdi dir="ltr">runtime</bdi> مالک آن است هنگام <bdi dir="ltr">Settings save</bdi> حفظ شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">LanguageTool</bdi> از <bdi dir="ltr">network path</bdi> پشتیبانی‌شده <bdi dir="ltr">desktop</bdi> عبور کند و <bdi dir="ltr">failure</bdi> سرویس را نشان دهد، نه این‌که بی‌صدا <bdi dir="ltr">no issues</bdi> گزارش کند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">task state</bdi>های <bdi dir="ltr">extended</bdi> مطابق <bdi dir="ltr">task parser render</bdi> شوند.
- [<bdi dir="ltr">x</bdi>] وقتی <bdi dir="ltr">selected revision</bdi> یا <bdi dir="ltr">current-note comparison</bdi> قابل <bdi dir="ltr">read</bdi> نیست <bdi dir="ltr">Note History restore</bdi> غیرفعال شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">Git pull strategy</bdi> پشتیبانی‌شده <bdi dir="ltr">native layer expose</bdi> شود، نه <bdi dir="ltr">hard-coded fast-forward.</bdi>

## <bdi dir="ltr">verification</bdi>

هر مورد علامت‌خورده حداقل یکی از این شواهد را دارد: <bdi dir="ltr">focused unit/component test</bdi>، <bdi dir="ltr">E2E interaction assertion</bdi>، <bdi dir="ltr">accessibility assertion</bdi> یا <bdi dir="ltr">visual contract</bdi> برای <bdi dir="ltr">state</bdi> تحت‌تأثیر. آزمون <bdi dir="ltr">screenshot</bdi> سخت‌گیرانه‌تر می‌شود تا <bdi dir="ltr">feature</bdi> غایب <bdi dir="ltr">failure</bdi> بدهد، نه این‌که بی‌صدا <bdi dir="ltr">fallback surface</bdi> را <bdi dir="ltr">capture</bdi> کند.

آخرین <bdi dir="ltr">recovery pass</bdi> همچنین دومین <bdi dir="ltr">authority UI</bdi> با نام `splitPreview` را حذف کرد: اکنون `chrome.editorSurfaceMode` <bdi dir="ltr">state</bdi>های <bdi dir="ltr">Source/Split/Rendered</bdi> را هدایت می‌کند، <bdi dir="ltr">layout preset</bdi> و <bdi dir="ltr">palette toggle</bdi> از همین <bdi dir="ltr">authority</bdi> عبور می‌کنند و <bdi dir="ltr">Inspector</bdi> همان <bdi dir="ltr">effective state</bdi> را دریافت می‌کند. <bdi dir="ltr">fixture</bdi>های <bdi dir="ltr">E2E</bdi> مربوط به <bdi dir="ltr">workspace chrome</bdi> اکنون از <bdi dir="ltr">production versioned-storage envelope</bdi> استفاده می‌کنند، بنابراین وقتی قرار است <bdi dir="ltr">custom layout</bdi> آزمایش شود <bdi dir="ltr">test</bdi> بی‌صدا به <bdi dir="ltr">default chrome</bdi> برنمی‌گردد. <bdi dir="ltr">accessible-name</bdi> قدیمی و <bdi dir="ltr">locator</bdi>های بیش‌ازحد گسترده که <bdi dir="ltr">CI</bdi> قبلی پیدا کرده بود هم اصلاح شدند.

<bdi dir="ltr">workflow</bdi> موقت <bdi dir="ltr">branch-only</bdi> برای <bdi dir="ltr">write</bdi> که آن <bdi dir="ltr">recovery</bdi> بزرگ <bdi dir="ltr">cross-file</bdi> را به‌طور <bdi dir="ltr">atomic</bdi> اعمال می‌کرد، پس از <bdi dir="ltr">commit</bdi> موفق خودش را حذف کرد و بخشی از <bdi dir="ltr">product/CI surface</bdi> پیشنهادی نیست.

<bdi dir="ltr">PR</bdi> تا زمانی <bdi dir="ltr">draft</bdi> می‌ماند که <bdi dir="ltr">current-head CI</bdi>، <bdi dir="ltr">desktop compile</bdi> و <bdi dir="ltr">visual-review</bdi> سبز شوند و همه <bdi dir="ltr">item</bdi>های باقی‌مانده یا پیاده‌سازی یا همراه <bdi dir="ltr">evidence</bdi> صریحاً به <bdi dir="ltr">follow-up scope</bdi> منتقل شوند.

</div>
