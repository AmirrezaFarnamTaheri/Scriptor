# Supply-chain advisory investigation — 2026-10-04

## Result and scope

GitHub worker run `37191312431` correctly fails the advisory policy. The downloaded `artifacts/verification/github-37191312431/audit-rust-licenses-bans-advisories-and-sources.log` records `advisories FAILED, bans ok, licenses ok, sources ok` and exit code 1. The four error records begin at lines 14774, 14835, 14898 and 14970. All four official advisories classify the issue as **INFO Unmaintained**, and all list **no patched versions**. These records establish maintenance risk; they do not establish an exploitable vulnerability in Scriptor.

Reviewed the current `Cargo.lock`, relevant cached published crate manifests, application/export-runner manifests, `deny.toml`, the existing exception ledger, and current official advisory/upstream sources. No build, test, installation, dependency change or advisory exception was performed locally. Runtime/feature reachability beyond the manifest paths below requires GitHub-worker validation.

## Exact locked dependency graph

Both `apps/desktop/src-tauri/Cargo.toml` and `apps/mobile/src-tauri/Cargo.toml` enable `scriptor-export-runner/inprocess-pdf`. `crates/mobile-runtime/Cargo.toml` also enables this export feature behind its optional `pdf` feature. Export-runner pins `typst`, `typst-layout` and `typst-pdf` to `0.15.1`. The affected branches are:

