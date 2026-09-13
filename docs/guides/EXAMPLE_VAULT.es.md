[English](EXAMPLE_VAULT.md) · [فارسی](EXAMPLE_VAULT.fa.md) · [简体中文](EXAMPLE_VAULT.zh-CN.md) · [Русский](EXAMPLE_VAULT.ru.md) · [Deutsch](EXAMPLE_VAULT.de.md) · **Español**

# Guía del vault de ejemplo

## Descripción

El vault `example-research` es una base de conocimiento de ejemplo incluida con Scriptor. Demuestra funciones centrales: wikilinks, frontmatter, notas diarias, citas, plantillas y navegación por grafo.

## Ubicación

```
packages/test-fixtures/vaults/example-research/
```

## Estructura

```
example-research/
├── index.md                      # Índice principal con wikilinks
├── daily/
│   └── 2026-01-15.md            # Nota diaria de ejemplo
├── projects/
│   └── scriptor-notes.md        # Nota de proyecto con frontmatter
├── references/
│   └── einstein-1905.md         # Ejemplo de cita
├── templates/
│   └── note-template.md         # Plantilla con {{tokens}}
└── .scriptor/
    ├── config.json              # Configuración del vault
    └── snippets.json            # Snippets del editor
```

## Funciones demostradas

### Wikilinks

Los enlaces internos usan corchetes dobles:

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

- `[[path]]` — enlaza una nota por ruta relativa
- `[[path|display text]]` — enlace con texto de visualización personalizado
- Los enlaces se resuelven respecto a la raíz del vault

### Frontmatter

El frontmatter YAML al principio de una nota proporciona metadatos:

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

Campos habituales:
- `title` — título de la nota
- `type` — tipo de nota (daily, project, reference, etc.)
- `tags` — etiquetas para filtrar y agrupar el grafo
- `status` — estado del workflow (active, archived, draft)
- `_organized` — flag de triage del inbox, establecido por la acción organize

### Notas diarias

Las notas diarias viven en `daily/` con nombres ISO:

```
daily/2026-01-15.md
```

Configure directorio y formato en `.scriptor/config.json`:

```json
{
  "daily_note": {
    "directory": "daily",
    "filename_format": "{iso}",
    "title_format": "{iso}"
  }
}
```

### Citas

Las notas de referencia usan `citation_key` en frontmatter:

```yaml
citation_key: einstein1905
```

Las citas inline usan `[@key]`:

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

Los exports del vault usan `references.bib` y un estilo CSL para citas formateadas.

### Navegación por grafo

Abra la vista de grafo con **Graph** en la barra superior:

- Cada nota es un nodo.
- Los wikilinks crean aristas.
- Las tags controlan colores mediante `graph_groups` en la configuración.
- Haga clic en un nodo para abrir la nota.
- Los controles de profundidad expanden o contraen el grafo.

### Plantillas

Las plantillas de `templates/` usan placeholders `{{token}}`:

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

Tokens disponibles:
- `{{title}}` — título de la nota
- `{{date}}` — fecha ISO actual

### Snippets

Los snippets de `.scriptor/snippets.json` ofrecen plantillas de inserción rápida. Escriba un prefijo como `daily`, `meeting` o `ref` y pulse Tab.

## Cargar el vault de ejemplo

### Desde la aplicación

1. Abra Scriptor.
2. Haga clic en **Open Vault**.
3. Navegue a `packages/test-fixtures/vaults/example-research/`.
4. Haga clic en **Open**.

### Mediante script

```bash
# Copiar a una ubicación de trabajo
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# Abrir en Scriptor
pnpm desktop:dev
# Después, abrir ~/my-research-vault desde la UI
```

### Script de fixture

```bash
# Copiar a una ubicación de trabajo
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

Esto copia el vault de ejemplo para experimentar de forma segura.
