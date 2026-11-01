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

The vault scan benchmark emits machine-readable JSON and exits non-zero when the mean latency exceeds the warm 5k-note budget documented in [`docs/architecture/PERFORMANCE_ARCHITECTURE.md`](../../docs/architecture/PERFORMANCE_ARCHITECTURE.md).

Hostile Markdown fixtures live in `packages/test-fixtures/markdown/hostile/` and are exercised by `pnpm check:renderer`.

## Usage

```powershell
pnpm bench:vault-scan
cargo run --release -p scriptor-cli -- bench-scan packages/test-fixtures/vaults/minimal --iterations 5
```

## MAT-023 independent scale-evidence review

The existing `bench-large.ps1` runner measures native scan or search at 100, 1k, 5k and 25k notes. The additional `verify-scale-evidence.mjs` tool checks a **separately collected measurement record** for a complete matrix of 32 cases (4 sizes × 2 modes × cold/warm × 2 independent runs). It requires exact source SHA, host/toolchain identity, per-size fixture SHA256 and note-count consistency, documented cold cache reset, warm priming and finite timing samples.

```sh
node scripts/benchmarks/verify-scale-evidence.mjs path/to/measured-matrix.json
```

Exit code `0` means **complete metadata and sample matrix ready for human review**, **not performance targets passed**. Exit `1` means missing cases; exit `2` means invalid data. The tool does not run benchmarks or purge caches; capture the original unedited native CLI JSON and independent environmental evidence. Never label repeated warm scans as cold measurements. Desktop startup, editor latency, RAM and distribution size require separate proof before full MAT-023 acceptance. See `docs/validation/MAT-023-SCALE-MATRIX-2026-11-01.md`.
