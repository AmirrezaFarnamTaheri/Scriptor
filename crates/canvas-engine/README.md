# scriptor-canvas-engine

Native canvas scene model for Scriptor.

## Modules

| Module | Responsibility |
|---|---|
| `scene` | Document, layer, block serialization |
| `hit_test` | Point hit-test and bounds queries |
| `templates` | Built-in board templates with dry-run apply |
| `snapshot` | SVG, PNG (`resvg`), and PDF (Pandoc HTML wrapper) snapshot rendering |
| `store` | Persist boards under `{vault}/.scriptor/canvas/boards` |

Boards may declare `relations` with an id, connector block id, explicit source/target Markdown paths, and a label. Geometry and ordinary card text never imply note relations. Save/load validate relation ids, connector existence, confined canonical Markdown paths, label size and the 5,000-relation bound. Existing boards without this optional field retain their previous meaning. The Canvas editor offers add/edit/remove with the existing board undo/redo and durable save path; relation changes never rewrite the linked Markdown notes.

## Validation

```powershell
cargo test -p scriptor-canvas-engine
pnpm bench:canvas
```
