<div dir="ltr" align="center">

[English](STORE-MIGRATION.md) · **فارسی** · [简体中文](STORE-MIGRATION.zh-CN.md) · [Русский](STORE-MIGRATION.ru.md) · [Deutsch](STORE-MIGRATION.de.md) · [Español](STORE-MIGRATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# مالکیت <bdi dir="ltr">store</bdi>های <bdi dir="ltr">renderer</bdi>

<bdi dir="ltr">store</bdi>ها مالک <bdi dir="ltr">state</bdi> موقت <bdi dir="ltr">renderer</bdi>، <bdi dir="ltr">cache</bdi>های <bdi dir="ltr">read-model</bdi>، هویت <bdi dir="ltr">request</bdi>، <bdi dir="ltr">optimistic UI</bdi> و <bdi dir="ltr">state</bdi> مربوط به <bdi dir="ltr">retry</bdi> هستند. آن‌ها هرگز به مرجع اختیار برای فایل‌های <bdi dir="ltr">vault</bdi>، <bdi dir="ltr">secret</bdi>ها، <bdi dir="ltr">authorization</bdi>، <bdi dir="ltr">nonce</bdi>های <bdi dir="ltr">daemon</bdi> یا اجرای <bdi dir="ltr">native job</bdi> تبدیل نمی‌شوند.

## مالکیت فعلی

| سطح | مالک فعلی | استخراج بعدی | مرز |
| --- | --- | --- | --- |
| <bdi dir="ltr">routing</bdi> و <bdi dir="ltr">payload</bdi>های <bdi dir="ltr">panel</bdi> | <bdi dir="ltr">app shell</bdi> و <bdi dir="ltr">overlay hook</bdi> | `usePanelRouterStore` | فرمان‌های <bdi dir="ltr">native</bdi> بیرون <bdi dir="ltr">store</bdi> می‌مانند |
| <bdi dir="ltr">lifecycle reader</bdi> و <bdi dir="ltr">retry annotation</bdi> | <bdi dir="ltr">reader panel</bdi> و <bdi dir="ltr">save queue</bdi> | `useReaderSessionStore` | <bdi dir="ltr">vault sidecar</bdi> مرجع ماندگار است |
| تصمیم‌های <bdi dir="ltr">plugin</bdi> | <bdi dir="ltr">state</bdi> سمت <bdi dir="ltr">backend</bdi> که از <bdi dir="ltr">bridge</bdi> بازتاب داده می‌شود | `useCapabilityStore` | <bdi dir="ltr">state</bdi> متکی به <bdi dir="ltr">vault</bdi> و <bdi dir="ltr">gate</bdi>های <bdi dir="ltr">native</bdi> مرجع‌اند |
| <bdi dir="ltr">discovery/draft/audit</bdi> در <bdi dir="ltr">MCP</bdi> | <bdi dir="ltr">panel</bdi>های <bdi dir="ltr">MCP</bdi> و <bdi dir="ltr">runtime hooks</bdi> | `useMcpRuntimeStore` | اجرای <bdi dir="ltr">tool</bdi> و <bdi dir="ltr">permission check</bdi> در <bdi dir="ltr">native</bdi> می‌ماند |
| <bdi dir="ltr">Git status</bdi> و <bdi dir="ltr">job</bdi>ها | <bdi dir="ltr">panel/hook</bdi>های <bdi dir="ltr">Git</bdi> | `useGitWorkspaceStore` | <bdi dir="ltr">Git process</bdi>، <bdi dir="ltr">credentials</bdi> و <bdi dir="ltr">conflict write</bdi>ها در <bdi dir="ltr">native</bdi> می‌مانند |
| انتخاب <bdi dir="ltr">conflict</bdi> و <bdi dir="ltr">merge preview</bdi> | <bdi dir="ltr">Git UI</bdi> | `useConflictResolutionStore` | <bdi dir="ltr">write</bdi> مرجع <bdi dir="ltr">Markdown</bdi> در مرز <bdi dir="ltr">vault/native</bdi> می‌ماند |
| <bdi dir="ltr">request</bdi>های <bdi dir="ltr">Task/Kanban</bdi> | <bdi dir="ltr">panel</bdi>های <bdi dir="ltr">domain</bdi> | `useTaskBoardStore` | <bdi dir="ltr">request ID</bdi> پاسخ‌های قدیمی را رد می‌کند؛ <bdi dir="ltr">Markdown</bdi> حقیقت است |
| <bdi dir="ltr">plan</bdi>های <bdi dir="ltr">export/publish</bdi> | <bdi dir="ltr">panel</bdi>های <bdi dir="ltr">Export/Publish</bdi> | `useExportJobStore`, `usePublishPlanStore` | <bdi dir="ltr">process spawning</bdi> و <bdi dir="ltr">publication</bdi> در <bdi dir="ltr">native/CI</bdi> می‌مانند |
| <bdi dir="ltr">navigation/history/tabs</bdi> | <bdi dir="ltr">controller</bdi>های <bdi dir="ltr">editor</bdi> و <bdi dir="ltr">navigation</bdi> | <bdi dir="ltr">reducer-backed navigation store</bdi> | <bdi dir="ltr">persistence</bdi> ویرایشگر متکی به <bdi dir="ltr">vault</bdi> می‌ماند |

## قاعده استخراج

هر استخراج باید با یک آزمون <bdi dir="ltr">race/retry</bdi> شکست‌خورده آغاز شود، یک <bdi dir="ltr">state machine</bdi> تایپ‌شده (`idle`، `loading`، `success`، `error`، `cancelled`) ارائه کند، شناسه <bdi dir="ltr">request</bdi> یا <bdi dir="ltr">job</bdi> داشته باشد و مرز <bdi dir="ltr">authorization</bdi> فعلی <bdi dir="ltr">native</bdi> را حفظ کند. مهاجرت <bdi dir="ltr">store</bdi> فقط زمانی کامل است که <bdi dir="ltr">owner</bdi> قدیمی حذف شده، <bdi dir="ltr">consumer</bdi>ها از <bdi dir="ltr">contract</bdi> جدید استفاده کنند و <bdi dir="ltr">state</bdi> تکراری دیگر امکان واگرایی نداشته باشد.

بسته فعلی <bdi dir="ltr">decomposition</bdi> مربوط به <bdi dir="ltr">controller</bdi>های <bdi dir="ltr">navigation</bdi>، <bdi dir="ltr">orchestration</bdi> ویرایشگر و سطح‌های <bdi dir="ltr">panel</bdi> را در خود دارد. <bdi dir="ltr">store</bdi>های باقی‌مانده عمداً <bdi dir="ltr">follow-up</bdi>های مرحله‌ای‌اند، نه <bdi dir="ltr">provider</bdi>های تکراری که بدون <bdi dir="ltr">migration</bdi> مالکیت اضافه شده باشند.

## ارجاع‌های بصری

مرزهای <bdi dir="ltr">store</bdi> با سطح‌های بازبینی‌شده در [گالری بصری](./VISUAL-REVIEW.fa.md) متناظرند:

- <bdi dir="ltr">routing</bdi> پنل و دسترس‌پذیری فرمان‌ها: [<bdi dir="ltr">command palette</bdi>](assets/screenshots/command-palette.png)
- <bdi dir="ltr">state</bdi> مربوط به <bdi dir="ltr">graph/canvas:</bdi> [<bdi dir="ltr">Graph</bdi>](assets/screenshots/graph.png) و [<bdi dir="ltr">Canvas</bdi>](assets/screenshots/canvas.png)
- <bdi dir="ltr">state</bdi> مربوط به <bdi dir="ltr">Git/conflict:</bdi> [<bdi dir="ltr">Git panel</bdi>](assets/screenshots/git-panel.png) و [<bdi dir="ltr">conflict resolver</bdi>](assets/screenshots/conflict-resolver.png)
- <bdi dir="ltr">MCP runtime state:</bdi> [<bdi dir="ltr">MCP panel</bdi>](assets/screenshots/mcp-panel.png)
- <bdi dir="ltr">job</bdi>های <bdi dir="ltr">export/publish:</bdi> [<bdi dir="ltr">Publish center</bdi>](assets/screenshots/publish-center.png)
- <bdi dir="ltr">preferences</bdi> و <bdi dir="ltr">plugin state:</bdi> [<bdi dir="ltr">Settings</bdi>](assets/screenshots/settings.png) و [<bdi dir="ltr">Plugins</bdi>](assets/screenshots/plugins.png)

</div>
