<div dir="ltr" align="center">

[English](EXAMPLE_VAULT.md) · **فارسی** · [简体中文](EXAMPLE_VAULT.zh-CN.md) · [Русский](EXAMPLE_VAULT.ru.md) · [Deutsch](EXAMPLE_VAULT.de.md) · [Español](EXAMPLE_VAULT.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# راهنمای vault نمونه

## نمای کلی

<bdi dir="ltr">vault</bdi> با نام `example-research` یک پایگاه دانش نمونه است که همراه Scriptor ارائه می‌شود. این vault قابلیت‌های اصلی مانند wikilink، frontmatter، یادداشت روزانه، citation، template و navigation در graph را نمایش می‌دهد.

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

### Wikilink

<bdi dir="ltr">link</bdi>های داخلی از syntax دو براکت استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

</div>

<div dir="rtl" lang="fa" align="right">

- `[[path]]` — link به یک note با path نسبی
- `[[path|display text]]` — link با متن نمایشی سفارشی
- <bdi dir="ltr">link</bdi>ها نسبت به ریشه vault resolve می‌شوند

### Frontmatter

<bdi dir="ltr">YAML</bdi> frontmatter در ابتدای هر note metadata را فراهم می‌کند:

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
- `title` — عنوان note
- `type` — نوع note مانند daily، project یا reference
- `tags` — آرایه tagها برای filter و grouping در graph
- `status` — وضعیت workflow مانند active، archived یا draft
- `_organized` — flag مربوط به triage inbox که با action سازمان‌دهی تنظیم می‌شود

### یادداشت‌های روزانه

یادداشت‌های روزانه در `daily/` با filename بر پایه تاریخ ISO قرار می‌گیرند:

</div>

<div dir="ltr" align="left">

```
daily/2026-01-15.md
```

</div>

<div dir="rtl" lang="fa" align="right">

دایرکتوری و format را در `.scriptor/config.json` تنظیم کنید:

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

### Citation

<bdi dir="ltr">note</bdi>های reference از `citation_key` در frontmatter استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```yaml
citation_key: einstein1905
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">citation</bdi> درون‌متنی از syntax `[@key]` استفاده می‌کند:

</div>

<div dir="ltr" align="left">

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

</div>

<div dir="rtl" lang="fa" align="right">

<bdi dir="ltr">export</bdi>های vault از فایل bibliography به نام `references.bib` و یک style از CSL برای citationهای formatشده استفاده می‌کنند.

### Navigation در Graph

با دکمه **Graph** در نوار بالا graph را باز کنید:

- هر note یک node است.
- <bdi dir="ltr">Wikilink</bdi>ها میان nodeها edge ایجاد می‌کنند.
- <bdi dir="ltr">tag</bdi>ها از طریق `graph_groups` در config رنگ nodeها را کنترل می‌کنند.
- روی یک node کلیک کنید تا به note آن بروید.
- با depth controlها graph را باز یا جمع کنید.

### Template

<bdi dir="ltr">template</bdi>های `templates/` از placeholderهای `{{token}}` استفاده می‌کنند:

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
- `{{title}}` — عنوان note
- `{{date}}` — تاریخ ISO فعلی

### Snippet

<bdi dir="ltr">snippet</bdi>های editor در `.scriptor/snippets.json` templateهای quick-insert را فراهم می‌کنند. prefix مانند `daily`، `meeting` یا `ref` را تایپ کنید و Tab را فشار دهید.

## بارگذاری vault نمونه

### از داخل برنامه

1. <bdi dir="ltr">Scriptor</bdi> را باز کنید.
2. **Open Vault** را انتخاب کنید.
3. به `packages/test-fixtures/vaults/example-research/` بروید.
4. **Open** را بزنید.

### با script

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

### Fixture script

</div>

<div dir="ltr" align="left">

```bash
# Copy to a working location
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

</div>

<div dir="rtl" lang="fa" align="right">

این کار یک copy از vault نمونه می‌سازد تا بتوانید با خیال راحت آزمایش کنید.

</div>
