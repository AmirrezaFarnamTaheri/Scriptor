# MAT-023 — GitHub-hosted three-platform warm CLI evidence (2026-11-04)

**Scope:** Source-bound, real compiled CLI warm-only smoke measurements; **not** a complete MAT-023 acceptance certificate.

- **Exact measured source:** `3c00b6b3de95375ad963befb9120812b0fa99b77` (PR #324, since merged as part of `main`).
- **Workflow:** [MAT-023 Hosted Warm CLI Evidence, run 41865088711, attempt 3](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41865088711). All three platform jobs reported success.
- **Measurements verified independently:** 48 warm run records = 3 OS × 4 note counts × 2 modes × 2 independently timestamped runs; 3 positive samples per run.
- **Coverage:** 100, 1,000, 5,000 and 25,000 notes; vault scan and warm indexed search. The collector reports all native mean-budget verdicts within the exact declared thresholds.
- **Integrity checks:** exact source SHA; per-OS/size/mode/replicate uniqueness; nonrepeated run IDs/start timestamps; fixture-hash consistency within note count; note counts and scenarios; positive finite samples; reported mean vs sample mean; budget and pass/fail concordance; required toolchain/host metadata.

## Measurement results

Values below are the arithmetic means of the two *per-run sample means* (milliseconds), not a pooled benchmark distribution. The spread is the absolute difference between the two means divided by their mean. Different hosted OS runners are not matched hardware; **do not use between-OS numbers as a cross-platform performance ranking**.

### Linux

| Notes | Mode | Run 1 (ms) | Run 2 (ms) | Two-run mean (ms) | Spread | Native budget (ms) | Verdict |
|---:|---|---:|---:|---:|---:|---:|---|
| 100 | scan | 0.679 | 0.680 | 0.679 | 0.2% | 500 | within (warm only) |
| 100 | search | 0.187 | 0.189 | 0.188 | 1.0% | 100 | within (warm only) |
| 1,000 | scan | 6.847 | 8.275 | 7.561 | 18.9% | 650 | within (warm only) |
| 1,000 | search | 0.836 | 0.853 | 0.845 | 2.0% | 100 | within (warm only) |
| 5,000 | scan | 33.775 | 33.275 | 33.525 | 1.5% | 1,250 | within (warm only) |
| 5,000 | search | 3.593 | 3.462 | 3.527 | 3.7% | 100 | within (warm only) |
| 25,000 | scan | 166.174 | 167.787 | 166.980 | 1.0% | 4,250 | within (warm only) |
| 25,000 | search | 16.967 | 16.748 | 16.857 | 1.3% | 100 | within (warm only) |

### Windows

| Notes | Mode | Run 1 (ms) | Run 2 (ms) | Two-run mean (ms) | Spread | Native budget (ms) | Verdict |
|---:|---|---:|---:|---:|---:|---:|---|
| 100 | scan | 9.631 | 6.956 | 8.293 | 32.3% | 500 | within (warm only) |
| 100 | search | 0.443 | 0.436 | 0.440 | 1.5% | 100 | within (warm only) |
| 1,000 | scan | 67.030 | 68.692 | 67.861 | 2.4% | 650 | within (warm only) |
| 1,000 | search | 1.592 | 1.569 | 1.580 | 1.5% | 100 | within (warm only) |
| 5,000 | scan | 335.926 | 331.460 | 333.693 | 1.3% | 1,250 | within (warm only) |
| 5,000 | search | 6.730 | 6.634 | 6.682 | 1.4% | 100 | within (warm only) |
| 25,000 | scan | 1676.266 | 1679.866 | 1678.066 | 0.2% | 4,250 | within (warm only) |
| 25,000 | search | 38.495 | 36.247 | 37.371 | 6.0% | 100 | within (warm only) |

### macOS

| Notes | Mode | Run 1 (ms) | Run 2 (ms) | Two-run mean (ms) | Spread | Native budget (ms) | Verdict |
|---:|---|---:|---:|---:|---:|---:|---|
| 100 | scan | 1.818 | 1.758 | 1.788 | 3.4% | 500 | within (warm only) |
| 100 | search | 0.276 | 0.206 | 0.241 | 29.2% | 100 | within (warm only) |
| 1,000 | scan | 18.550 | 17.851 | 18.200 | 3.8% | 650 | within (warm only) |
| 1,000 | search | 2.125 | 1.017 | 1.571 | 70.5% | 100 | within (warm only) |
| 5,000 | scan | 87.098 | 84.784 | 85.941 | 2.7% | 1,250 | within (warm only) |
| 5,000 | search | 3.851 | 4.495 | 4.173 | 15.4% | 100 | within (warm only) |
| 25,000 | scan | 541.972 | 434.175 | 488.074 | 22.1% | 4,250 | within (warm only) |
| 25,000 | search | 27.506 | 33.911 | 30.708 | 20.9% | 100 | within (warm only) |

## Provenance and reproducibility

All artifacts were downloaded from the three successful jobs of workflow run 41865088711. Source commit was identical in every JSON file. ZIP/JSON hashes below are SHA-256; the source-bound output includes a separate compiled CLI SHA-256 per OS. Values identify these artifacts, not a signed release.

| Platform | Runner OS / architecture | CPU | RAM (MiB) | JSON SHA-256 |
|---|---|---|---:|---|
| Linux | linux / x64 | AMD EPYC 9V45 96-Core Processor | 15984 | `6a24e323111b52938da6459abb8163787d989e3095ac1e15046124cf7b2015ea` |
| Windows | win32 / x64 | AMD EPYC 7763 64-Core Processor | 16379 | `8f19860841c9c4eace5aaf173ff197fee10578595231474d60c4b0fcacd2cdba` |
| macOS | darwin / arm64 | Apple M1 (Virtual) | 7168 | `b6793c4996518d4316c919429869db8638145e5e2a35044f3c7a15534270248a` |

| Platform | Source-bound compiled CLI SHA-256 | Artifact ZIP SHA-256 |
|---|---|---|
| Linux | `c5eb48fa81bbbdef600495825ef7e08c0f6b04f12fc55d5bd37aa25bbee70dfb` | `fa09252f85f07853a6f1435da662d3d2311cd1136493b37c0c722ae0cdd3f3f7` |
| Windows | `16c35b4760def6cbc60f33e1f67d4dc2589bcbb1968a56ea4b2e04b169db8f45` | `c7b213934cd4ece21487bcff9964ca82c1a7f3445ee2a705354c317e5a99ad71` |
| macOS | `4d71951cc2ff5ebad48d26285dc0525dc201bc9b3a1b3fec7c34c1165dd3ea91` | `0cf010509584a74c99206f1722c7d0daba8389a437f589d00a75334d9911d53a` |

- Toolchains recorded by all three artifacts: Node `v22.16.0`, Rust `1.96.0`, Cargo `1.96.0`.
- GitHub artifact names: `mat023-native-warm-ubuntu-24.04`, `mat023-native-warm-windows-2025`, `mat023-native-warm-macos-15`.
- For raw reports and native sample distributions, inspect the workflow artifacts; this Markdown is only an extracted summary.

## Unmet MAT-023 acceptance gates

1. **Cold cache:** These are warm measurements only; no demonstrated OS-cache purge/fresh-volume cold-run proof. Do not count warm rows as the 32-record cold/warm required matrix.
2. **Installed application:** The measured binary is the compiled native CLI on hosted runners, not an installed and upgraded desktop release artifact.
3. **User-facing latency:** No first-open/index-build time, editor/first-note save latency, attachment/long-note throughput, or startup time.
4. **Resource and quality:** No peak/idle RAM or installed package size; threshold fitness and regression baseline review still incomplete.
5. **Platform acceptance:** These runner measurements are not macOS/Windows/Linux installed-runtime crash/reopen, permission, or recovery UI acceptance.

**Disposition:** Evidence supports a specific three-platform warm CLI sub-gate, not closure of [MAT-023 #203](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/203), [MAT-024 #204](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/204), or v1.3.4 release approval.