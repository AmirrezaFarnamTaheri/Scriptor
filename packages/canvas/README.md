# @scriptor/canvas

Frontend canvas adapter for Scriptor edgeless boards.

Delegates durable scene logic, hit-testing, templates, and SVG snapshots to `crates/canvas-engine` while providing browser-safe helpers for the React shell.

## Commands

```powershell
pnpm check:canvas
cargo run -p scriptor-cli -- canvas-hit-test packages/test-fixtures/canvas/overlap-blocks.json --x 100 --y 100
cargo run -p scriptor-cli -- canvas-template-dry-run packages/test-fixtures/canvas/minimal-board.json --template research-board
cargo run -p scriptor-cli -- canvas-snapshot packages/test-fixtures/canvas/minimal-board.json --format svg --output .scriptor/exports/minimal-board.svg
pnpm bench:canvas
```
