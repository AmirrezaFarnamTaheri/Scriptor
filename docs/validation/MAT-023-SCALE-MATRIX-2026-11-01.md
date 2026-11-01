# MAT-023 — measured scale evidence matrix (first slice)

Issue: [MAT-023 #203](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/203). Status: independent evidence validator committed; full acceptance **not** met.

## Verified inputs required

A schema-v1 JSON measurement envelope identifies the exact 40-hex application commit, host ID/OS/architecture/CPU/memory, and Node/Rust/Cargo toolchain. Every measurement record identifies a 100/1000/5000/25000-note vault; `scan` or `search`; cold or warm; independent run 1 or 2; a distinct run ID; UTC timestamp; per-size SHA-256 fixture identity; counted notes; and native CLI timing samples/mean. Cold runs require an explicitly described `fresh-volume` or `os-cache-purge` operation, while warm runs attest cache priming. This metadata is an auditable assertion by the runner, not cryptographic verification that caches were actually cleared.

`node scripts/benchmarks/verify-scale-evidence.mjs evidence.json` reports every missing case and two-run mean/spread when possible. Exit 0 indicates the **32-case scan/search matrix is present and internally consistent**, not that performance is acceptable. Exit 1 means incomplete; exit 2 indicates invalid evidence. No color or success badge may conflate completeness with benchmark budgets.

The native source commands remain `scripts/benchmarks/bench-large.ps1`, `cargo run --release -p scriptor-cli -- bench-scan`, and `bench-search`; this slice neither executes commands nor changes benchmark thresholds, performance budgets, or cache behavior.

## Source coverage and limitations

- `scripts/benchmarks/scale-evidence.test.mjs` covers incomplete/complete matrices, negative/invalid samples, duplicated IDs, fixture inconsistencies, forged means and missing environmental metadata.
- `scripts/benchmarks/verify-scale-evidence.test.mjs` checks CLI exit outcomes for incomplete, complete and invalid records.
- Local Node 22 tests ran **10/10 passed** on the early standalone equivalent modules before repository integration; the exact GitHub-head source suite and CI are separately required.
- No real 100/1k/5k/25k measurements were collected by this change, and no performance improvement is claimed.
- The complete MAT-023 contract **also** requires cold startup/open, first-note/editor latency, indexing throughput, search distributions, peak/idle RAM, distribution size, independently measured variance, hardware/toolchain details, target budgets and installed behavior. This verifier covers only *scan/search evidence readiness*, not a 50% or 100% workstream score.

## Next acceptance gates

Capture two fully independent cold/warm runs per fixture and mode with actual cache proof; compare native raw reports with envelope samples. Then add startup/editor/memory/installer metrics and source test/fault-injection checks. Run exact-head GitHub CI and human review of charts and threshold decisions; do not close #203 until required verified measurements exist.
