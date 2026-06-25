# Benchmarks

Owner: Quality Engineering.

## Available Benchmarks

| Script | Command | Budget |
|---|---|---:|
| Vault scan | `scripts/benchmarks/vault-scan.ps1` | 1500ms mean |
| Large vault scan (1k/5k) | `scripts/benchmarks/bench-large.ps1` | 1500ms mean @ 5k |
| Warm search | `scripts/benchmarks/search.ps1` | 100ms mean |
| CLI startup | `scripts/benchmarks/startup.ps1` | 3000ms mean |
| Export duration | `scripts/benchmarks/export-duration.ps1` | 10000ms |

The vault scan benchmark emits machine-readable JSON and exits non-zero when the mean latency exceeds the warm 5k-note budget documented in [`docs/architecture/PERFORMANCE_ARCHITECTURE.md`](../docs/architecture/PERFORMANCE_ARCHITECTURE.md).

Hostile Markdown fixtures live in `packages/test-fixtures/markdown/hostile/` and are exercised by `pnpm check:renderer`.

## Usage

```powershell
pnpm bench:vault-scan
cargo run -p scriptor-cli -- bench-scan packages/test-fixtures/vaults/minimal --iterations 5
```

Future benchmarks: startup, search, save-to-cache, preview render, graph query, export duration.
