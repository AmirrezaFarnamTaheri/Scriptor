# Example Vault Guide

## Overview

The `example-research` vault is a sample knowledge base included with Scriptor. It demonstrates core features: wikilinks, frontmatter, daily notes, citations, templates, and graph navigation.

## Location

```
packages/test-fixtures/vaults/example-research/
```

## Structure

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

## Features Demonstrated

### Wikilinks

Internal links use double-bracket syntax:

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

- `[[path]]` — links to a note by relative path
- `[[path|display text]]` — links with custom display text
- Links are resolved relative to the vault root

### Frontmatter

YAML frontmatter at the top of each note provides metadata:

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

Common fields:
- `title` — note title
- `type` — note type (daily, project, reference, etc.)
- `tags` — array of tags for filtering and graph grouping
- `status` — workflow status (active, archived, draft)
- `_organized` — inbox triage flag (set by organize action)

### Daily Notes

Daily notes live in `daily/` with ISO-date filenames:

```
daily/2026-01-15.md
```

Configure the daily note directory and format in `.scriptor/config.json`:

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

Reference notes use a `citation_key` in frontmatter:

```yaml
citation_key: einstein1905
```

Inline citations use `[@key]` syntax:

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

The vault exports use a `references.bib` bibliography file and CSL style for formatted citations.

### Graph Navigation

Open the graph view (Graph button in the top bar) to see how notes connect:

- Each note is a node
- Wikilinks create edges between nodes
- Tags control node colors via `graph_groups` in config
- Click a node to navigate to that note
- Use depth controls to expand/collapse the graph

### Templates

Templates in `templates/` use `{{token}}` placeholders:

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

Available tokens:
- `{{title}}` — note title
- `{{date}}` — current ISO date

### Snippets

Editor snippets in `.scriptor/snippets.json` provide quick-insert templates. Type the prefix (e.g., `daily`, `meeting`, `ref`) and press Tab to expand.

## Loading the Example Vault

### From the app

1. Open Scriptor
2. Click **Open Vault**
3. Navigate to `packages/test-fixtures/vaults/example-research/`
4. Click **Open**

### Via script

```bash
# Copy to a working location
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# Open in Scriptor
pnpm desktop:dev
# Then open ~/my-research-vault from the UI
```

### Fixture script

```bash
# Copy to a working location
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

This copies the example vault for safe experimentation.
