<div dir="ltr" align="center">

[English](AUTHOR_GUIDE.md) · **فارسی** · [简体中文](AUTHOR_GUIDE.zh-CN.md) · [Русский](AUTHOR_GUIDE.ru.md) · [Deutsch](AUTHOR_GUIDE.de.md) · [Español](AUTHOR_GUIDE.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای نویسندگان <bdi dir="ltr">Plugin</bdi>

مرجع کامل برای ساخت <bdi dir="ltr">plugin</bdi> در <bdi dir="ltr">Scriptor.</bdi>

## شروع سریع

برای یک <bdi dir="ltr">plugin</bdi> حداقلی و عملی به [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) مراجعه کنید.

---

## ۱. <bdi dir="ltr">Manifest</bdi> مربوط به <bdi dir="ltr">Plugin</bdi>

هر <bdi dir="ltr">plugin</bdi> یک <bdi dir="ltr">object</bdi> از نوع `PluginManifest` <bdi dir="ltr">export</bdi> می‌کند. <bdi dir="ltr">manifest</bdi> هویت، <bdi dir="ltr">lifecycle</bdi>، <bdi dir="ltr">capability</bdi>ها، <bdi dir="ltr">permission</bdi>ها و <bdi dir="ltr">contribution</bdi>های <bdi dir="ltr">plugin</bdi> را اعلام می‌کند.

</div>

<div dir="ltr" align="left">

```ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const myManifest: PluginManifest = {
  id: 'acme.my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  publisher: 'Acme',
  description: 'What this plugin does.',
  activation: ['manual'],
  capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read vault metadata.' }],
  contributes: { /* ... */ },
}
```

</div>

<div dir="rtl" lang="fa" align="right">

### فیلدها

| فیلد | نوع | اجباری | توضیح |
|---|---|---|---|
| `id` | `string` | بله | شناسه یکتای <bdi dir="ltr">plugin.</bdi> [قواعد نام‌گذاری](#۷-قواعد-نامگذاری-plugin-id) را ببینید. |
| `name` | `string` | بله | نام خوانا برای نمایش به کاربر. |
| `version` | `string` | بله | نسخه <bdi dir="ltr">semver.</bdi> |
| `apiVersion` | `string` | خیر | نسخه <bdi dir="ltr">Plugin API.</bdi> در صورت حذف، نسخه فعلی <bdi dir="ltr">host</bdi> استفاده می‌شود. [قرارداد <bdi dir="ltr">API</bdi> نسخه <bdi dir="ltr">V1</bdi>](#۸-قرارداد-api-v1) را ببینید. |
| `publisher` | `string` | بله | نام نویسنده یا سازمان. |
| `description` | `string` | بله | توضیح کوتاه <bdi dir="ltr">plugin.</bdi> |
| `activation` | `PluginActivation[]` | بله | زمان <bdi dir="ltr">load</bdi> شدن <bdi dir="ltr">plugin.</bdi> |
| `capabilities` | `PluginCapability[]` | بله | نوع <bdi dir="ltr">capability</bdi>هایی که <bdi dir="ltr">plugin</bdi> استفاده می‌کند. |
| `permissions` | `PluginPermission[]` | بله | دسترسی موردنیاز به داده یا <bdi dir="ltr">resource.</bdi> |
| `contributes` | `PluginContributions` | خیر | <bdi dir="ltr">slot</bdi>های <bdi dir="ltr">contribution</bdi> مانند <bdi dir="ltr">command</bdi> و <bdi dir="ltr">widget.</bdi> |

### <bdi dir="ltr">policy</bdi>های <bdi dir="ltr">activation</bdi>

| مقدار | رفتار |
|---|---|
| `'manual'` | کاربر باید <bdi dir="ltr">plugin</bdi> را صریحاً فعال یا <bdi dir="ltr">invoke</bdi> کند. |
| `'on-startup'` | <bdi dir="ltr">plugin</bdi> هنگام <bdi dir="ltr">startup</bdi> در <bdi dir="ltr">Scriptor load</bdi> می‌شود. |
| `'on-vault-open'` | <bdi dir="ltr">plugin</bdi> هنگام باز شدن <bdi dir="ltr">vault load</bdi> می‌شود. |

یک <bdi dir="ltr">plugin</bdi> می‌تواند چند <bdi dir="ltr">policy</bdi> برای <bdi dir="ltr">activation</bdi> اعلام کند؛ نخستین <bdi dir="ltr">policy</bdi> که <bdi dir="ltr">match</bdi> شود <bdi dir="ltr">load</bdi> را <bdi dir="ltr">trigger</bdi> می‌کند.

---

## ۲. نوع‌های <bdi dir="ltr">Capability</bdi>

<bdi dir="ltr">capability</bdi>ها در آرایه `capabilities` اعلام می‌شوند. هر <bdi dir="ltr">capability</bdi>، <bdi dir="ltr">contribution slot</bdi>های مشخصی را فعال می‌کند.

### ۲.۱ `command`

<bdi dir="ltr">command</bdi> را در <bdi dir="ltr">command palette</bdi> ثبت می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['command'],
contributes: {
  commands: [
    {
      commandId: 'acme.greet',
      label: 'Say Hello',
      category: 'Tools',
      permission: 'read',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `commandId` | `string` | شناسه یکتای نقطه‌دار <bdi dir="ltr">command.</bdi> |
| `label` | `string` | نام نمایشی در <bdi dir="ltr">command palette.</bdi> |
| `category` | `string` | گروهی مانند `Vault`، `Export` یا `Tools`. |
| `permission` | `CommandPermission` | حداقل <bdi dir="ltr">permission:</bdi> یکی از `read`، `write-approved`، `system` یا `dangerous`. |

### ۲.۲ `renderer-extension`

<bdi dir="ltr">preview</bdi> <bdi dir="ltr">renderer</bdi> مربوط به <bdi dir="ltr">Markdown</bdi> را با <bdi dir="ltr">transformation</bdi> سفارشی گسترش می‌دهد.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['renderer-extension'],
contributes: {
  rendererExtensions: [
    {
      id: 'acme-callout',
      label: 'Custom callout',
      handles: 'block',
      priority: 10,
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">extension.</bdi> |
| `label` | `string` | نام نمایشی. |
| `handles` | `'block' \| 'inline' \| 'document'` | <bdi dir="ltr">scope</bdi> مربوط به <bdi dir="ltr">transformation.</bdi> |
| `priority` | `number` | عدد کوچک‌تر زودتر اجرا می‌شود. |

### ۲.۳ `export-profile`

فرمت یا <bdi dir="ltr">template</bdi> جدید برای <bdi dir="ltr">export</bdi> اضافه می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['export-profile'],
contributes: {
  exportProfiles: [
    {
      id: 'acme-html',
      label: 'Acme HTML',
      format: 'html',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">profile.</bdi> |
| `label` | `string` | نام نمایشی در <bdi dir="ltr">dialog</bdi> مربوط به <bdi dir="ltr">export.</bdi> |
| `format` | `ExportFormat` | فرمت <bdi dir="ltr">target</bdi> مانند `html`، `pdf` یا `wechat-html`. |

### ۲.۴ `mcp-tool`

<bdi dir="ltr">tool</bdi> را برای لایه <bdi dir="ltr">MCP</bdi> یا <bdi dir="ltr">Model Context Protocol</bdi> و <bdi dir="ltr">integration</bdi>های <bdi dir="ltr">AI</bdi> ارائه می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['mcp-tool'],
contributes: {
  mcpTools: [
    {
      name: 'vault_search',
      label: 'Search vault notes',
      modeRequired: 'read',
      commandId: 'acme.search',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `name` | `string` | نام <bdi dir="ltr">tool</bdi> که از طریق <bdi dir="ltr">MCP expose</bdi> می‌شود. |
| `label` | `string` | <bdi dir="ltr">label</bdi> خوانا. |
| `modeRequired` | `McpMode` | <bdi dir="ltr">mode</bdi> موردنیاز <bdi dir="ltr">MCP</bdi> مانند `read`. |
| `commandId` | `string` | <bdi dir="ltr">command</bdi>ی که <bdi dir="ltr">tool</bdi> را پیاده‌سازی می‌کند. |

### ۲.۵ `inspector-widget`

<bdi dir="ltr">panel</bdi> را به <bdi dir="ltr">sidebar</bdi> مربوط به <bdi dir="ltr">Inspector</bdi> اضافه می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['inspector-widget'],
contributes: {
  inspectorWidgets: [
    {
      id: 'acme-stats',
      label: 'Note Statistics',
      placement: 'note',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">widget.</bdi> |
| `label` | `string` | نام نمایشی. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | محلی که <bdi dir="ltr">widget</bdi> نمایش داده می‌شود. |

### ۲.۶ `vault-health-check`

<bdi dir="ltr">rule</bdi> تشخیصی برای گزارش <bdi dir="ltr">health</bdi> مربوط به <bdi dir="ltr">vault</bdi> تعریف می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['vault-health-check'],
contributes: {
  vaultHealthChecks: [
    {
      id: 'acme-broken-refs',
      label: 'Broken references',
      severity: 'warning',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">check.</bdi> |
| `label` | `string` | نام نمایشی در <bdi dir="ltr">health report.</bdi> |
| `severity` | `'info' \| 'warning' \| 'error'` | سطح <bdi dir="ltr">severity.</bdi> |

### ۲.۷ `canvas-tool`

<bdi dir="ltr">tool</bdi> را به <bdi dir="ltr">toolbar</bdi> مربوط به <bdi dir="ltr">Canvas</bdi> اضافه می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['canvas-tool'],
contributes: {
  canvasTools: [
    {
      id: 'acme-sticky',
      label: 'Sticky Note',
      commandId: 'canvas.place-sticky',
      toolKind: 'place',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">tool.</bdi> |
| `label` | `string` | <bdi dir="ltr">label</bdi> در <bdi dir="ltr">toolbar.</bdi> |
| `commandId` | `string` | <bdi dir="ltr">command</bdi> پیاده‌ساز. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | دسته رفتار <bdi dir="ltr">tool.</bdi> |

### ۲.۸ `canvas-block`

<bdi dir="ltr">renderer</bdi> سفارشی <bdi dir="ltr">block</bdi> برای <bdi dir="ltr">Canvas</bdi> ثبت می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['canvas-block'],
contributes: {
  canvasBlocks: [
    {
      id: 'acme-chart-block',
      label: 'Chart Block',
      blockKind: 'markdown',
      rendererId: 'acme-chart-renderer',
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">block.</bdi> |
| `label` | `string` | نام نمایشی. |
| `blockKind` | `CanvasBlockKind` | نوع <bdi dir="ltr">block</bdi> مانند `markdown` یا `image`. |
| `rendererId` | `string` | <bdi dir="ltr">ID</bdi> مربوط به <bdi dir="ltr">renderer.</bdi> |

### ۲.۹ `template-pack`

<bdi dir="ltr">template</bdi>های <bdi dir="ltr">starter</bdi> برای <bdi dir="ltr">document</bdi> یا <bdi dir="ltr">Canvas</bdi> را <bdi dir="ltr">bundle</bdi> می‌کند.

</div>

<div dir="ltr" align="left">

```ts
capabilities: ['template-pack'],
contributes: {
  templatePacks: [
    {
      id: 'acme-research-board',
      label: 'Research Board',
      categories: ['research'],
      canvasCompatible: true,
      documentCompatible: false,
    },
  ],
},
```

</div>

<div dir="rtl" lang="fa" align="right">

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `string` | شناسه یکتای <bdi dir="ltr">template.</bdi> |
| `label` | `string` | نام نمایشی. |
| `categories` | `string[]` | <bdi dir="ltr">tag</bdi>های <bdi dir="ltr">category</bdi> برای <bdi dir="ltr">filter.</bdi> |
| `canvasCompatible` | `boolean` | در <bdi dir="ltr">Canvas</bdi> قابل استفاده است یا نه. |
| `documentCompatible` | `boolean` | در <bdi dir="ltr">document mode</bdi> قابل استفاده است یا نه. |

---

## ۳. مدل <bdi dir="ltr">Permission</bdi>

هر <bdi dir="ltr">plugin</bdi> باید <bdi dir="ltr">permission</bdi>های موردنیاز را همراه با <bdi dir="ltr">reason</bdi> قابل‌فهم برای انسان اعلام کند.

</div>

<div dir="ltr" align="left">

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Permission</bdi>های موجود

| <bdi dir="ltr">Permission</bdi> | <bdi dir="ltr">Scope</bdi> |
|---|---|
| `read` | <bdi dir="ltr">query</bdi> کردن <bdi dir="ltr">contract</bdi>های <bdi dir="ltr">command</bdi> تأییدشده و <bdi dir="ltr">metadata</bdi> مربوط به <bdi dir="ltr">vault.</bdi> |
| `write-approved` | پیشنهاد <bdi dir="ltr">write</bdi>هایی که <bdi dir="ltr">confirmation</bdi> کاربر لازم دارند. |
| `system` | استفاده از <bdi dir="ltr">cache</bdi>های مشتق‌شده و <bdi dir="ltr">background job</bdi> بدون تغییر فایل <bdi dir="ltr">canonical.</bdi> |
| `dangerous` | <bdi dir="ltr">warning</bdi> صریح هنگام نصب + <bdi dir="ltr">confirmation</bdi> در <bdi dir="ltr">runtime.</bdi> تا زمانی که <bdi dir="ltr">sandbox policy</bdi> موجود نیست **باید `optional: true` باشد**. |
| `network` | دسترسی <bdi dir="ltr">HTTP.</bdi> به‌صورت <bdi dir="ltr">default</bdi> مسدود است و <bdi dir="ltr">host allowlist</bdi> را مدیریت می‌کند. |

### <bdi dir="ltr">Permission</bdi>های مسدودشده در <bdi dir="ltr">v1</bdi>

| <bdi dir="ltr">Permission</bdi> | دلیل |
|---|---|
| `external-process` | تا زمان پیاده‌سازی <bdi dir="ltr">plugin sandbox policy</bdi> در دسترس نیست. |
| `secrets` | تا زمان پیاده‌سازی <bdi dir="ltr">named keychain handle</bdi> در دسترس نیست. |

استفاده از <bdi dir="ltr">permission</bdi> مسدودشده باعث <bdi dir="ltr">failure</bdi> در <bdi dir="ltr">validation manifest</bdi> می‌شود.

### دلیل <bdi dir="ltr">Permission</bdi>

هر <bdi dir="ltr">permission entry</bdi> **باید** `reason` غیرخالی داشته باشد. این متن هنگام نصب به کاربر نمایش داده می‌شود تا تصمیم آگاهانه بگیرد.

</div>

<div dir="ltr" align="left">

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">flag</bdi> مربوط به `optional`

<bdi dir="ltr">permission</bdi> از نوع `dangerous` باید `optional: true` داشته باشد؛ یعنی <bdi dir="ltr">plugin</bdi> بدون آن هم کار می‌کند و فقط هنگام نیاز واقعی در <bdi dir="ltr">runtime</bdi> آن را درخواست می‌کند.

</div>

<div dir="ltr" align="left">

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

</div>

<div dir="rtl" lang="fa" align="right">

---

## ۴. <bdi dir="ltr">Safe Mode</bdi>

وقتی <bdi dir="ltr">Scriptor</bdi> در <bdi dir="ltr">safe mode</bdi> شروع می‌شود:

- **همه <bdi dir="ltr">plugin</bdi>ها** در سطح <bdi dir="ltr">registry</bdi> غیرفعال‌اند.
- تا وقتی <bdi dir="ltr">safe mode</bdi> فعال است، <bdi dir="ltr">plugin</bdi> منفرد را **نمی‌توان دوباره فعال کرد**.
- <bdi dir="ltr">failure</bdi>های <bdi dir="ltr">plugin</bdi> از <bdi dir="ltr">session</bdi> قبلی پاک می‌شوند.
- <bdi dir="ltr">safe</bdi> <bdi dir="ltr">mode</bdi> مکانیسم <bdi dir="ltr">recovery</bdi> برای <bdi dir="ltr">instability</bdi> ناشی از <bdi dir="ltr">plugin</bdi> است.

</div>

<div dir="ltr" align="left">

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

</div>

<div dir="rtl" lang="fa" align="right">

کاربر می‌تواند <bdi dir="ltr">safe mode</bdi> را از <bdi dir="ltr">panel</bdi> تنظیمات <bdi dir="ltr">plugin</bdi> تغییر دهد.

---

## ۵. <bdi dir="ltr">Plugin</bdi> نمونه <bdi dir="ltr">Hello World</bdi>، مرحله‌به‌مرحله

### مرحله ۱: ساخت دایرکتوری

</div>

<div dir="ltr" align="left">

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

</div>

<div dir="rtl" lang="fa" align="right">

### مرحله ۲: نوشتن `package.json`

</div>

<div dir="ltr" align="left">

```json
{
  "name": "@scriptor/plugin-hello-world",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@scriptor/core": "workspace:*"
  }
}
```

</div>

<div dir="rtl" lang="fa" align="right">

### مرحله ۳: نوشتن <bdi dir="ltr">manifest</bdi>

</div>

<div dir="ltr" align="left">

```ts
// src/manifest.ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const helloWorldManifest: PluginManifest = {
  id: 'hello-world',
  name: 'Hello World',
  version: '1.0.0',
  publisher: 'Example',
  description: 'Minimal example plugin that registers a greeting command.',
  activation: ['manual'],
  capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read note metadata for the greeting.' }],
  contributes: {
    commands: [
      {
        commandId: 'hello.greet',
        label: 'Hello World: Greet',
        category: 'Tools',
        permission: 'read',
      },
    ],
  },
}
```

</div>

<div dir="rtl" lang="fa" align="right">

### مرحله ۴: نوشتن <bdi dir="ltr">entry point</bdi>

</div>

<div dir="ltr" align="left">

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

</div>

<div dir="rtl" lang="fa" align="right">

### مرحله ۵: <bdi dir="ltr">validation</bdi>

</div>

<div dir="ltr" align="left">

```sh
pnpm check:plugins
```

</div>

<div dir="rtl" lang="fa" align="right">

این <bdi dir="ltr">command</bdi> برای همه <bdi dir="ltr">plugin</bdi>ها <bdi dir="ltr">manifest validation</bdi>، <bdi dir="ltr">sandbox test</bdi> و <bdi dir="ltr">registry test</bdi> را اجرا می‌کند و <bdi dir="ltr">manifest</bdi> نامعتبر را همراه دلیل گزارش می‌دهد.

---

## ۶. <bdi dir="ltr">Contribution</bdi>ها چگونه کار می‌کنند

| <bdi dir="ltr">Capability</bdi> | <bdi dir="ltr">Contribution slot</bdi> |
|---|---|
| `command` | `commands` |
| `renderer-extension` | `rendererExtensions` |
| `export-profile` | `exportProfiles` |
| `mcp-tool` | `mcpTools` |
| `inspector-widget` | `inspectorWidgets` |
| `vault-health-check` | `vaultHealthChecks` |
| `canvas-tool` | `canvasTools` |
| `canvas-block` | `canvasBlocks` |
| `template-pack` | `templatePacks` |

**قاعده:** اگر <bdi dir="ltr">contribution slot</bdi> دارای <bdi dir="ltr">entry</bdi> باشد باید <bdi dir="ltr">capability</bdi> متناظر اعلام شود. مثلاً وجود `mcpTools` بدون `mcp-tool` در `capabilities` باعث <bdi dir="ltr">failure</bdi> در <bdi dir="ltr">validation</bdi> می‌شود.

`collectContributions()` هنگام <bdi dir="ltr">startup contribution</bdi>های همه <bdi dir="ltr">plugin</bdi>های <bdi dir="ltr">enabled</bdi> را برای هر <bdi dir="ltr">slot</bdi> در یک آرایه <bdi dir="ltr">flat merge</bdi> می‌کند. سپس <bdi dir="ltr">host</bdi> آن‌ها را به <bdi dir="ltr">command bus</bdi>، <bdi dir="ltr">renderer</bdi>، <bdi dir="ltr">export pipeline</bdi> و سایر بخش‌ها می‌دهد.

---

## ۷. قواعد نام‌گذاری <bdi dir="ltr">Plugin ID</bdi>

<bdi dir="ltr">Plugin</bdi> <bdi dir="ltr">ID</bdi> باید با `^[a-z0-9][a-z0-9.-]*$` <bdi dir="ltr">match</bdi> شود:

- فقط حروف **<bdi dir="ltr">lowercase</bdi>**، رقم، نقطه و <bdi dir="ltr">hyphen.</bdi>
- شروع با حرف <bdi dir="ltr">lowercase</bdi> یا رقم.
- بدون <bdi dir="ltr">underscore</bdi>، حرف <bdi dir="ltr">uppercase</bdi> یا فاصله.
- نقطه برای جداسازی <bdi dir="ltr">namespace</bdi> استفاده می‌شود.

</div>

<div dir="ltr" align="left">

```
✅ hello-world
✅ scriptor.canvas-kit
✅ acme.my-plugin
✅ my.plugin.v2
❌ My-Plugin        (uppercase)
❌ _hidden           (starts with underscore)
❌ my_plugin         (underscore)
❌ -leading-dash     (starts with hyphen)
```

</div>

<div dir="rtl" lang="fa" align="right">

پیشنهاد می‌شود برای جلوگیری از <bdi dir="ltr">collision</bdi> از نام سازمان به‌عنوان <bdi dir="ltr">prefix</bdi> مانند `scriptor.*` یا `acme.*` استفاده کنید.

---

## ۸. قرارداد <bdi dir="ltr">API V1</bdi>

نسخه فعلی <bdi dir="ltr">Plugin API</bdi> برابر **1.0.0** است.

- اگر `apiVersion` حذف شود نسخه <bdi dir="ltr">host</bdi> استفاده می‌شود.
- نسخه <bdi dir="ltr">API</bdi> باید دقیقاً `1.0.0` باشد.
- مقدار دیگر رد می‌شود؛ <bdi dir="ltr">host</bdi> هیچ <bdi dir="ltr">compatibility adapter</bdi>ی <bdi dir="ltr">load</bdi> نمی‌کند.

</div>

<div dir="ltr" align="left">

```ts
// Valid — exact current contract
apiVersion: '1.0.0'

// Invalid — not the current contract
apiVersion: '1.0.1'  // ❌ fails validation
```

</div>

<div dir="rtl" lang="fa" align="right">

هر نسخه جدید محصول، قرارداد دقیق <bdi dir="ltr">Plugin API</bdi> خودش را منتشر می‌کند.

---

## ۹. تست <bdi dir="ltr">Plugin</bdi>

### اجرای <bdi dir="ltr">validation</bdi>

</div>

<div dir="ltr" align="left">

```sh
pnpm check:plugins
```

</div>

<div dir="rtl" lang="fa" align="right">

این <bdi dir="ltr">command</bdi> موارد زیر را اجرا می‌کند:

1. **<bdi dir="ltr">Manifest validation</bdi>** — <bdi dir="ltr">schema</bdi>، <bdi dir="ltr">pattern</bdi> مربوط به <bdi dir="ltr">ID</bdi>، فیلدهای <bdi dir="ltr">required</bdi>، <bdi dir="ltr">capability</bdi> و <bdi dir="ltr">permission.</bdi>
2. **<bdi dir="ltr">Registry tests</bdi>** — <bdi dir="ltr">safe mode</bdi>، <bdi dir="ltr">enable/disable</bdi> و صحت <bdi dir="ltr">snapshot.</bdi>
3. **<bdi dir="ltr">Sandbox tests</bdi>** — <bdi dir="ltr">capability</bdi>های مسدود و رفتار <bdi dir="ltr">plugin</bdi> غیرفعال.
4. **<bdi dir="ltr">Host sandbox tests</bdi>** — دسترسی <bdi dir="ltr">raw</bdi> به <bdi dir="ltr">filesystem</bdi> رد می‌شود.
5. **<bdi dir="ltr">WASM host tests</bdi>** — <bdi dir="ltr">validation</bdi> مربوط به <bdi dir="ltr">manifest</bdi>های <bdi dir="ltr">plugin</bdi> در <bdi dir="ltr">WASM.</bdi>
6. **<bdi dir="ltr">Marketplace catalog</bdi>** — <bdi dir="ltr">catalog bundled</bdi> نباید خالی باشد.

در صورت <bdi dir="ltr">failure</bdi>، <bdi dir="ltr">command</bdi> با <bdi dir="ltr">code</bdi> برابر 1 تمام می‌شود و دلیل را چاپ می‌کند.

### <bdi dir="ltr">checklist</bdi> تست دستی

- [ ] <bdi dir="ltr">manifest</bdi> بدون <bdi dir="ltr">error</bdi> از `validatePluginManifest()` عبور می‌کند.
- [ ] <bdi dir="ltr">plugin load</bdi> می‌شود و در <bdi dir="ltr">registry</bdi> دیده می‌شود.
- [ ] <bdi dir="ltr">command</bdi>ها در <bdi dir="ltr">category</bdi> درست <bdi dir="ltr">command palette</bdi> نمایش داده می‌شوند.
- [ ] <bdi dir="ltr">permission</bdi>ها هنگام <bdi dir="ltr">install</bdi> به‌درستی نمایش داده می‌شوند.
- [ ] <bdi dir="ltr">plugin</bdi> بدون <bdi dir="ltr">crash</bdi> کردن <bdi dir="ltr">host</bdi> به‌شکل <bdi dir="ltr">clean disable</bdi> می‌شود.
- [ ] <bdi dir="ltr">safe mode</bdi> مانع <bdi dir="ltr">load</bdi> شدن <bdi dir="ltr">plugin</bdi> می‌شود.

---

## ۱۰. <bdi dir="ltr">Manifest</bdi>های نمونه

مقدارهای <bdi dir="ltr">executable</bdi> در نمونه‌های <bdi dir="ltr">JSON</bdi> عمداً ترجمه نشده‌اند تا با <bdi dir="ltr">contract canonical API</bdi> دقیقاً قابل مقایسه و <bdi dir="ltr">copy</bdi> باشند.

### <bdi dir="ltr">Command Plugin</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.word-count","name":"Word Count","version":"1.0.0","publisher":"Acme","description":"Count words in the current note.","activation":["manual"],"capabilities":["command"],"permissions":[{"permission":"read","reason":"Read current note content."}],"contributes":{"commands":[{"commandId":"acme.word-count.run","label":"Count Words","category":"Tools","permission":"read"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Renderer Extension</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.markmap","name":"Markmap Renderer","version":"1.0.0","publisher":"Acme","description":"Render markdown headings as a mind map in preview.","activation":["on-vault-open"],"capabilities":["renderer-extension"],"permissions":[{"permission":"read","reason":"Read note headings for mind map generation."}],"contributes":{"rendererExtensions":[{"id":"markmap-view","label":"Markmap mind map","handles":"document","priority":20}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Export Profile</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme-latex-export","name":"LaTeX Export","version":"1.0.0","publisher":"Acme","description":"Export notes as LaTeX documents.","activation":["manual"],"capabilities":["export-profile"],"permissions":[{"permission":"read","reason":"Read note content for LaTeX conversion."}],"contributes":{"exportProfiles":[{"id":"latex-export","label":"LaTeX (.tex)","format":"html"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">MCP Tool</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.mcp-search","name":"MCP Search","version":"1.0.0","publisher":"Acme","description":"Expose vault search as an MCP tool.","activation":["on-startup"],"capabilities":["mcp-tool","command"],"permissions":[{"permission":"read","reason":"Search vault notes via MCP interface."}],"contributes":{"mcpTools":[{"name":"vault_search","label":"Search vault","modeRequired":"read","commandId":"acme.mcp-search.run"}],"commands":[{"commandId":"acme.mcp-search.run","label":"Search Vault (MCP)","category":"Tools","permission":"read"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Inspector Widget</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.outliner","name":"Note Outliner","version":"1.0.0","publisher":"Acme","description":"Show a heading outline in the inspector.","activation":["on-vault-open"],"capabilities":["inspector-widget"],"permissions":[{"permission":"read","reason":"Read note headings for the outline widget."}],"contributes":{"inspectorWidgets":[{"id":"heading-outline","label":"Heading Outline","placement":"note"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Vault Health Check</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.frontmatter-lint","name":"Frontmatter Lint","version":"1.0.0","publisher":"Acme","description":"Check for missing or invalid YAML frontmatter.","activation":["on-vault-open"],"capabilities":["vault-health-check"],"permissions":[{"permission":"read","reason":"Read frontmatter fields for validation."}],"contributes":{"vaultHealthChecks":[{"id":"missing-frontmatter","label":"Missing frontmatter","severity":"warning"},{"id":"invalid-yaml","label":"Invalid YAML syntax","severity":"error"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Canvas Tool</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.canvas-shapes","name":"Canvas Shapes","version":"1.0.0","publisher":"Acme","description":"Extra shape tools for the canvas.","activation":["on-startup"],"capabilities":["canvas-tool"],"permissions":[{"permission":"read","reason":"Read canvas state for shape placement."}],"contributes":{"canvasTools":[{"id":"circle","label":"Circle","commandId":"canvas.circle","toolKind":"shape"},{"id":"arrow","label":"Arrow","commandId":"canvas.arrow","toolKind":"connector"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Canvas Block</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.kanban","name":"Kanban Block","version":"1.0.0","publisher":"Acme","description":"Kanban board block for canvas mode.","activation":["on-vault-open"],"capabilities":["canvas-block"],"permissions":[{"permission":"read","reason":"Read card data for kanban rendering."}],"contributes":{"canvasBlocks":[{"id":"kanban-board","label":"Kanban Board","blockKind":"markdown","rendererId":"acme-kanban"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Template Pack</bdi>

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.templates","name":"Starter Templates","version":"1.0.0","publisher":"Acme","description":"Document and canvas starter templates.","activation":["on-startup"],"capabilities":["template-pack"],"permissions":[{"permission":"read","reason":"Read template content for instantiation."}],"contributes":{"templatePacks":[{"id":"weekly-journal","label":"Weekly Journal","categories":["journal"],"canvasCompatible":false,"documentCompatible":true},{"id":"mood-board","label":"Mood Board","categories":["creative"],"canvasCompatible":true,"documentCompatible":false}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

---

## <bdi dir="ltr">Plugin</bdi>های مرجع

| <bdi dir="ltr">Plugin</bdi> | <bdi dir="ltr">Path</bdi> | <bdi dir="ltr">Capability</bdi> |
|---|---|---|
| <bdi dir="ltr">Hello World</bdi> | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| <bdi dir="ltr">Canvas Kit</bdi> | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| <bdi dir="ltr">Publish Pack</bdi> | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| <bdi dir="ltr">Vault Lint</bdi> | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| <bdi dir="ltr">PDF Translate</bdi> | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## ارجاع به <bdi dir="ltr">Source</bdi>

- <bdi dir="ltr">manifest schema:</bdi> `packages/core/src/contracts/plugin.ts`
- <bdi dir="ltr">validation logic:</bdi> `packages/plugin-api/src/manifest.ts`
- <bdi dir="ltr">sandbox policy:</bdi> `packages/plugin-api/src/sandbox.ts`
- <bdi dir="ltr">plugin host:</bdi> `packages/plugin-api/src/host.ts`
- <bdi dir="ltr">plugin registry:</bdi> `packages/plugin-api/src/registry.ts`
- <bdi dir="ltr">contribution merging:</bdi> `packages/plugin-api/src/contributions.ts`

</div>
