[English](EXAMPLE_VAULT.md) · [فارسی](EXAMPLE_VAULT.fa.md) · [简体中文](EXAMPLE_VAULT.zh-CN.md) · [Русский](EXAMPLE_VAULT.ru.md) · **Deutsch** · [Español](EXAMPLE_VAULT.es.md)

# Leitfaden zum Beispiel-Vault

## Überblick

Das Vault `example-research` ist eine mit Scriptor ausgelieferte Beispiel-Wissensbasis. Es demonstriert Kernfunktionen wie Wikilinks, Frontmatter, tägliche Notizen, Zitate, Templates und Graph-Navigation.

## Speicherort

```
packages/test-fixtures/vaults/example-research/
```

## Struktur

```
example-research/
├── index.md                      # Hauptindex mit Wikilinks
├── daily/
│   └── 2026-01-15.md            # Beispiel-Tagesnotiz
├── projects/
│   └── scriptor-notes.md        # Projektnotiz mit Frontmatter
├── references/
│   └── einstein-1905.md         # Zitatbeispiel
├── templates/
│   └── note-template.md         # Notiztemplate mit {{tokens}}
└── .scriptor/
    ├── config.json              # Vault-Konfiguration
    └── snippets.json            # Editor-Snippets
```

## Demonstrierte Funktionen

### Wikilinks

Interne Links verwenden doppelte eckige Klammern:

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

- `[[path]]` — Link zu einer Notiz über relativen Pfad
- `[[path|display text]]` — Link mit benutzerdefiniertem Anzeigetext
- Links werden relativ zur Vault-Wurzel aufgelöst

### Frontmatter

YAML-Frontmatter am Anfang einer Notiz liefert Metadaten:

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

Häufige Felder:
- `title` — Notiztitel
- `type` — Notiztyp (daily, project, reference usw.)
- `tags` — Tags zum Filtern und Gruppieren im Graph
- `status` — Workflow-Status (active, archived, draft)
- `_organized` — Inbox-Triage-Flag, gesetzt durch die Organize-Aktion

### Tägliche Notizen

Tagesnotizen liegen unter `daily/` und verwenden ISO-Datumsnamen:

```
daily/2026-01-15.md
```

Verzeichnis und Format werden in `.scriptor/config.json` konfiguriert:

```json
{
  "daily_note": {
    "directory": "daily",
    "filename_format": "{iso}",
    "title_format": "{iso}"
  }
}
```

### Zitate

Referenznotizen verwenden im Frontmatter einen `citation_key`:

```yaml
citation_key: einstein1905
```

Inline-Zitate verwenden `[@key]`:

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

Vault-Exporte verwenden eine `references.bib`-Bibliografie und einen CSL-Stil für formatierte Zitate.

### Graph-Navigation

Öffnen Sie die Graph-Ansicht über die Schaltfläche **Graph** in der Topbar:

- Jede Notiz ist ein Knoten.
- Wikilinks erzeugen Kanten zwischen Knoten.
- Tags steuern Knotenfarben über `graph_groups` in der Konfiguration.
- Klick auf einen Knoten öffnet die Notiz.
- Depth-Steuerungen erweitern oder reduzieren den Graph.

### Templates

Templates unter `templates/` verwenden Platzhalter `{{token}}`:

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

Verfügbare Tokens:
- `{{title}}` — Notiztitel
- `{{date}}` — aktuelles ISO-Datum

### Snippets

Editor-Snippets in `.scriptor/snippets.json` bieten Schnellvorlagen. Präfix wie `daily`, `meeting` oder `ref` eingeben und Tab drücken.

## Beispiel-Vault laden

### Aus der App

1. Scriptor öffnen.
2. **Open Vault** anklicken.
3. Zu `packages/test-fixtures/vaults/example-research/` navigieren.
4. **Open** anklicken.

### Per Skript

```bash
# In einen Arbeitsort kopieren
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# In Scriptor öffnen
pnpm desktop:dev
# Danach ~/my-research-vault in der UI öffnen
```

### Fixture-Skript

```bash
# In einen Arbeitsort kopieren
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

Dadurch entsteht eine Kopie des Beispiel-Vaults für gefahrlose Experimente.
