<div dir="ltr" align="center">

[English](AUTHOR_GUIDE.md) · **فارسی** · [简体中文](AUTHOR_GUIDE.zh-CN.md) · [Русский](AUTHOR_GUIDE.ru.md) · [Deutsch](AUTHOR_GUIDE.de.md) · [Español](AUTHOR_GUIDE.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای نویسندگان Plugin

مرجع کامل برای ساخت plugin در Scriptor.

## شروع سریع

برای یک plugin حداقلی و عملی به [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) مراجعه کنید.

---

## ۱. Manifest مربوط به Plugin

هر plugin یک object از نوع `PluginManifest` export می‌کند. manifest هویت، lifecycle، capabilityها، permissionها و contributionهای plugin را اعلام می‌کند.

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
| `id` | `string` | بله | شناسه یکتای plugin. [قواعد نام‌گذاری](#۷-قواعد-نامگذاری-plugin-id) را ببینید. |
| `name` | `string` | بله | نام خوانا برای نمایش به کاربر. |
| `version` | `string` | بله | نسخه semver. |
| `apiVersion` | `string` | خیر | نسخه Plugin API. در صورت حذف، نسخه فعلی host استفاده می‌شود. [قرارداد API نسخه V1](#۸-قرارداد-api-v1) را ببینید. |
| `publisher` | `string` | بله | نام نویسنده یا سازمان. |
| `description` | `string` | بله | توضیح کوتاه plugin. |
| `activation` | `PluginActivation[]` | بله | زمان load شدن plugin. |
| `capabilities` | `PluginCapability[]` | بله | نوع capabilityهایی که plugin استفاده می‌کند. |
| `permissions` | `PluginPermission[]` | بله | دسترسی موردنیاز به داده یا resource. |
| `contributes` | `PluginContributions` | خیر | slotهای contribution مانند command و widget. |

### policyهای activation

| مقدار | رفتار |
|---|---|
| `'manual'` | کاربر باید plugin را صریحاً فعال یا invoke کند. |
| `'on-startup'` | plugin هنگام startup در Scriptor load می‌شود. |
| `'on-vault-open'` | plugin هنگام باز شدن vault load می‌شود. |

یک plugin می‌تواند چند policy برای activation اعلام کند؛ نخستین policy که match شود load را trigger می‌کند.

---

## ۲. نوع‌های Capability

capabilityها در آرایه `capabilities` اعلام می‌شوند. هر capability، contribution slotهای مشخصی را فعال می‌کند.

### ۲.۱ `command`

command را در command palette ثبت می‌کند.

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
| `commandId` | `string` | شناسه یکتای نقطه‌دار command. |
| `label` | `string` | نام نمایشی در command palette. |
| `category` | `string` | گروهی مانند `Vault`، `Export` یا `Tools`. |
| `permission` | `CommandPermission` | حداقل permission: یکی از `read`، `write-approved`، `system` یا `dangerous`. |

### ۲.۲ `renderer-extension`

preview renderer مربوط به Markdown را با transformation سفارشی گسترش می‌دهد.

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
| `id` | `string` | شناسه یکتای extension. |
| `label` | `string` | نام نمایشی. |
| `handles` | `'block' \| 'inline' \| 'document'` | scope مربوط به transformation. |
| `priority` | `number` | عدد کوچک‌تر زودتر اجرا می‌شود. |

### ۲.۳ `export-profile`

فرمت یا template جدید برای export اضافه می‌کند.

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
| `id` | `string` | شناسه یکتای profile. |
| `label` | `string` | نام نمایشی در dialog مربوط به export. |
| `format` | `ExportFormat` | فرمت target مانند `html`، `pdf` یا `wechat-html`. |

### ۲.۴ `mcp-tool`

tool را برای لایه MCP یا Model Context Protocol و integrationهای AI ارائه می‌کند.

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
| `name` | `string` | نام tool که از طریق MCP expose می‌شود. |
| `label` | `string` | label خوانا. |
| `modeRequired` | `McpMode` | mode موردنیاز MCP مانند `read`. |
| `commandId` | `string` | commandی که tool را پیاده‌سازی می‌کند. |

### ۲.۵ `inspector-widget`

panel را به sidebar مربوط به Inspector اضافه می‌کند.

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
| `id` | `string` | شناسه یکتای widget. |
| `label` | `string` | نام نمایشی. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | محلی که widget نمایش داده می‌شود. |

### ۲.۶ `vault-health-check`

rule تشخیصی برای گزارش health مربوط به vault تعریف می‌کند.

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
| `id` | `string` | شناسه یکتای check. |
| `label` | `string` | نام نمایشی در health report. |
| `severity` | `'info' \| 'warning' \| 'error'` | سطح severity. |

### ۲.۷ `canvas-tool`

tool را به toolbar مربوط به Canvas اضافه می‌کند.

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
| `id` | `string` | شناسه یکتای tool. |
| `label` | `string` | label در toolbar. |
| `commandId` | `string` | command پیاده‌ساز. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | دسته رفتار tool. |

### ۲.۸ `canvas-block`

renderer سفارشی block برای Canvas ثبت می‌کند.

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
| `id` | `string` | شناسه یکتای block. |
| `label` | `string` | نام نمایشی. |
| `blockKind` | `CanvasBlockKind` | نوع block مانند `markdown` یا `image`. |
| `rendererId` | `string` | ID مربوط به renderer. |

### ۲.۹ `template-pack`

templateهای starter برای document یا Canvas را bundle می‌کند.

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
| `id` | `string` | شناسه یکتای template. |
| `label` | `string` | نام نمایشی. |
| `categories` | `string[]` | tagهای category برای filter. |
| `canvasCompatible` | `boolean` | در Canvas قابل استفاده است یا نه. |
| `documentCompatible` | `boolean` | در document mode قابل استفاده است یا نه. |

---

## ۳. مدل Permission

هر plugin باید permissionهای موردنیاز را همراه با reason قابل‌فهم برای انسان اعلام کند.

</div>

<div dir="ltr" align="left">

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

</div>

<div dir="rtl" lang="fa" align="right">

### Permissionهای موجود

| Permission | Scope |
|---|---|
| `read` | query کردن contractهای command تأییدشده و metadata مربوط به vault. |
| `write-approved` | پیشنهاد writeهایی که confirmation کاربر لازم دارند. |
| `system` | استفاده از cacheهای مشتق‌شده و background job بدون تغییر فایل canonical. |
| `dangerous` | warning صریح هنگام نصب + confirmation در runtime. تا زمانی که sandbox policy موجود نیست **باید `optional: true` باشد**. |
| `network` | دسترسی HTTP. به‌صورت default مسدود است و host allowlist را مدیریت می‌کند. |

### Permissionهای مسدودشده در v1

| Permission | دلیل |
|---|---|
| `external-process` | تا زمان پیاده‌سازی plugin sandbox policy در دسترس نیست. |
| `secrets` | تا زمان پیاده‌سازی named keychain handle در دسترس نیست. |

استفاده از permission مسدودشده باعث failure در validation manifest می‌شود.

### دلیل Permission

هر permission entry **باید** `reason` غیرخالی داشته باشد. این متن هنگام نصب به کاربر نمایش داده می‌شود تا تصمیم آگاهانه بگیرد.

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

### flag مربوط به `optional`

permission از نوع `dangerous` باید `optional: true` داشته باشد؛ یعنی plugin بدون آن هم کار می‌کند و فقط هنگام نیاز واقعی در runtime آن را درخواست می‌کند.

</div>

<div dir="ltr" align="left">

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

</div>

<div dir="rtl" lang="fa" align="right">

---

## ۴. Safe Mode

وقتی Scriptor در safe mode شروع می‌شود:

- **همه pluginها** در سطح registry غیرفعال‌اند.
- تا وقتی safe mode فعال است، plugin منفرد را **نمی‌توان دوباره فعال کرد**.
- failureهای plugin از session قبلی پاک می‌شوند.
- safe mode مکانیسم recovery برای instability ناشی از plugin است.

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

کاربر می‌تواند safe mode را از panel تنظیمات plugin تغییر دهد.

---

## ۵. Plugin نمونه Hello World، مرحله‌به‌مرحله

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

### مرحله ۳: نوشتن manifest

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

### مرحله ۴: نوشتن entry point

</div>

<div dir="ltr" align="left">

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

</div>

<div dir="rtl" lang="fa" align="right">

### مرحله ۵: validation

</div>

<div dir="ltr" align="left">

```sh
pnpm check:plugins
```

</div>

<div dir="rtl" lang="fa" align="right">

این command برای همه pluginها manifest validation، sandbox test و registry test را اجرا می‌کند و manifest نامعتبر را همراه دلیل گزارش می‌دهد.

---

## ۶. Contributionها چگونه کار می‌کنند

| Capability | Contribution slot |
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

**قاعده:** اگر contribution slot دارای entry باشد باید capability متناظر اعلام شود. مثلاً وجود `mcpTools` بدون `mcp-tool` در `capabilities` باعث failure در validation می‌شود.

`collectContributions()` هنگام startup contributionهای همه pluginهای enabled را برای هر slot در یک آرایه flat merge می‌کند. سپس host آن‌ها را به command bus، renderer، export pipeline و سایر بخش‌ها می‌دهد.

---

## ۷. قواعد نام‌گذاری Plugin ID

Plugin ID باید با `^[a-z0-9][a-z0-9.-]*$` match شود:

- فقط حروف **lowercase**، رقم، نقطه و hyphen.
- شروع با حرف lowercase یا رقم.
- بدون underscore، حرف uppercase یا فاصله.
- نقطه برای جداسازی namespace استفاده می‌شود.

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

پیشنهاد می‌شود برای جلوگیری از collision از نام سازمان به‌عنوان prefix مانند `scriptor.*` یا `acme.*` استفاده کنید.

---

## ۸. قرارداد API V1

نسخه فعلی Plugin API برابر **1.0.0** است.

- اگر `apiVersion` حذف شود نسخه host استفاده می‌شود.
- نسخه API باید دقیقاً `1.0.0` باشد.
- مقدار دیگر رد می‌شود؛ host هیچ compatibility adapterی load نمی‌کند.

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

هر نسخه جدید محصول، قرارداد دقیق Plugin API خودش را منتشر می‌کند.

---

## ۹. تست Plugin

### اجرای validation

</div>

<div dir="ltr" align="left">

```sh
pnpm check:plugins
```

</div>

<div dir="rtl" lang="fa" align="right">

این command موارد زیر را اجرا می‌کند:

1. **Manifest validation** — schema، pattern مربوط به ID، فیلدهای required، capability و permission.
2. **Registry tests** — safe mode، enable/disable و صحت snapshot.
3. **Sandbox tests** — capabilityهای مسدود و رفتار plugin غیرفعال.
4. **Host sandbox tests** — دسترسی raw به filesystem رد می‌شود.
5. **WASM host tests** — validation مربوط به manifestهای plugin در WASM.
6. **Marketplace catalog** — catalog bundled نباید خالی باشد.

در صورت failure، command با code برابر 1 تمام می‌شود و دلیل را چاپ می‌کند.

### checklist تست دستی

- [ ] manifest بدون error از `validatePluginManifest()` عبور می‌کند.
- [ ] plugin load می‌شود و در registry دیده می‌شود.
- [ ] commandها در category درست command palette نمایش داده می‌شوند.
- [ ] permissionها هنگام install به‌درستی نمایش داده می‌شوند.
- [ ] plugin بدون crash کردن host به‌شکل clean disable می‌شود.
- [ ] safe mode مانع load شدن plugin می‌شود.

---

## ۱۰. Manifestهای نمونه

مقدارهای executable در نمونه‌های JSON عمداً ترجمه نشده‌اند تا با contract canonical API دقیقاً قابل مقایسه و copy باشند.

### Command Plugin

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.word-count","name":"Word Count","version":"1.0.0","publisher":"Acme","description":"Count words in the current note.","activation":["manual"],"capabilities":["command"],"permissions":[{"permission":"read","reason":"Read current note content."}],"contributes":{"commands":[{"commandId":"acme.word-count.run","label":"Count Words","category":"Tools","permission":"read"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Renderer Extension

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.markmap","name":"Markmap Renderer","version":"1.0.0","publisher":"Acme","description":"Render markdown headings as a mind map in preview.","activation":["on-vault-open"],"capabilities":["renderer-extension"],"permissions":[{"permission":"read","reason":"Read note headings for mind map generation."}],"contributes":{"rendererExtensions":[{"id":"markmap-view","label":"Markmap mind map","handles":"document","priority":20}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Export Profile

</div>

<div dir="ltr" align="left">

```json
{"id":"acme-latex-export","name":"LaTeX Export","version":"1.0.0","publisher":"Acme","description":"Export notes as LaTeX documents.","activation":["manual"],"capabilities":["export-profile"],"permissions":[{"permission":"read","reason":"Read note content for LaTeX conversion."}],"contributes":{"exportProfiles":[{"id":"latex-export","label":"LaTeX (.tex)","format":"html"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### MCP Tool

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.mcp-search","name":"MCP Search","version":"1.0.0","publisher":"Acme","description":"Expose vault search as an MCP tool.","activation":["on-startup"],"capabilities":["mcp-tool","command"],"permissions":[{"permission":"read","reason":"Search vault notes via MCP interface."}],"contributes":{"mcpTools":[{"name":"vault_search","label":"Search vault","modeRequired":"read","commandId":"acme.mcp-search.run"}],"commands":[{"commandId":"acme.mcp-search.run","label":"Search Vault (MCP)","category":"Tools","permission":"read"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Inspector Widget

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.outliner","name":"Note Outliner","version":"1.0.0","publisher":"Acme","description":"Show a heading outline in the inspector.","activation":["on-vault-open"],"capabilities":["inspector-widget"],"permissions":[{"permission":"read","reason":"Read note headings for the outline widget."}],"contributes":{"inspectorWidgets":[{"id":"heading-outline","label":"Heading Outline","placement":"note"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Vault Health Check

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.frontmatter-lint","name":"Frontmatter Lint","version":"1.0.0","publisher":"Acme","description":"Check for missing or invalid YAML frontmatter.","activation":["on-vault-open"],"capabilities":["vault-health-check"],"permissions":[{"permission":"read","reason":"Read frontmatter fields for validation."}],"contributes":{"vaultHealthChecks":[{"id":"missing-frontmatter","label":"Missing frontmatter","severity":"warning"},{"id":"invalid-yaml","label":"Invalid YAML syntax","severity":"error"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Canvas Tool

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.canvas-shapes","name":"Canvas Shapes","version":"1.0.0","publisher":"Acme","description":"Extra shape tools for the canvas.","activation":["on-startup"],"capabilities":["canvas-tool"],"permissions":[{"permission":"read","reason":"Read canvas state for shape placement."}],"contributes":{"canvasTools":[{"id":"circle","label":"Circle","commandId":"canvas.circle","toolKind":"shape"},{"id":"arrow","label":"Arrow","commandId":"canvas.arrow","toolKind":"connector"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Canvas Block

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.kanban","name":"Kanban Block","version":"1.0.0","publisher":"Acme","description":"Kanban board block for canvas mode.","activation":["on-vault-open"],"capabilities":["canvas-block"],"permissions":[{"permission":"read","reason":"Read card data for kanban rendering."}],"contributes":{"canvasBlocks":[{"id":"kanban-board","label":"Kanban Board","blockKind":"markdown","rendererId":"acme-kanban"}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

### Template Pack

</div>

<div dir="ltr" align="left">

```json
{"id":"acme.templates","name":"Starter Templates","version":"1.0.0","publisher":"Acme","description":"Document and canvas starter templates.","activation":["on-startup"],"capabilities":["template-pack"],"permissions":[{"permission":"read","reason":"Read template content for instantiation."}],"contributes":{"templatePacks":[{"id":"weekly-journal","label":"Weekly Journal","categories":["journal"],"canvasCompatible":false,"documentCompatible":true},{"id":"mood-board","label":"Mood Board","categories":["creative"],"canvasCompatible":true,"documentCompatible":false}]}}
```

</div>

<div dir="rtl" lang="fa" align="right">

---

## Pluginهای مرجع

| Plugin | Path | Capability |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## ارجاع به Source

- manifest schema: `packages/core/src/contracts/plugin.ts`
- validation logic: `packages/plugin-api/src/manifest.ts`
- sandbox policy: `packages/plugin-api/src/sandbox.ts`
- plugin host: `packages/plugin-api/src/host.ts`
- plugin registry: `packages/plugin-api/src/registry.ts`
- contribution merging: `packages/plugin-api/src/contributions.ts`

</div>
