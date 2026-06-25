# `@scriptor/editor`

CodeMirror 6 Markdown editor for the Scriptor desktop shell.

## Shipped

- GFM commands (headings, lists, tasks, tables, links).
- Snippet expansion, wikilink helpers, and round-trip fixtures.
- Vim mode (optional), lint integration, and split-preview host surface.

## Validation

```powershell
pnpm check:editor
```

Used by `src/components/shell/EditorWorkspace.tsx` via the `@scriptor/editor` workspace package.
