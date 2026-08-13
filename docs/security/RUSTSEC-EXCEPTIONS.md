# RustSec advisory exception ledger

This ledger owns every advisory temporarily ignored by `cargo-deny`. An ignore is not a dismissal: it records a reviewed, reachable dependency constraint with a named owner, a dated re-review, and a concrete exit condition. Upgradeable vulnerabilities remain denied by CI.

**Owner:** Scriptor release and security maintainers
**Review cadence:** monthly and before every production tag
**Next full review:** 2026-09-01

| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-09-01 | Remove when Tauri/WebKitGTK no longer resolves the affected unmaintained crate |
| RUSTSEC-2024-0411 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0412 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0413 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0414 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0415 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0416 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0417 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0418 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0419 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0420 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-09-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2023-0089 | Transitive product dependency | Product dependency graph; no safe compatible upgrade recorded | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-09-01 | Remove on patched parent release or replace the parent dependency |
| RUSTSEC-2024-0436 | Transitive product dependency | Product dependency graph; no safe compatible upgrade recorded | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-09-01 | Remove on patched parent release or replace the parent dependency |
| RUSTSEC-2025-0075 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-09-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0080 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-09-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0081 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-09-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0098 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-09-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0100 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-09-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |

## Review procedure

1. Run `cargo deny check` and `cargo tree -i <crate>` against the locked graph.
2. Confirm whether the advisory remains unmaintained-only or has become an exploitable vulnerability.
3. Record the reachable Scriptor surface and the direct parent that prevents removal.
4. Remove the ignore immediately when a compatible maintained path exists.
5. Treat a missed `Review by` date as a production release blocker.
