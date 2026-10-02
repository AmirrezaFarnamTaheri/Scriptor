# RustSec advisory exception ledger

This ledger owns every advisory temporarily ignored by `cargo-deny`. An ignore records a reviewed dependency constraint, its owner, a re-review date, and an exit condition. Upgradeable vulnerabilities remain denied by CI.

**Owner:** Scriptor release and security maintainers

**Review cadence:** monthly and before every production tag

**Last full review:** 2026-10-02

**Next full review:** 2026-11-01

## 2026-10-02 assessment

The current RustSec database, commit `db663534ae858abb3fbad408a041ce04209c377f`, and the current locked package graph were reassessed. Evidence, exact versions, newly reported findings, and release limitations are recorded in [the security assessment](../validation/RUSTSEC-2026-10-02.md).

- **Removed ten withdrawn exceptions:** RUSTSEC-2024-0411 through RUSTSEC-2024-0420 were withdrawn on 2026-08-14 after GTK3 development resumed. GTK3 packages remain locked, but withdrawn advisories require no suppression. The earlier September assessment incorrectly treated them as active; this review corrects both the ledger and `deny.toml`.
- **Retained eight active maintenance-only exceptions:** official records still classify the packages below as INFO Unmaintained and list no patched version. Each row names the actual locked crate and parent. A replacement crate name is not a compatible dependency upgrade; transitive API migration requires upstream changes and product validation.
- **No new vulnerability or unsoundness exception:** Wasmtime RUSTSEC-2026-0315/0316 required a compatible patch upgrade. `glib` and Tantivy's `lru` unsoundness findings remain visible. Newly observed maintenance advisories in Typst's font/syntax dependencies are documented separately and are not added to the ignore list.
- `fxhash` remains absent from the lockfile; RUSTSEC-2025-0057 remains removed.

| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | `proc-macro-error` 1.0.4 via `glib-macros` 0.18.5 / `gtk3-macros` 0.18.2 | Linux GTK/Tauri build-time procedural macros | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-11-01 | Remove when GTK macro parents migrate to maintained diagnostics macros or no longer resolve this crate |
| RUSTSEC-2023-0089 | `atomic-polyfill` 1.0.3 via `heapless` 0.7.17 via `postcard` 1.1.3 | Locked heapless serialization compatibility graph; check production target/feature activation | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-11-01 | Remove when postcard/heapless drops atomic-polyfill or validated feature removal eliminates it |
| RUSTSEC-2024-0436 | `paste` 1.0.15 via `biblatex` 0.12.0 / `hayagriva` 0.10.1 | Citation-engine and Typst bibliography build-time macro expansion | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-11-01 | Remove when bibliography parents adopt maintained macro expansion or no longer resolve paste |
| RUSTSEC-2025-0075 | `unic-char-range` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0080 | `unic-common` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0081 | `unic-char-property` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0098 | `unic-ucd-version` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0100 | `unic-ucd-ident` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |

## Review procedure

1. Fetch the current official RustSec database and run `cargo audit` and `cargo deny check` against the locked graph, including production targets and optional features.
2. Check withdrawals, patched versions, advisory type, target/feature reachability, and the parent preventing a compatible migration.
3. Remove an ignore immediately when its advisory is withdrawn, its package is absent, or a compatible maintained path is verified.
4. Record fresh evidence before extending a deadline; never suppress a new vulnerability to make a gate pass.
5. Treat an expired review or unresolved vulnerability-class advisory as a production release blocker. A current maintenance ledger alone is not release certification.
