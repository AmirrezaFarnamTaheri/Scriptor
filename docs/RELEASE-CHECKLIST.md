# Production release checklist

A production release is blocked until every required item is checked against the exact tag and artifact bytes.


## Promotion stop conditions

- [ ] stop if any required item below is pending, failed, skipped, or evidenced against a different source tree;
- [ ] stop if the artifact subject set differs from the receipt by even one file;
- [ ] stop if initial editor chunks enter the eager bundle graph or the gzip budget regresses;
- [ ] stop if destructive-action cancellation/failure leaves disk, tabs, index, or vault state divergent;
- [ ] stop if a process launch lacks a live per-call inventory entry or its review has expired;
- [ ] stop if rollback, restore, signing, or observability cannot be demonstrated on the target platform.

## Source freeze

- [ ] clean canonical working tree;
- [ ] reviewed `v<version>` tag matches `VERSION`;
- [ ] `npm run check:governance --silent` passes;
- [ ] `npm run check:source --silent` passes;
- [ ] lockfiles unchanged by validation;
- [ ] full history/secret/provenance audit reconciled to the tag.

## Engineering verification

- [ ] frozen pnpm install succeeds;
- [ ] lint, TypeScript build, package contract runners, and unit/integration tests pass;
- [ ] Cargo fmt, clippy, tests, and cargo-deny pass on product and incubating profiles;
- [ ] daemon, CLI/TUI, container, E2E, visual, axe, and performance gates pass;
- [ ] no skipped/flaky test is silently accepted.

## Security and data integrity

- [ ] every new native command is classified and authorization-inventoried;
- [ ] no new remote fallback, generic secret API, shell string, unbounded queue/log/output, or unchecked boundary assertion;
- [ ] backup creation, corruption rejection, interrupted restore, and successful restore are drilled;
- [ ] MCP interrupted-mutation reconciliation and audit integrity are drilled;
- [ ] privacy/diagnostic output is redacted and bounded.

## UI quality

- [ ] screenshots regenerated and reviewed at all required breakpoints/themes;
- [ ] no console errors or failed network resources;
- [ ] keyboard and focus order pass, including every modal and composite tab control;
- [ ] axe has no critical/serious violation;
- [ ] screen-reader, 200% zoom, reduced motion, and high-contrast spot checks pass;
- [ ] empty/loading/error/success/destructive states are visually reviewed.

## Artifact production

- [ ] build once from the frozen tag;
- [ ] Windows installers are Authenticode-signed and verified;
- [ ] macOS app/DMG are signed, notarized, stapled, and assessed;
- [ ] Linux packages have detached signatures;
- [ ] artifact membership contains no secrets, personal vaults, logs, caches, source maps not intended for release, or dev-only files;
- [ ] clean install and smoke test pass on every supported OS.

## Provenance and publication

- [ ] generate `SHA256SUMS`;
- [ ] generate CycloneDX SBOM;
- [ ] generate release receipt with source/toolchain/artifact hashes;
- [ ] generate GitHub/Sigstore attestations;
- [ ] publish the exact downloaded build artifacts without rebuilding;
- [ ] verify all consumer instructions in `RELEASE-SECURITY.md` against the published assets;
- [ ] update changelog, capability ledger, support window, and known limitations.
