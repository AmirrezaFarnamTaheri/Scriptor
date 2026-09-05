# RustSec advisory exception ledger

This ledger owns every advisory temporarily ignored by `cargo-deny`. An ignore is not a dismissal: it records a reviewed, reachable dependency constraint with a named owner, a dated re-review, and a concrete exit condition. Upgradeable vulnerabilities remain denied by CI.

**Owner:** Scriptor release and security maintainers
**Review cadence:** monthly and before every production tag
**Last full review:** 2026-09-03
**Next full review:** 2026-10-01

### 2026-09-03 review evidence

- The ignored GTK3/Tauri, `proc-macro-error`, `atomic-polyfill`, `paste`, and
  `rust-unic` advisories remain RustSec **INFO / unmaintained** advisories with
  no patched versions. Their locked packages are still present because the
  supported Tauri/Linux or transitive product graph has no compatible
  maintained replacement in this checkout.
- `RUSTSEC-2025-0057` (`fxhash`) was removed from both this ledger and
  `deny.toml`: `fxhash` is no longer present in `Cargo.lock`, so retaining the
  exception would hide future reintroduction instead of documenting current
  reachability.
- This review does not suppress newly issued vulnerabilities. `cargo deny`
  remains the production authority for advisories outside this exact list;
  the next production-capable environment must run it against the current
  advisory database before tagging.

### 2026-09-05 integration audit follow-up

A freshly fetched RustSec database reported no vulnerability-class advisories,
18 unmaintained packages, and informational unsoundness advisories for `glib`
and two `lru` versions. The terminal UI dependency was updated from `lru`
0.18.1 to the patched 0.18.2. Tantivy 0.26.1 still resolves `lru` 0.16.4;
updating within its compatible release range did not provide a replacement.
The Linux Tauri stack still resolves `glib` 0.18.5, affected by
RUSTSEC-2024-0429. These two remaining unsoundness findings are **not** added
to the ignore list. They remain upstream dependency work and must be assessed
before a production release. The audit disabled yanked-version lookup, so it
does not establish that the lockfile is free of yanked releases.

| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | Remove when Tauri/WebKitGTK no longer resolves the affected unmaintained crate |
| RUSTSEC-2024-0411 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0412 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0413 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0414 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0415 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0416 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0417 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0418 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0419 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2024-0420 | GTK/Tauri Linux desktop stack | Linux desktop packaging and runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | Remove when the supported Tauri Linux stack has a maintained replacement |
| RUSTSEC-2023-0089 | Transitive product dependency | Product dependency graph; no safe compatible upgrade recorded | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | Remove on patched parent release or replace the parent dependency |
| RUSTSEC-2024-0436 | Transitive product dependency | Product dependency graph; no safe compatible upgrade recorded | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | Remove on patched parent release or replace the parent dependency |
| RUSTSEC-2025-0075 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0080 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0081 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0098 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |
| RUSTSEC-2025-0100 | `rust-unic` via Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | Remove when Tauri replaces the unmaintained `rust-unic` family |

## Review procedure

1. Run `cargo deny check` and `cargo tree -i <crate>` against the locked graph.
2. Confirm whether the advisory remains unmaintained-only or has become an exploitable vulnerability.
3. Record the reachable Scriptor surface and the direct parent that prevents removal.
4. Remove the ignore immediately when a compatible maintained path exists.
5. Treat a missed `Review by` date as a production release blocker.
