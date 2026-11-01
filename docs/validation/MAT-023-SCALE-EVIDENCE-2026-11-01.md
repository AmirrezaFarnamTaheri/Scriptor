# MAT-023 — reproducible scale-evidence contract (bounded slice)

**Tracking:** [MAT-023 #203](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/203). **Status:** evidence validator implemented; actual scale measurements and installed acceptance still missing.

## Scope

The existing `scripts/benchmarks/` hosts the official benchmark scripts. This change adds a complementary **read-only evidence validator**, not another benchmarking or authorization implementation. It checks JSON records for the four mandated note counts (100, 1,000, 5,000, 25,000), two real command scenarios (scan, search), two cache states (cold, warm), and **two individually identified runs each**. An incomplete matrix reports exactly which cases remain missing. A complete set produces 16 between-run mean/range/spread summaries and `readyForReview: true`, never an unmeasured performance pass.

Inputs must include exact source SHA, host identity, CPU and memory metadata, toolchain versions, consistent per-size fixture hashes, measured note counts, positive finite latency samples with reconciled reported means, and a cold-cache reset or warm-priming attestation. Contradictory, duplicate or malformed input fails closed. These fields are **self-reported provenance**, not proof that the OS actually cleared caches.

The existing `check-baselines.mjs` continues to enforce its current 1,000-note production budgets. The new matrix validator does not replace it, create a new benchmark budget, or run a benchmark.

## Test evidence

- Test-first missing-module RED observed with `node --test scale-evidence.test.mjs`. The implementation was then added and the 7 pure validator tests passed.
- Separate CLI-first RED observed with `node --test verify-scale-evidence.test.mjs` (3/3 failed when the runner did not exist). The new CLI was added; the two focused test files subsequently passed **10/10** in Node 22.16.0.
- Local test files are byte-for-byte the same Git blobs: `scale-evidence.mjs` `b63c24fc137659417ec15321712c6659e48a2596`, `scale-evidence.test.mjs` `f2d8ffb60386a9eebdc01124f38ae00210016733`, `verify-scale-evidence.mjs` `fcccff1dd61f8a0b946c4a9cd56e3b4f0ccf7b14`, `verify-scale-evidence.test.mjs` `9ef5d19449ddf06d6c0b784f94d5234e70e15ca2`.
- `scripts/validation/run-source-tests.mjs` automatically discovers both new `.test.mjs` files. Complete exact-head CI, browser, packaged proof and actual scale runs **not yet verified**.

## Remaining work before MAT-023 acceptance

Produce reproducible 100 / 1k / 5k / 25k scan/search actuals for independent cold/warm runs with inspectable host/cache evidence and fixture hashes, plus indexing, editor latency during rebuild, memory, startup, long-note/large attachment, checkout and artifact-size measurements. Verify variance on real Windows/macOS/Linux installed apps, set justified regression thresholds from observed baselines, compare against real release candidate and record any optimization claims only after measurement. Keep #203 open; a complete JSON schema alone is not acceptance.
