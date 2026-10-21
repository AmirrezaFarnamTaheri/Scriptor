# RustSec advisory exception ledger

This ledger owns every advisory temporarily ignored by `cargo-deny`. An ignore records a reviewed dependency constraint, its owner, a re-review date, and an exit condition. Upgradeable vulnerabilities remain denied by CI.

**Owner:** Scriptor release and security maintainers

**Review cadence:** monthly and before every production tag

**Last full review:** 2026-10-10

**Next full review:** 2026-11-01

## 2026-10-02 assessment

The current RustSec database, commit `db663534ae858abb3fbad408a041ce04209c377f`, and the current locked package graph were reassessed. Evidence, exact versions, newly reported findings, and release limitations are recorded in [the security assessment](../validation/RUSTSEC-2026-10-02.md).

- **Removed ten withdrawn exceptions:** RUSTSEC-2024-0411 through RUSTSEC-2024-0420 were withdrawn on 2026-08-14 after GTK3 development resumed. GTK3 packages remain locked, but withdrawn advisories require no suppression. The earlier September assessment incorrectly treated them as active; this review corrects both the ledger and `deny.toml`.
- **Retained eight active maintenance-only exceptions:** official records still classify the packages below as INFO Unmaintained and list no patched version. Each row names the actual locked crate and parent. A replacement crate name is not a compatible dependency upgrade; transitive API migration requires upstream changes and product validation.
- **Four additional Typst upstream maintenance exceptions reviewed on 2026-10-10:** bincode, rustybuzz, ttf-parser, and yaml-rust have no patched releases and are reported as INFO Unmaintained, not a vulnerability proof. We are accepting a strictly enumerated, expiring build-time and PDF-rendering dependency risk rather than deleting the PDF feature or publishing a falsely green lockfile. This is **not a fix of unmaintained upstream code**. See the new rows below and remove them when maintained parents ship and full PDFs regressions pass.
- **2026-10-13 YAML maintenance finding:** RUSTSEC-2024-0449 flags unmaintained `unsafe-libyaml` 0.2.11 through `serde_yaml`, required by current `hayagriva` and `typst-library`. Neither parent offers a compatible replacement. The narrow maintenance-only exception below is owned and expires for review on 2026-11-01. This is not a security patch; review untrusted bibliography/YAML input exposure during the migration.
- **No new vulnerability or unsoundness exception:** Wasmtime RUSTSEC-2026-0315/0316 required a compatible patch upgrade. `glib` and Tantivy's `lru` unsoundness findings remain visible. Newly observed maintenance advisories in Typst's font/syntax dependencies are documented separately and are not added to the ignore list.
- `fxhash` remains absent from the lockfile; RUSTSEC-2025-0057 remains removed.

| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | `proc-macro-error` 1.0.4 via `glib-macros` 0.18.5 / `gtk3-macros` 0.18.2 | Linux GTK/Tauri build-time procedural macros | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-11-01 | Remove when GTK macro parents migrate to maintained diagnostics macros or no longer resolve this crate |
| RUSTSEC-2023-0089 | `atomic-polyfill` 1.0.3 via `heapless` 0.7.17 via `postcard` 1.1.3 | Locked heapless serialization compatibility graph; check production target/feature activation | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-11-01 | Remove when postcard/heapless drops atomic-polyfill or validated feature removal eliminates it |
| RUSTSEC-2024-0436 | `paste` 1.0.15 via `biblatex` 0.12.0 / `hayagriva` 0.10.1 | Citation-engine and Typst bibliography build-time macro expansion | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-11-01 | Remove when bibliography parents adopt maintained macro expansion or no longer resolve paste |
| RUSTSEC-2024-0449 | `unsafe-libyaml` 0.2.11 via `serde_yaml` 0.9.34+deprecated through `hayagriva` 0.10.1 and `typst-library` 0.15.1 | Bibliography import and Typst YAML parsing; external bibliography input can be untrusted | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0449.html | 2026-11-01 | Migrate bibliography/Typst parents to maintained YAML parsing, remove the transitive crate and ignore after citation/PDF regression coverage |
| RUSTSEC-2025-0075 | `unic-char-range` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0080 | `unic-common` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0081 | `unic-char-property` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0098 | `unic-ucd-version` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0100 | `unic-ucd-ident` 0.9.0 via `urlpattern` 0.3.0 / `tauri-utils` 2.9.3 | Tauri URL-pattern Unicode processing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-11-01 | Remove when supported urlpattern/Tauri parents migrate to maintained Unicode APIs |
| RUSTSEC-2025-0141 | `bincode` 1.3.3 via `syntect` 5.3.0 / `two-face` 0.4.5 / Typst | Embedded PDF syntax highlighting dependency; no arbitrary syntax-definition file loading | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0141.html | 2026-11-01 | Migrate Typst highlighting to a maintained serialization parent or remove syntect after equivalent formatting tests |
| RUSTSEC-2026-0206 | `rustybuzz` 0.20.1 via Typst layout / `krilla` 0.8.2 / `usvg` 0.47.0 | Font shaping in PDF export; bundled fonts only | Release/Security | https://rustsec.org/advisories/RUSTSEC-2026-0206.html | 2026-11-01 | Upgrade Typst and layout parents to maintained harfrust after PDF visual parity testing |
| RUSTSEC-2026-0192 | `ttf-parser` 0.25.1 via Typst, `fontdb`, `usvg` and rustybuzz | Bundled TrueType parser in PDF generation; arbitrary source fonts denied | Release/Security | https://rustsec.org/advisories/RUSTSEC-2026-0192.html | 2026-11-01 | Upgrade to Typst font stack using maintained skrifa and verify shaping/embedding |
| RUSTSEC-2024-0320 | `yaml-rust` 0.4.5 via `syntect` / `two-face` / Typst | PDF syntax highlighting graph; distinct from user frontmatter | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0320.html | 2026-11-01 | Upgrade syntect parent to yaml-rust2 or saphyr, confirm syntax parity |