| Advisory / locked package | Dependency paths, from export-runner toward the affected dependency | Relevant risk |
|---|---|---|
| [RUSTSEC-2025-0141](https://rustsec.org/advisories/RUSTSEC-2025-0141.html), `bincode 1.3.3` | `typst 0.15.1 → typst-library 0.15.1 → syntect 5.3.0 → bincode`; additionally `typst-library → two-face 0.4.5 → syntect` | Syntax/theme dump serialization is tied to an unmaintained binary codec. A replacement must preserve or regenerate upstream bundled dumps; changing the codec name alone does not preserve the data format. |
| [RUSTSEC-2026-0206](https://rustsec.org/advisories/RUSTSEC-2026-0206.html), `rustybuzz 0.20.1` | Direct parents: `typst-library 0.15.1`, `typst-layout 0.15.1`, `krilla 0.8.2`, `usvg 0.47.0`. PDF branch: `typst-pdf 0.15.1 → krilla 0.8.2`; SVG/PDF branch: `typst-pdf → krilla-svg 0.8.1 → resvg 0.47.0 → usvg 0.47.0`. Typst-library also directly depends on that usvg. | Unmaintained shaping code processes font/text input; migration must validate multilingual shaping, bidirectional text, ligatures and PDF output. |
| [RUSTSEC-2026-0192](https://rustsec.org/advisories/RUSTSEC-2026-0192.html), `ttf-parser 0.25.1` | Direct parents: `fontdb 0.23.0`, `rustybuzz 0.20.1`, `typst-layout 0.15.1`, `typst-library 0.15.1`, `typst-svg 0.15.1`, `usvg 0.47.0`. `fontdb 0.23.0` parents: `krilla-svg 0.8.1`, `typst-library 0.15.1`, `usvg 0.47.0`. `typst-svg` is also pulled through `typst 0.15.1 → typst-html 0.15.1 → typst-svg 0.15.1`. | Unmaintained font parsing affects document export and SVG text/font handling. Removing only one parent leaves other branches active. |
| [RUSTSEC-2024-0320](https://rustsec.org/advisories/RUSTSEC-2024-0320.html), `yaml-rust 0.4.5` | `typst 0.15.1 → typst-library 0.15.1 → syntect 5.3.0 → yaml-rust`; syntect is additionally referenced by `two-face 0.4.5` | The YAML loader for syntax grammars has no active original maintainer. This lockfile finding alone does not prove arbitrary user YAML enters that loader. |

The canvas engine already resolves `resvg 0.48.1 → usvg 0.48.1 → fontdb 0.24.0`, while Typst's older `resvg/usvg/fontdb` branches coexist. This shows why a canvas upgrade alone cannot remove these findings. No direct workspace dependency on any of the four affected crates was found in the parsed locked graph.

## Why a default-feature change does not fix this

The cached **published** `typst-library 0.15.1` manifest sets `syntect` with `default-features = false` and features `parsing`, `regex-fancy`, `plist-load`, `yaml-load`. Published `syntect 5.3.0` defines `parsing → dump-create + dump-load`, and both dump features enable `bincode`; `yaml-load` explicitly enables `yaml-rust`. Published `two-face 0.4.5` additionally enables syntect `dump-load` and `parsing`.

Cargo feature unification is additive. Adding a direct syntect dependency with fewer features cannot subtract Typst's requests. Removing `inprocess-pdf` from both applications would remove product behavior rather than remediate it, and would not necessarily remove a locked optional graph from the configured audit. That is not recommended as a gate workaround.

## Maintained alternatives and migration feasibility

| Dependency | Officially named alternatives | Compatibility assessment |
|---|---|---|
| bincode | `wincode`, `postcard`, `bitcode`, `rkyv`, named by the advisory | No demonstrated drop-in published replacement for syntect's API and embedded dump format. Requires upstream codec/dump migration, including two-face assets. A blanket package substitution is unsupported. |
| rustybuzz | [harfrust](https://github.com/harfbuzz/harfrust), named by the advisory | Maintained shaping alternative. Typst layout/library, krilla and usvg must migrate their APIs together; this is not a version-only cargo update. |
| ttf-parser | [skrifa / Fontations](https://github.com/googlefonts/fontations), named by the advisory | Maintained font parsing alternative. Typst, fontdb, usvg and the shaping branch use the old parser's types, so the migration spans several parents. |
| yaml-rust | [yaml-rust2](https://github.com/ethiraric/yaml-rust2), named by the advisory | Closest practical first migration. [Syntect upstream master](https://raw.githubusercontent.com/trishume/syntect/master/Cargo.toml) already requests `yaml-rust2 0.10.4` and maps `yaml-load` to it. However, upstream master still labels the crate `5.3.0`; the [latest published 5.3.0 manifest](https://docs.rs/crate/syntect/latest) still depends on `yaml-rust 0.4.5`. This is evidence of an upstream migration, not a published compatible upgrade. |

The inspected [Typst upstream workspace manifest](https://raw.githubusercontent.com/typst/typst/main/Cargo.toml) still requests `rustybuzz 0.20`, `ttf-parser 0.25`, syntect `5.3` with `yaml-load`, and usvg `0.47`. This snapshot supports the conclusion that simply following current Typst main does not remove all four findings. Mutable upstream URLs are research evidence, not acceptable dependency pins.

## Recommendation

1. Preserve the current advisory failures and eight existing, owned exceptions. The 2026-10-02 ledger already explicitly documents new Typst maintenance advisories without ignoring them. No new ignore should be inferred from this assessment.
2. Continue independent verification jobs on GitHub workers so a supply-chain failure does not hide functional/build evidence; retain overall CI failure and release blocking while the advisory policy fails.
3. Prioritize a reviewed **commit-pinned syntect YAML migration**, or preferably its next published release. Before proposing a patch, inspect the exact upstream diff and licenses, pin immutable provenance, account for the repository's denied unknown Git sources, and validate all targets on GitHub workers. This can remove `yaml-rust`; it does not solve bincode.
4. Track Typst/krilla/usvg/fontdb migrations to harfrust and Fontations as a coordinated export-engine change. Require multilingual/font/PDF/SVG regression evidence and lockfile proof that every affected parent is gone. Do not force a crate alias or introduce an unreviewed fork to make the gate green.
5. If maintainers explicitly accept temporary maintenance risk, a separate decision must name owner, review date and concrete exit condition for each new exception. The current policy does not authorize these four exceptions, and this report makes no such change.

## Limits

### Published-release recheck — 2026-10-08

The official latest-release pages still identify
[Typst 0.15.1](https://docs.rs/crate/typst/latest) and
[syntect 5.3.0](https://docs.rs/crate/syntect/latest). Typst's upstream workspace
still requests rustybuzz 0.20, ttf-parser 0.25, syntect 5.3 with `yaml-load`
and usvg 0.47. This recheck found no published version-only upgrade that removes
the four recorded maintenance findings. The upstream YAML migration remains
distinct from the published dependency graph. No fork, advisory suppression or
local dependency installation was introduced.

No new runtime exploit was asserted. No maintained replacement was asserted to be source- or data-format compatible without validation. Cargo lockfile reverse edges and published features were inspected statically; exact target/feature reachability and any candidate migration must be verified on GitHub workers. Rust review/build approval is withheld while the worker advisory gate is red.
