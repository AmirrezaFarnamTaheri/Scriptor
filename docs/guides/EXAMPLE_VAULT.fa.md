<div dir="ltr" align="center">

[English](EXAMPLE_VAULT.md) · **فارسی** · [简体中文](EXAMPLE_VAULT.zh-CN.md) · [Русский](EXAMPLE_VAULT.ru.md) · [Deutsch](EXAMPLE_VAULT.de.md) · [Español](EXAMPLE_VAULT.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای <bdi dir="ltr">vault</bdi> نمونه

## نمای کلی

<bdi dir="ltr">vault</bdi> با نام `example-research` یک پایگاه دانش نمونه است که همراه <bdi dir="ltr">Scriptor</bdi> ارائه می‌شود. این <bdi dir="ltr">vault</bdi> قابلیت‌های اصلی مانند <bdi dir="ltr">wikilink</bdi>، <bdi dir="ltr">frontmatter</bdi>، یادداشت روزانه، <bdi dir="ltr">citation</bdi>، <bdi dir="ltr">template</bdi> و <bdi dir="ltr">navigation</bdi> در <bdi dir="ltr">graph</bdi> را نمایش می‌دهد.

## محل

</div>

<div dir="ltr" align="left">

```
packages/test-fixtures/vaults/example-research/
```

</div>

<div dir="rtl" lang="fa" align="right">

## ساختار

</div>

<div dir="ltr" align="left">

```
example-research/
├── index.md                      # Main index with wikilinks
├── daily/
│   └── 2026-01-15.md            # Sample daily note
├── projects/
│   └── scriptor-notes.md        # Project note with frontmatter
├── references/
│   └── einstein-1905.md         # Citation example
├── templates/
│   └── note-template.md         # Note template with {{tokens}}
└── .scriptor/
    ├── config.json              # Vault configuration
    └── snippets.json            # Editor snippets
```

</div>

<div dir="rtl" lang="fa" align="right">

## قابلیت‌های نمایش‌داده‌شده

### <bdi dir="ltr">Wikilink</bdi>

<bdi dir="ltr">link</bdi>های داخلی از <bdi dir="ltr">syntax</bdi> دو براکت استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

</div>

<div dir="rtl" lang="fa" align="right">

- `[[path]]` — <bdi dir="ltr">link</bdi> به یک <bdi dir="ltr">note</bdi> با <bdi dir="ltr">path</bdi> نسبی
- `[[path|display text]]` — <bdi dir="ltr">link</bdi> با متن نمایشی سفارشی
- <bdi dir="ltr">link</bdi>ها نسبت به ریشه <bdi dir="ltr">vault resolve</bdi> می‌شوند

### <bdi dir="ltr">Frontmatter</bdi>

<bdi dir="ltr">YAML</bdi> <bdi dir="ltr">frontmatter</bdi> در ابتدای هر <bdi dir="ltr">note metadata</bdi> را فراهم می‌کند:

</div>

<div dir="ltr" align="left">

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

</div>

<div dir="rtl" lang="fa" align="right">

فیلدهای رایج:
- `title` — عنوان <bdi dir="ltr">note</bdi>
- `type` — نوع <bdi dir="ltr">note</bdi> مانند <bdi dir="ltr">daily</bdi>، <bdi dir="ltr">project</bdi> یا <bdi dir="ltr">reference</bdi>
- `tags` — آرایه <bdi dir="ltr">tag</bdi>ها برای <bdi dir="ltr">filter</bdi> و <bdi dir="ltr">grouping</bdi> در <bdi dir="ltr">graph</bdi>
- `status` — وضعیت <bdi dir="ltr">workflow</bdi> مانند <bdi dir="ltr">active</bdi>، <bdi dir="ltr">archived</bdi> یا <bdi dir="ltr">draft</bdi>
- `_organized` — <bdi dir="ltr">flag</bdi> مربوط به <bdi dir="ltr">triage inbox</bdi> که با <bdi dir="ltr">action</bdi> سازمان‌دهی تنظیم می‌شود

### یادداشت‌های روزانه

یادداشت‌های روزانه در `daily/` با <bdi dir="ltr">filename</bdi> بر پایه تاریخ <bdi dir="ltr">ISO</bdi> قرار می‌گیرند:

</div>

<div dir="ltr" align="left">

```
daily/2026-01-15.md
```

</div>

<div dir="rtl" lang="fa" align="right">

دایرکتوری و <bdi dir="ltr">format</bdi> را در `.scriptor/config.json` تنظیم کنید:

</div>

<div dir="ltr" align="left">

```json
{
  "daily_note": {
    "directory": "daily",
    "filename_format": "{iso}",
    "title_format": "{iso}"
  }
}
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Citation</bdi>

<bdi dir="ltr">note</bdi>های <bdi dir="ltr">reference</bdi> از `citation_key` در <bdi dir="ltr">frontmatter</bdi> استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```yaml
citation_key: einstein1905
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">citation</bdi> درون‌متنی از <bdi dir="ltr">syntax</bdi> `[@key]` استفاده می‌کند:

</div>

<div dir="ltr" align="left">

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">export</bdi>های <bdi dir="ltr">vault</bdi> از فایل <bdi dir="ltr">bibliography</bdi> به نام `references.bib` و یک <bdi dir="ltr">style</bdi> از <bdi dir="ltr">CSL</bdi> برای <bdi dir="ltr">citation</bdi>های <bdi dir="ltr">format</bdi>شده استفاده می‌کنند.

### <bdi dir="ltr">Navigation</bdi> در <bdi dir="ltr">Graph</bdi>

با دکمه **<bdi dir="ltr">Graph</bdi>** در نوار بالا <bdi dir="ltr">graph</bdi> را باز کنید:

- هر <bdi dir="ltr">note</bdi> یک <bdi dir="ltr">node</bdi> است.
- <bdi dir="ltr">Wikilink</bdi>ها میان <bdi dir="ltr">node</bdi>ها <bdi dir="ltr">edge</bdi> ایجاد می‌کنند.
- <bdi dir="ltr">tag</bdi>ها از طریق `graph_groups` در <bdi dir="ltr">config</bdi> رنگ <bdi dir="ltr">node</bdi>ها را کنترل می‌کنند.
- روی یک <bdi dir="ltr">node</bdi> کلیک کنید تا به <bdi dir="ltr">note</bdi> آن بروید.
- با <bdi dir="ltr">depth control</bdi>ها <bdi dir="ltr">graph</bdi> را باز یا جمع کنید.

### <bdi dir="ltr">Template</bdi>

<bdi dir="ltr">template</bdi>های `templates/` از <bdi dir="ltr">placeholder</bdi>های `{{token}}` استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">token</bdi>های موجود:
- `{{title}}` — عنوان <bdi dir="ltr">note</bdi>
- `{{date}}` — تاریخ <bdi dir="ltr">ISO</bdi> فعلی

### <bdi dir="ltr">Snippet</bdi>

<bdi dir="ltr">snippet</bdi>های <bdi dir="ltr">editor</bdi> در `.scriptor/snippets.json` <bdi dir="ltr">template</bdi>های <bdi dir="ltr">quick-insert</bdi> را فراهم می‌کنند. <bdi dir="ltr">prefix</bdi> مانند `daily`، `meeting` یا `ref` را تایپ کنید و <bdi dir="ltr">Tab</bdi> را فشار دهید.

## بارگذاری <bdi dir="ltr">vault</bdi> نمونه

### از داخل برنامه

1. <bdi dir="ltr">Scriptor</bdi> را باز کنید.
2. **<bdi dir="ltr">Open Vault</bdi>** را انتخاب کنید.
3. به `packages/test-fixtures/vaults/example-research/` بروید.
4. **<bdi dir="ltr">Open</bdi>** را بزنید.

### با <bdi dir="ltr">script</bdi>

</div>

<div dir="ltr" align="left">

```bash
# Copy to a working location
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# Open in Scriptor
pnpm desktop:dev
# Then open ~/my-research-vault from the UI
```

</div>

<div dir="rtl" lang="fa" align="right">

### <bdi dir="ltr">Fixture script</bdi>

</div>

<div dir="ltr" align="left">

```bash
# Copy to a working location
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

</div>

<div dir="rtl" lang="fa" align="right">

این کار یک <bdi dir="ltr">copy</bdi> از <bdi dir="ltr">vault</bdi> نمونه می‌سازد تا بتوانید با خیال راحت آزمایش کنید.

</div>
