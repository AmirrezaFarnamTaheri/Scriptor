<div dir="ltr" align="center">
[English](PLUGIN_SYSTEM.md) · **فارسی** · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · [Deutsch](PLUGIN_SYSTEM.de.md) · [Español](PLUGIN_SYSTEM.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# طراحی سامانه افزونه‌ها

[English](PLUGIN_SYSTEM.md) · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · [Deutsch](PLUGIN_SYSTEM.de.md) · [Español](PLUGIN_SYSTEM.es.md) · **فارسی**

![بازار افزونه‌ها و افزونه‌های نصب‌شده](../assets/screenshots/plugins.png)

## هدف‌ها

- <bdi dir="ltr">Scriptor</bdi> بتواند توسعه پیدا کند بدون اینکه هسته برنامه بی‌مرز و نفوذپذیر شود.
- فایل‌ها و writeهای vault با command contract محافظت شوند.
- <bdi dir="ltr">extension</bdi>های first-party و marketplace همراه برنامه بتوانند command، رفتار renderer، export profile، ابزار MCP، inspector widget، بررسی سلامت vault، ابزار و blockهای Canvas و template pack اضافه کنند.
- هر permission قابل مشاهده و قابل لغو باشد.

## موارد خارج از هدف

- در نسخه اول plugin دسترسی خام به filesystem ندارد.
- <bdi dir="ltr">daemon</bdi> پس‌زمینه تحت مدیریت plugin نداریم.
- ابزار write مربوط به MCP بدون review نداریم.

## مدل Runtime افزونه

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

افزونه‌ها رفتار را از طریق slotها اضافه می‌کنند:

| Slot | قابلیت | حداقل Permission |
|---|---|---|
| Command | Command palette و automation action. | <bdi dir="ltr">`read`</bdi> |
| Renderer extension | تبدیل Markdown preview. | <bdi dir="ltr">`read`</bdi> |
| Export profile | export target یا template جدید. | <bdi dir="ltr">`system`</bdi> |
| MCP tool | رابط AI/tooling. | <bdi dir="ltr">`read`</bdi> |
| Inspector widget | widget مربوط به note/vault در پنل راست. | <bdi dir="ltr">`read`</bdi> |
| Vault health check | قانون diagnostics. | <bdi dir="ltr">`read`</bdi> |
| Canvas tool | action نوار ابزار Canvas بدون مرز. | <bdi dir="ltr">`read`</bdi> |
| Canvas block | block renderer ثبت‌شده برای حالت Canvas. | <bdi dir="ltr">`read`</bdi> |
| Template pack | layout شروع برای document یا Canvas. | <bdi dir="ltr">`read`</bdi> |

## مدل Permission

| Permission | معنا |
|---|---|
| <bdi dir="ltr">`read`</bdi> | می‌تواند command contractهای تأییدشده را query کند. |
| <bdi dir="ltr">`write-approved`</bdi> | می‌تواند writeهایی پیشنهاد دهد که نیاز به تأیید دارند. |
| <bdi dir="ltr">`system`</bdi> | می‌تواند cache/job مشتق را بدون تغییر فایل canonical استفاده کند. |
| <bdi dir="ltr">`dangerous`</bdi> | به هشدار صریح هنگام نصب و تأیید هنگام اجرا نیاز دارد. |
| <bdi dir="ltr">`network`</bdi> | پیش‌فرض مسدود است و با allowlist میزبان باز می‌شود. |
| <bdi dir="ltr">`secrets`</bdi> | فقط از طریق keychain handle نام‌گذاری‌شده قابل دسترسی است. |
| <bdi dir="ltr">`external-process`</bdi> | تا زمانی که policy مربوط به plugin sandbox وجود نداشته باشد غیرفعال است. |

## نامزدهای افزونه First-party

| Plugin | ارزش | Slots |
|---|---|---|
| <bdi dir="ltr">`scriptor-citation-tools`</bdi> | CSL، bibliography و health check برای citation گم‌شده. | inspector widget, health check, export profile |
| <bdi dir="ltr">`scriptor-graph-lens`</bdi> | filter پیشرفته graph و گزارش centrality note. | inspector widget, command |
| <bdi dir="ltr">`scriptor.publish-pack`</bdi> | template انتشار و export profile. | export profile, renderer extension |
| <bdi dir="ltr">`scriptor-vault-lint`</bdi> | قوانین broken link، frontmatter نامعتبر و note stale. | health check, command |
| <bdi dir="ltr">`scriptor-mcp-research`</bdi> | ابزار read-only دستیار پژوهش. | MCP tool, command |
| <bdi dir="ltr">`scriptor.canvas-kit`</bdi> | sticky note، shape، connector و template برد پژوهشی. | canvas tool, canvas block, template pack |

## دروازه‌های ایمنی

- <bdi dir="ltr">manifest</bdi> افزونه پیش از load با schema اعتبارسنجی می‌شود.
- تغییر permission نیاز به تأیید کاربر دارد.
- <bdi dir="ltr">command</bdi>های افزونه از همان command bus مربوط به UI و CLI عبور می‌کنند.
- <bdi dir="ltr">widget</bdi>های افزونه فقط scoped data دریافت می‌کنند و هرگز raw vault handle نمی‌گیرند.
- <bdi dir="ltr">renderer</bdi> extensionها ورودی sanitized دریافت می‌کنند.
- خرابی افزونه باعث disable شدن همان افزونه می‌شود و shell برنامه را crash نمی‌کند.
- <bdi dir="ltr">Safe</bdi> mode با همه افزونه‌ها در حالت disabled شروع می‌شود.

## قابلیت‌های عرضه‌شده

| قابلیت | محل |
|---|---|
| Manifest schema | <bdi dir="ltr">`@scriptor/core/contracts/plugin`</bdi> |
| Contribution registry + safe mode | <bdi dir="ltr">`packages/plugin-api`</bdi> |
| Bundled marketplace catalog | <bdi dir="ltr">`packages/plugin-api/catalog.json`, `src/marketplace.ts`</bdi> |
| Remote catalog merge | <bdi dir="ltr">`loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`)</bdi> |
| First-party plugins | <bdi dir="ltr">`scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack`</bdi> |
| Plugin panel UI | <bdi dir="ltr">`src/components/PluginPanel.tsx`</bdi> |
| MCP read-only plugin slot | <bdi dir="ltr">`packages/mcp`</bdi> |

</div>


</div>