## 2026-10-19 advisory refresh

**Security fix:** `ammonia` was upgraded in `Cargo.lock` from 4.2.3 to 4.2.4 using the verified crates.io index checksum. Its four normal dependency constraints are unchanged. This fixes **RUSTSEC-2026-0373**; that vulnerability is *not* in `deny.toml`'s ignore list. Verification requires a fresh locked CI audit.

**Temporary maintenance-only constraints:** RustSec newly marked the `zbus` 5 standalone name and wire-format crates unmaintained on October 17. `scriptor-system-bridge` uses `keyring` 4.2.0, which pulls `zbus-secret-service-keyring-store` 1.0.0 and `secret-service` 5.1.0. Both currently require `zbus` 5. The available 1.0.1 store and 5.2.0 secret-service releases still require `zbus` 5, while the maintained successor `zbus` 6 is a breaking major version. A direct lockfile update cannot safely perform this migration; changing keyring backends requires Linux runtime, D-Bus, packaging and credential-retention verification. The following strictly enumerated *informational* exceptions expire for review on 2026-11-01 and must be removed with the parent migration. They **do not cover vulnerabilities**.

| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |
|---|---|---|---|---|---|---|
| RUSTSEC-2026-0370 | `zvariant` 5.13.1 via `zbus` 5.18.0 and `zbus_names` 4.3.4 | Linux keyring: `scriptor-system-bridge` → `keyring` 4.2.0 → zbus-based Secret Service backend | Release/Security | https://rustsec.org/advisories/RUSTSEC-2026-0370.html | 2026-11-01 | Switch the keyring backend to a maintained D-Bus implementation / zbus 6 and confirm Linux credentials and packaging |
| RUSTSEC-2026-0371 | `zbus_names` 4.3.4 via `zbus` 5.18.0 | Linux keyring: `secret-service` 5.1.0 and `zbus-secret-service-keyring-store` 1.0.0 | Release/Security | https://rustsec.org/advisories/RUSTSEC-2026-0371.html | 2026-11-01 | Migrate parents to `zbus::names` in zbus 6; verify D-Bus keyring integration |
| RUSTSEC-2026-0372 | `zvariant_derive` 5.13.1 via `zvariant` 5.13.1 | Linux keyring via legacy zbus 5 wire-format dependencies | Release/Security | https://rustsec.org/advisories/RUSTSEC-2026-0372.html | 2026-11-01 | Migrate parents to zbus 6 wire/derive implementation and drop standalone macros |

## 2026-10-21 advisory refresh

**Security fix:** `webpki-roots` and `webpki-root-certs` were upgraded in `Cargo.lock` from 1.0.9 to 1.0.10 using the verified crates.io index checksums. This fixes **RUSTSEC-2026-0381**, **RUSTSEC-2026-0382** and **RUSTSEC-2026-0383**, which affected the bundled root certificates: the affected versions included the distrusted `emSign ECC Root CA - G3` intermediate and could accept certificate paths through distrusted intermediates. These three advisories are *not* in `deny.toml`'s ignore list, so no ledger row is created for them; the ledger owns only ignored advisories. Verification requires a fresh locked CI audit.

The affected graph was `webpki-roots` 1.0.9 and `webpki-root-certs` 1.0.9 through `rustls` 0.23.46 and `rustls-platform-verifier` 0.7.0, reaching the capture, vault and CLI crates that make outbound HTTPS requests. The locked graph now resolves 1.0.10 for both crates.

## Review procedure

1. Fetch the current official RustSec database and run `cargo audit` and `cargo deny check` against the locked graph, including production targets and optional features.
2. Check withdrawals, patched versions, advisory type, target/feature reachability, and the parent preventing a compatible migration.
3. Remove an ignore immediately when its advisory is withdrawn, its package is absent, or a compatible maintained path is verified.
4. Record fresh evidence before extending a deadline; never suppress a new vulnerability to make a gate pass.
5. Treat an expired review or unresolved vulnerability-class advisory as a production release blocker. A current maintenance ledger alone is not release certification.
