# Production release checklist

A production release is blocked until every required item is checked against the exact tag and artifact bytes.

## Promotion stop conditions

- [ ] stop if any required item below is pending, failed, skipped, or evidenced against a different source tree;
- [ ] stop if the artifact subject set differs from the receipt by even one file;
- [ ] stop if a target is missing, duplicated, unexpectedly added, or mislabeled;
- [ ] stop if initial editor chunks enter the eager bundle graph or the gzip budget regresses;
- [ ] stop if destructive-action cancellation/failure leaves disk, tabs, index, or vault state divergent;
- [ ] stop if a process launch lacks a live per-call inventory entry or its review has expired;
- [ ] stop if rollback, restore, trust status, or observability cannot be demonstrated on the target platform;
- [ ] stop if any RustSec exception review is expired or lacks an owner/exit condition;
- [ ] stop if Playwright E2E or visual regression is skipped or missing from the exact-head CI matrix.

## Source freeze

- [ ] clean canonical working tree;
- [ ] synchronized npm, Cargo, Tauri, and lockfile metadata matches `VERSION`;
- [ ] reviewed `v<version>` tag matches `VERSION` and the exact release commit;
- [ ] an existing version tag is never moved or reused;
- [ ] `pnpm check:governance` passes;
- [ ] `pnpm check:source` passes;
- [ ] lockfiles are unchanged by validation;
- [ ] full history/secret/provenance audit is reconciled to the tag.

## Engineering verification

- [ ] frozen pnpm install succeeds;
- [ ] lint, TypeScript build, package contract runners, and unit/integration tests pass;
- [ ] Cargo fmt, Clippy, tests, and cargo-deny pass on product and incubating profiles;
- [ ] daemon, CLI/TUI, container, E2E, visual, axe, and performance gates pass;
- [ ] no skipped or flaky test is silently accepted.

## Security and data integrity

- [ ] every new native command is classified and authorization-inventoried;
- [ ] no new remote fallback, generic secret API, shell string, unbounded queue/log/output, or unchecked boundary assertion;
- [ ] release workflows contain no certificate, notarization, private-key, or signing-secret dependency;
- [ ] official release notes clearly disclose that installers are unsigned;
- [ ] backup creation, corruption rejection, interrupted restore, and successful restore are drilled;
- [ ] MCP interrupted-mutation reconciliation and audit integrity are drilled;
- [ ] privacy and diagnostic output is redacted and bounded.

## UI quality

- [ ] screenshots regenerated and reviewed at all required breakpoints and themes;
- [ ] no console errors or failed network resources;
- [ ] keyboard and focus order pass, including every modal, composite tab control, and toolbar popover;
- [ ] Typography and Insert menus render outside scroll-clipping ancestors, remain within the viewport, and restore focus on Escape;
- [ ] axe has no critical or serious violation;
- [ ] screen-reader, 200% zoom, reduced-motion, and high-contrast spot checks pass;
- [ ] empty, loading, error, success, and destructive states are visually reviewed.

## Artifact production

- [ ] build once from the frozen tag;
- [ ] Windows x86_64 produces exactly one MSI and one NSIS EXE;
- [ ] macOS aarch64 produces exactly one DMG;
- [ ] Linux x86_64 produces exactly one DEB and one AppImage;
- [ ] Linux aarch64 produces exactly one DEB and one AppImage;
- [ ] every target writes one `signing-evidence-<platform>-<architecture>.json` record;
- [ ] official target records report `signed: false`, `notarized: false`, and `signatureType: "none"`;
- [ ] artifact names include version, platform, and architecture and cannot collide;
- [ ] staged artifact membership contains only installers and target-status records;
- [ ] unpacked AppDir contents, `.app` internals, logs, caches, source maps, and development files are absent;
- [ ] clean install and smoke test pass on every supported target.

## Provenance and publication

- [ ] the primary `Release` workflow is the only GitHub Release owner;
- [ ] preview dispatch does not publish;
- [ ] production dispatch is bound to an existing immutable `v*` tag;
- [ ] generate `SHA256SUMS` over the exact staged subject set;
- [ ] generate CycloneDX 1.6 SBOM;
- [ ] generate release receipt schema 4 with source/toolchain/artifact hashes and architecture-bound trust status;
- [ ] verify receipt, checksum, SBOM, source identity, and exact subject membership before upload;
- [ ] generate GitHub artifact attestations for every staged subject;
- [ ] publish the exact downloaded build artifacts without rebuilding;
- [ ] verify consumer instructions in `RELEASE-SECURITY.md` against the published assets;
- [ ] confirm release notes include unknown-publisher guidance and checksum/attestation commands;
- [ ] update changelog, capability ledger, support window, and known limitations.
