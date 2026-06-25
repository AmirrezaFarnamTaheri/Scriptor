# Canvas Fixtures

Scene serialization fixtures for `scriptor-canvas-engine` and `@scriptor/canvas`.

| File | Purpose |
|---|---|
| `overlap-blocks.json` | Overlapping blocks with z-index hit-test priority |
| `locked-layer.json` | Locked layer blocks must not be selectable |
| `minimal-board.json` | Empty board with a single markdown block |

Load in CLI:

```powershell
cargo run -p scriptor-cli -- canvas-hit-test packages/test-fixtures/canvas/overlap-blocks.json --x 100 --y 100
```
