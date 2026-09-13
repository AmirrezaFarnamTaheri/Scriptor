[English](EXAMPLE_VAULT.md) · [فارسی](EXAMPLE_VAULT.fa.md) · [简体中文](EXAMPLE_VAULT.zh-CN.md) · **Русский** · [Deutsch](EXAMPLE_VAULT.de.md) · [Español](EXAMPLE_VAULT.es.md)

# Руководство по примеру vault

## Обзор

Vault `example-research` — пример базы знаний, включённый в Scriptor. Он демонстрирует основные возможности: wikilinks, frontmatter, daily notes, citations, templates и graph navigation.

## Расположение

```
packages/test-fixtures/vaults/example-research/
```

## Структура

```
example-research/
├── index.md                      # Основной индекс с wikilinks
├── daily/
│   └── 2026-01-15.md            # Пример daily note
├── projects/
│   └── scriptor-notes.md        # Project note с frontmatter
├── references/
│   └── einstein-1905.md         # Пример citation
├── templates/
│   └── note-template.md         # Template с {{tokens}}
└── .scriptor/
    ├── config.json              # Конфигурация vault
    └── snippets.json            # Editor snippets
```

## Демонстрируемые функции

### Wikilinks

Внутренние ссылки используют двойные квадратные скобки:

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

- `[[path]]` — ссылка на заметку по относительному пути
- `[[path|display text]]` — ссылка с пользовательским текстом
- Пути разрешаются относительно корня vault

### Frontmatter

YAML frontmatter в начале заметки содержит metadata:

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

Типичные поля:
- `title` — заголовок
- `type` — тип заметки (daily, project, reference и т. п.)
- `tags` — теги для фильтрации и группировки graph
- `status` — workflow status (active, archived, draft)
- `_organized` — флаг inbox triage, устанавливаемый organize action

### Daily Notes

Daily notes хранятся в `daily/` с ISO-датами в именах:

```
daily/2026-01-15.md
```

Каталог и формат настраиваются в `.scriptor/config.json`:

```json
{
  "daily_note": {
    "directory": "daily",
    "filename_format": "{iso}",
    "title_format": "{iso}"
  }
}
```

### Citations

Reference notes используют `citation_key` во frontmatter:

```yaml
citation_key: einstein1905
```

Inline citations используют `[@key]`:

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

Экспорт vault использует `references.bib` и стиль CSL для форматирования citations.

### Graph Navigation

Откройте Graph через кнопку **Graph** в верхней панели:

- Каждая заметка — node.
- Wikilinks создают edges.
- Tags управляют цветами nodes через `graph_groups` в config.
- Щёлкните node для перехода к заметке.
- Depth controls расширяют/сворачивают graph.

### Templates

Templates в `templates/` используют placeholders `{{token}}`:

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

Доступные tokens:
- `{{title}}` — заголовок заметки
- `{{date}}` — текущая ISO-дата

### Snippets

Editor snippets в `.scriptor/snippets.json` дают quick-insert templates. Введите prefix (`daily`, `meeting`, `ref`) и нажмите Tab.

## Загрузка примерного Vault

### Из приложения

1. Откройте Scriptor.
2. Нажмите **Open Vault**.
3. Перейдите в `packages/test-fixtures/vaults/example-research/`.
4. Нажмите **Open**.

### Через скрипт

```bash
# Скопировать в рабочее место
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# Открыть в Scriptor
pnpm desktop:dev
# Затем открыть ~/my-research-vault из UI
```

### Fixture script

```bash
# Скопировать в рабочее место
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

Так создаётся копия примерного vault для безопасных экспериментов.
