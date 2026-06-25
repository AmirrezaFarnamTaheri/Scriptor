# Fixture Import

Owner: Quality Engineering.

Synthetic vault generators for benchmarks and CI performance gates.

## Scripts

| Script | Purpose |
|---|---|
| `generate-synthetic-vault.ps1` | Create Markdown vaults at configurable note counts |

```powershell
pnpm fixtures:synthetic-1k
pnpm fixtures:synthetic-5k
pnpm bench:scan-1k
```

Behavior fixtures for cross-tool parity (Foam wikilinks, citation samples, canvas boards) live under `packages/test-fixtures/`.
