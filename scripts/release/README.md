# Release scripts

Release engineering scripts for Scriptor `0.1.0`.

## Source of truth

- [`VERSION`](../../VERSION) is the canonical release version.
- `node scripts/release/version.mjs check` verifies npm, Cargo, Tauri, and workflow version parity.
- Built-in self-updating is not shipped. Release scripts must not inject updater configuration or permissions.
- Production release artifacts fail closed unless every platform credential is present. They are built once, signed and verified on native runners, downloaded by the promotion job, checked against source-bound signing evidence, checksummed, inventoried in a CycloneDX SBOM, receipted, and attested without rebuilding.

## Main scripts

| Script | Purpose |
|---|---|
| `package.ps1` | Local full pre-release pipeline and optional Tauri bundle. |
| `smoke.ps1` | CLI workflow smoke on the minimal fixture vault. |
| `perf-gate.ps1` | Enforces scan/search performance budgets. |
| `validate-signing-policy.mjs` | Fails closed when a production platform lacks required credentials. |
| `sign-installers.ps1` | Authenticode signing and verification for Windows artifacts. |
| `write-signing-evidence.mjs` | Writes a source-bound platform signing record. |
| `verify-signing-evidence.mjs` | Requires complete production signatures and macOS notarization. |
| `verify-bundle.mjs` | Cross-platform post-bundle artifact validation. |
| `write-manifest.ps1` | Writes SHA-256 artifact metadata. |
| `version.mjs` | Checks or synchronizes the canonical version. |
| `source-identity.mjs` | Computes archive diagnostics or canonical commit-bound SHA-256 source identity from Git blobs and modes. |
| `generate-sbom.mjs` | Generates the CycloneDX source/dependency SBOM. |
| `create-receipt.mjs` | Creates receipt schema 3 with exact subjects, checksums, source identity, and signing evidence. |
| `verify-release-evidence.mjs` | Rejects source, SBOM, checksum, path, or subject-set drift before promotion. |

## Pinned environment

- Node.js `22.16.0`
- pnpm `10.33.0`
- Rust `1.96.0` with `rustfmt` and `clippy`

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
powershell -ExecutionPolicy Bypass -File scripts/release/package.ps1 -SkipTauri
```

Build the desktop bundle only after the source checks pass:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release/package.ps1
```

Installers land under `target/release/bundle/`. A local package is not a production release until all platform signing, notarization, clean-install, restore-drill, SBOM, checksum, receipt, and attestation gates in [`docs/RELEASE-CHECKLIST.md`](../../docs/RELEASE-CHECKLIST.md) pass.

## Related documents

- [`docs/RELEASE-CHECKLIST.md`](../../docs/RELEASE-CHECKLIST.md)
- [`docs/RELEASE-SECURITY.md`](../../docs/RELEASE-SECURITY.md)
- [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md)
- [`docs/release/SIGNING.md`](../../docs/release/SIGNING.md)
- [`docs/release/PANDOC_STRATEGY.md`](../../docs/release/PANDOC_STRATEGY.md)
