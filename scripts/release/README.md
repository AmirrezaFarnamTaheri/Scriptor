# Release scripts

Release engineering scripts for Scriptor.

## Source of truth

- [`VERSION`](../../VERSION) is the canonical release version.
- `node scripts/release/version.mjs check` verifies npm, Cargo, Tauri, workflow-input, and tag parity.
- `node scripts/release/version.mjs sync` updates versioned manifests in a reviewed release branch; lockfiles are regenerated separately.
- Built-in self-updating is not shipped. Release scripts must not inject updater configuration or permissions.
- Official GitHub Release installers are intentionally unsigned. Publication depends on source identity, exact artifact membership, SHA-256 checksums, CycloneDX SBOM, receipt schema 4, architecture-bound trust-status evidence, and GitHub attestations rather than repository signing secrets.

## Main scripts

| Script | Purpose |
|---|---|
| `package.ps1` | Local full pre-release pipeline and optional Tauri bundle. |
| `smoke.ps1` | CLI workflow smoke on the minimal fixture vault. |
| `perf-gate.ps1` | Enforces scan/search performance budgets. |
| `validate-signing-policy.mjs` | Validates the explicit secret-free release policy and target identity. |
| `write-signing-evidence.mjs` | Writes source-bound platform/architecture trust status. |
| `verify-signing-evidence.mjs` | Requires the complete supported target matrix and rejects status drift. |
| `verify-bundle.mjs` | Cross-platform post-bundle artifact validation. |
| `stage-release-assets.mjs` | Copies only distributable installers and target-status records into transport artifacts. |
| `write-manifest.ps1` | Writes Windows installer SHA-256 metadata for local verification. |
| `version.mjs` | Checks or synchronizes the canonical version. |
| `source-identity.mjs` | Computes archive diagnostics or canonical commit-bound SHA-256 source identity from Git blobs and modes. |
| `generate-sbom.mjs` | Generates the CycloneDX source/dependency SBOM. |
| `create-receipt.mjs` | Creates receipt schema 4 with exact installer subjects, checksums, source identity, and target status from the evidence directory. |
| `verify-release-evidence.mjs` | Rejects source, SBOM, checksum, status, path, or installer-subject drift before publication. |
| `review-binaries.ps1` | Creates a source-bound SHA-256 manifest for the CLI and daemon release binaries without publishing anything. |

## Pinned environment

- Node.js `22.16.0`
- pnpm `10.33.0`
- Rust `1.96.0` with `rustfmt` and `clippy`
- PowerShell 7 (`pwsh`)

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

## Local candidate validation

```powershell
pnpm version:check
pnpm check:governance
pnpm check:source
pnpm check:contracts
pnpm check:release-evidence-contracts
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release/package.ps1 -SkipTauri
```

Build the desktop bundle only after the source checks pass:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release/package.ps1
```

Installers land under `target/release/bundle/`. Before transport, run the target-specific status writer and exact staging script. Example:

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux --architecture x86_64 --channel preview \
  --signed false --notarized false --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
node scripts/release/stage-release-assets.mjs \
  --platform linux --architecture x86_64 --output-dir release-output
```

`release-output` must contain only installable package files and one target-status JSON record. AppDir contents, `.app` internals, logs, and arbitrary bundle files are excluded. In publication, trust records move to `release-evidence`, while `release-artifacts` contains only the seven installers that are checksummed and attested.

## Production workflow

1. Merge a reviewed change whose synchronized `VERSION` differs from the prior release.
2. A release operator manually dispatches `Release Kickoff`, enters the exact `VERSION`, and passes the protected `release-production` environment review.
3. `Release Kickoff` validates parity and a successful exact-commit `main` CI run, creates `v<VERSION>` without moving any existing tag, and dispatches `Release` on that immutable tag.
4. The unified matrix packages Windows x86_64, macOS aarch64, Linux x86_64, and Linux aarch64.
5. The protected publication job proves exactly seven installers and four trust records, separates them, verifies the target matrix, generates evidence, attests only installers, and creates or updates one GitHub Release.

Production release and Pages workflows are manual-only. Update manifests are attached to the immutable version release; the workflows never create or force-move a rolling tag.

The release is blocked by missing artifacts, target-status drift, source drift, checksum/SBOM/receipt mismatch, unreceipted installer files, or attestation failure. It is not blocked by absent signing certificates because official upstream artifacts make no publisher-signature claim.

The non-publishing `Release Binary Review` workflow exercises the frozen source contracts and
creates a review artifact for the release CLI and daemon binaries. It does not build desktop
installers, create tags or releases, or upload production installers; installer validation remains
the responsibility of the protected production release workflow.

## Related documents

- [`docs/RELEASE-CHECKLIST.md`](../../docs/RELEASE-CHECKLIST.md)
- [`docs/RELEASE-SECURITY.md`](../../docs/RELEASE-SECURITY.md)
- [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md)
- [`docs/release/SIGNING.md`](../../docs/release/SIGNING.md)
- [`docs/release/PANDOC_STRATEGY.md`](../../docs/release/PANDOC_STRATEGY.md)
