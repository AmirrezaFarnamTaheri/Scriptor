<div dir="ltr" align="center">

[English](STORE-MIGRATION.md) · **فارسی** · [简体中文](STORE-MIGRATION.zh-CN.md) · [Русский](STORE-MIGRATION.ru.md) · [Deutsch](STORE-MIGRATION.de.md) · [Español](STORE-MIGRATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# مالکیت storeهای renderer

<bdi dir="ltr">store</bdi>ها مالک state موقت renderer، cacheهای read-model، هویت request، optimistic UI و state مربوط به retry هستند. آن‌ها هرگز به مرجع اختیار برای فایل‌های vault، secretها، authorization، nonceهای daemon یا اجرای native job تبدیل نمی‌شوند.

## مالکیت فعلی

| سطح | مالک فعلی | استخراج بعدی | مرز |
| --- | --- | --- | --- |
| routing و payloadهای panel | app shell و overlay hook | `usePanelRouterStore` | فرمان‌های native بیرون store می‌مانند |
| lifecycle reader و retry annotation | reader panel و save queue | `useReaderSessionStore` | vault sidecar مرجع ماندگار است |
| تصمیم‌های plugin | state سمت backend که از bridge بازتاب داده می‌شود | `useCapabilityStore` | state متکی به vault و gateهای native مرجع‌اند |
| discovery/draft/audit در MCP | panelهای MCP و runtime hooks | `useMcpRuntimeStore` | اجرای tool و permission check در native می‌ماند |
| Git status و jobها | panel/hookهای Git | `useGitWorkspaceStore` | Git process، credentials و conflict writeها در native می‌مانند |
| انتخاب conflict و merge preview | Git UI | `useConflictResolutionStore` | write مرجع Markdown در مرز vault/native می‌ماند |
| requestهای Task/Kanban | panelهای domain | `useTaskBoardStore` | request ID پاسخ‌های قدیمی را رد می‌کند؛ Markdown حقیقت است |
| planهای export/publish | panelهای Export/Publish | `useExportJobStore`, `usePublishPlanStore` | process spawning و publication در native/CI می‌مانند |
| navigation/history/tabs | controllerهای editor و navigation | reducer-backed navigation store | persistence ویرایشگر متکی به vault می‌ماند |

## قاعده استخراج

هر استخراج باید با یک آزمون race/retry شکست‌خورده آغاز شود، یک state machine تایپ‌شده (`idle`، `loading`، `success`، `error`، `cancelled`) ارائه کند، شناسه request یا job داشته باشد و مرز authorization فعلی native را حفظ کند. مهاجرت store فقط زمانی کامل است که owner قدیمی حذف شده، consumerها از contract جدید استفاده کنند و state تکراری دیگر امکان واگرایی نداشته باشد.

بسته فعلی decomposition مربوط به controllerهای navigation، orchestration ویرایشگر و سطح‌های panel را در خود دارد. storeهای باقی‌مانده عمداً follow-upهای مرحله‌ای‌اند، نه providerهای تکراری که بدون migration مالکیت اضافه شده باشند.

## ارجاع‌های بصری

مرزهای store با سطح‌های بازبینی‌شده در [گالری بصری](./VISUAL-REVIEW.fa.md) متناظرند:

- <bdi dir="ltr">routing</bdi> پنل و دسترس‌پذیری فرمان‌ها: [command palette](assets/screenshots/command-palette.png)
- <bdi dir="ltr">state</bdi> مربوط به graph/canvas: [Graph](assets/screenshots/graph.png) و [Canvas](assets/screenshots/canvas.png)
- <bdi dir="ltr">state</bdi> مربوط به Git/conflict: [Git panel](assets/screenshots/git-panel.png) و [conflict resolver](assets/screenshots/conflict-resolver.png)
- MCP runtime state: [MCP panel](assets/screenshots/mcp-panel.png)
- <bdi dir="ltr">job</bdi>های export/publish: [Publish center](assets/screenshots/publish-center.png)
- <bdi dir="ltr">preferences</bdi> و plugin state: [Settings](assets/screenshots/settings.png) و [Plugins](assets/screenshots/plugins.png)

</div>
