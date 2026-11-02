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

## MAT-023 — scale evidence matrix (review only)

The existing `bench-large.ps1` scripts produce individual 100, 1k, 5k and 25k-note scan/search reports. To evaluate whether a **complete comparable matrix** was actually collected, use:

```sh
node --test scripts/benchmarks/scale-evidence.test.mjs scripts/benchmarks/verify-scale-evidence.test.mjs
node scripts/benchmarks/verify-scale-evidence.mjs artifacts/performance/scale-matrix.json
```

The input is a `schemaVersion: 1` JSON object with a pinned `sourceCommit` (40 hex characters), `host` identity (id, os, arch, cpu, memoryMb), `toolchain` versions (node, rustc, cargo), and `runs` records. Every run needs `size` (100, 1000, 5000 or 25000), `mode` (scan or search), `condition` (cold or warm), `replicate` (1 or 2), distinct `runId`, UTC `startedAt`, `fixtureSha256`, `noteCount` and real CLI `report` (`note_count`, `mean_ms`, at least three `samples_ms`). Cold runs must document `cacheReset: { method: 'fresh-volume' | 'os-cache-purge', evidence: '...' }`; warm runs must mark `warmed: true`. These fields are **attestations**, not proof the host actually cleared caches.

A complete matrix contains 32 independently identified measurements. The checker returns `readyForReview: true` only when the matrix is structurally complete, with 16 cold/warm/size/mode summaries. Exit code 1 means incomplete, 2 means invalid. It **does not run any benchmark, clear caches, certify toolchain provenance, enforce latency budgets, or imply MAT-023 acceptance**. Actual host/OS evidence, two genuine independent runs, memory/editor/file-size measurements and signed installed-platform review remain mandatory.

## MAT-023 hosted warm CLI measurement (partial only)

`.github/workflows/mat023-hosted-warm.yml` compiles the production
`scriptor-cli` on GitHub-hosted Windows, macOS and Linux and runs the real
`generate-vault`, `bench-scan`, and FTS5 `bench-search` commands on
fresh deterministic 100-note fixtures. The collector makes two separate warm
measurement process calls per scan/search pair, with a separate warm-up call
before each measurement. It captures all actual CLI latency samples, host
identity, pinned toolchain, fixture hash, checked-out commit and compiled
binary SHA-256, and uploads the JSON even when a timing budget is exceeded.

Focused contract tests:

```sh
node --test scripts/benchmarks/collect-scale-smoke.test.mjs scripts/benchmarks/scale-evidence.test.mjs
```

From an **exact Git checkout**, after `cargo build --locked --release -p scriptor-cli`:

```sh
node scripts/benchmarks/collect-scale-smoke.mjs \
  --cli target/release/scriptor \
  --source-sha "$(git rev-parse HEAD)" \
  --size 100 \
  --output artifacts/performance/local-warm-100.json
```

On Windows, use `target/release/scriptor.exe` and pass the exact Git HEAD
SHA with PowerShell syntax instead. Each output file is created exclusively:
choose a new filename for a new run rather than overwriting past evidence.
`--size all` enables the full four fixture sizes, but still measures **warm
scan/search only**. CLI exit 4 indicates a measured budget regression; the
collector stores the negative samples before returning a nonzero exit status.
An inconsistent exit code and `within_budget` report fails closed.

The existing `verify-scale-evidence.mjs` must continue to report a partial
matrix for warm-only evidence. Neither this collector nor CI proves OS cache
purges, cold starts, index-build duration, editor latency during rebuilding,
memory peaks, large attachment cases, artifact sizes, release packaging,
installed desktop runtime or MAT-023/MAT-024 acceptance. Those gates require
separately measured source-bound evidence; never substitute metadata checks
for actual performance measurements.
