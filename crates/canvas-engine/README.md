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

## Validation

```powershell
cargo test -p scriptor-canvas-engine
pnpm bench:canvas
```
