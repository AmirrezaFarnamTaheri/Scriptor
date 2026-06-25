# `@scriptor/export`

Export profile schemas and frontend orchestration for Pandoc jobs.

## Shipped

- Profile definitions (HTML, PDF, DOCX, LaTeX, ePub) with per-format output directories.
- Citation/CSL metadata helpers and diagram export hooks.
- Bridge to native `export_*` Tauri commands and progress events.

## Validation

```powershell
pnpm check:export
```

Native runner: `crates/export-runner`. Pandoc discovery: [`docs/release/PANDOC_STRATEGY.md`](../../docs/release/PANDOC_STRATEGY.md).
