<div dir="ltr" align="center">
[English](PLUGIN_SYSTEM.md) · **فارسی** · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · [Deutsch](PLUGIN_SYSTEM.de.md) · [Español](PLUGIN_SYSTEM.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# طراحی سامانه افزونه‌ها

[<bdi dir="ltr">English</bdi>](PLUGIN_SYSTEM.md) · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](PLUGIN_SYSTEM.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](PLUGIN_SYSTEM.es.md) · **فارسی**

![بازار افزونه‌ها و افزونه‌های نصب‌شده](../assets/screenshots/plugins.png)

## هدف‌ها

- <bdi dir="ltr">Scriptor</bdi> بتواند توسعه پیدا کند بدون اینکه هسته برنامه بی‌مرز و نفوذپذیر شود.
- فایل‌ها و <bdi dir="ltr">write</bdi>های <bdi dir="ltr">vault</bdi> با <bdi dir="ltr">command contract</bdi> محافظت شوند.
- <bdi dir="ltr">extension</bdi>های <bdi dir="ltr">first-party</bdi> و <bdi dir="ltr">marketplace</bdi> همراه برنامه بتوانند <bdi dir="ltr">command</bdi>، رفتار <bdi dir="ltr">renderer</bdi>، <bdi dir="ltr">export profile</bdi>، ابزار <bdi dir="ltr">MCP</bdi>، <bdi dir="ltr">inspector widget</bdi>، بررسی سلامت <bdi dir="ltr">vault</bdi>، ابزار و <bdi dir="ltr">block</bdi>های <bdi dir="ltr">Canvas</bdi> و <bdi dir="ltr">template pack</bdi> اضافه کنند.
- هر <bdi dir="ltr">permission</bdi> قابل مشاهده و قابل لغو باشد.

## موارد خارج از هدف

- در نسخه اول <bdi dir="ltr">plugin</bdi> دسترسی خام به <bdi dir="ltr">filesystem</bdi> ندارد.
- <bdi dir="ltr">daemon</bdi> پس‌زمینه تحت مدیریت <bdi dir="ltr">plugin</bdi> نداریم.
- ابزار <bdi dir="ltr">write</bdi> مربوط به <bdi dir="ltr">MCP</bdi> بدون <bdi dir="ltr">review</bdi> نداریم.

## مدل <bdi dir="ltr">Runtime</bdi> افزونه

</div>

<div dir="ltr">

<div dir="ltr">
```text
Plugin manifest
  -> permission review
  -> activation policy
  -> contribution registry
  -> command bus / renderer / export / MCP slots
  -> audit events
```
</div>

</div>

<div dir="rtl" lang="fa">

افزونه‌ها رفتار را از طریق <bdi dir="ltr">slot</bdi>ها اضافه می‌کنند:

| <bdi dir="ltr">Slot</bdi> | قابلیت | حداقل <bdi dir="ltr">Permission</bdi> |
|---|---|---|
| <bdi dir="ltr">Command</bdi> | <bdi dir="ltr">Command palette</bdi> و <bdi dir="ltr">automation action.</bdi> | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Renderer extension</bdi> | تبدیل <bdi dir="ltr">Markdown preview.</bdi> | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Export profile</bdi> | <bdi dir="ltr">export target</bdi> یا <bdi dir="ltr">template</bdi> جدید. | <bdi dir="ltr">`system`</bdi> |
| <bdi dir="ltr">MCP tool</bdi> | رابط <bdi dir="ltr">AI/tooling.</bdi> | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Inspector widget</bdi> | <bdi dir="ltr">widget</bdi> مربوط به <bdi dir="ltr">note/vault</bdi> در پنل راست. | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Vault health check</bdi> | قانون <bdi dir="ltr">diagnostics.</bdi> | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Canvas tool</bdi> | <bdi dir="ltr">action</bdi> نوار ابزار <bdi dir="ltr">Canvas</bdi> بدون مرز. | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Canvas block</bdi> | <bdi dir="ltr">block renderer</bdi> ثبت‌شده برای حالت <bdi dir="ltr">Canvas.</bdi> | <bdi dir="ltr">`read`</bdi> |
| <bdi dir="ltr">Template pack</bdi> | <bdi dir="ltr">layout</bdi> شروع برای <bdi dir="ltr">document</bdi> یا <bdi dir="ltr">Canvas.</bdi> | <bdi dir="ltr">`read`</bdi> |

## مدل <bdi dir="ltr">Permission</bdi>

| <bdi dir="ltr">Permission</bdi> | معنا |
|---|---|
| <bdi dir="ltr">`read`</bdi> | می‌تواند <bdi dir="ltr">command contract</bdi>های تأییدشده را <bdi dir="ltr">query</bdi> کند. |
| <bdi dir="ltr">`write-approved`</bdi> | می‌تواند <bdi dir="ltr">write</bdi>هایی پیشنهاد دهد که نیاز به تأیید دارند. |
| <bdi dir="ltr">`system`</bdi> | می‌تواند <bdi dir="ltr">cache/job</bdi> مشتق را بدون تغییر فایل <bdi dir="ltr">canonical</bdi> استفاده کند. |
| <bdi dir="ltr">`dangerous`</bdi> | به هشدار صریح هنگام نصب و تأیید هنگام اجرا نیاز دارد. |
| <bdi dir="ltr">`network`</bdi> | پیش‌فرض مسدود است و با <bdi dir="ltr">allowlist</bdi> میزبان باز می‌شود. |
| <bdi dir="ltr">`secrets`</bdi> | فقط از طریق <bdi dir="ltr">keychain handle</bdi> نام‌گذاری‌شده قابل دسترسی است. |
| <bdi dir="ltr">`external-process`</bdi> | تا زمانی که <bdi dir="ltr">policy</bdi> مربوط به <bdi dir="ltr">plugin sandbox</bdi> وجود نداشته باشد غیرفعال است. |

## نامزدهای افزونه <bdi dir="ltr">First-party</bdi>

| <bdi dir="ltr">Plugin</bdi> | ارزش | <bdi dir="ltr">Slots</bdi> |
|---|---|---|
| <bdi dir="ltr">`scriptor-citation-tools`</bdi> | <bdi dir="ltr">CSL</bdi>، <bdi dir="ltr">bibliography</bdi> و <bdi dir="ltr">health check</bdi> برای <bdi dir="ltr">citation</bdi> گم‌شده. | <bdi dir="ltr">inspector widget</bdi>, <bdi dir="ltr">health check</bdi>, <bdi dir="ltr">export profile</bdi> |
| <bdi dir="ltr">`scriptor-graph-lens`</bdi> | <bdi dir="ltr">filter</bdi> پیشرفته <bdi dir="ltr">graph</bdi> و گزارش <bdi dir="ltr">centrality note.</bdi> | <bdi dir="ltr">inspector widget</bdi>, <bdi dir="ltr">command</bdi> |
| <bdi dir="ltr">`scriptor.publish-pack`</bdi> | <bdi dir="ltr">template</bdi> انتشار و <bdi dir="ltr">export profile.</bdi> | <bdi dir="ltr">export profile</bdi>, <bdi dir="ltr">renderer extension</bdi> |
| <bdi dir="ltr">`scriptor-vault-lint`</bdi> | قوانین <bdi dir="ltr">broken link</bdi>، <bdi dir="ltr">frontmatter</bdi> نامعتبر و <bdi dir="ltr">note stale.</bdi> | <bdi dir="ltr">health check</bdi>, <bdi dir="ltr">command</bdi> |
| <bdi dir="ltr">`scriptor-mcp-research`</bdi> | ابزار <bdi dir="ltr">read-only</bdi> دستیار پژوهش. | <bdi dir="ltr">MCP tool</bdi>, <bdi dir="ltr">command</bdi> |
| <bdi dir="ltr">`scriptor.canvas-kit`</bdi> | <bdi dir="ltr">sticky note</bdi>، <bdi dir="ltr">shape</bdi>، <bdi dir="ltr">connector</bdi> و <bdi dir="ltr">template</bdi> برد پژوهشی. | <bdi dir="ltr">canvas tool</bdi>, <bdi dir="ltr">canvas block</bdi>, <bdi dir="ltr">template pack</bdi> |

## دروازه‌های ایمنی

- <bdi dir="ltr">manifest</bdi> افزونه پیش از <bdi dir="ltr">load</bdi> با <bdi dir="ltr">schema</bdi> اعتبارسنجی می‌شود.
- تغییر <bdi dir="ltr">permission</bdi> نیاز به تأیید کاربر دارد.
- <bdi dir="ltr">command</bdi>های افزونه از همان <bdi dir="ltr">command bus</bdi> مربوط به <bdi dir="ltr">UI</bdi> و <bdi dir="ltr">CLI</bdi> عبور می‌کنند.
- <bdi dir="ltr">widget</bdi>های افزونه فقط <bdi dir="ltr">scoped data</bdi> دریافت می‌کنند و هرگز <bdi dir="ltr">raw vault handle</bdi> نمی‌گیرند.
- <bdi dir="ltr">renderer</bdi> <bdi dir="ltr">extension</bdi>ها ورودی <bdi dir="ltr">sanitized</bdi> دریافت می‌کنند.
- خرابی افزونه باعث <bdi dir="ltr">disable</bdi> شدن همان افزونه می‌شود و <bdi dir="ltr">shell</bdi> برنامه را <bdi dir="ltr">crash</bdi> نمی‌کند.
- <bdi dir="ltr">Safe</bdi> <bdi dir="ltr">mode</bdi> با همه افزونه‌ها در حالت <bdi dir="ltr">disabled</bdi> شروع می‌شود.

## قابلیت‌های عرضه‌شده

| قابلیت | محل |
|---|---|
| <bdi dir="ltr">Manifest schema</bdi> | <bdi dir="ltr">`@scriptor/core/contracts/plugin`</bdi> |
| <bdi dir="ltr">Contribution registry</bdi> + <bdi dir="ltr">safe mode</bdi> | <bdi dir="ltr">`packages/plugin-api`</bdi> |
| <bdi dir="ltr">Bundled marketplace catalog</bdi> | <bdi dir="ltr">`packages/plugin-api/catalog.json`, `src/marketplace.ts`</bdi> |
| <bdi dir="ltr">Remote catalog merge</bdi> | <bdi dir="ltr">`loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`)</bdi> |
| <bdi dir="ltr">First-party plugins</bdi> | <bdi dir="ltr">`scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack`</bdi> |
| <bdi dir="ltr">Plugin panel UI</bdi> | <bdi dir="ltr">`src/components/PluginPanel.tsx`</bdi> |
| <bdi dir="ltr">MCP read-only plugin slot</bdi> | <bdi dir="ltr">`packages/mcp`</bdi> |

</div>


</div>
