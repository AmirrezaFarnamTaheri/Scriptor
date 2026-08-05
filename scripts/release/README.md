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
| `stage-release-assets.mjs` | Copies only distributable installers and target-status records into the upload boundary. |
| `write-manifest.ps1` | Writes Windows installer SHA-256 metadata for local compatibility checks. |
| `version.mjs` | Checks or synchronizes the canonical version. |
| `source-identity.mjs` | Computes archive diagnostics or canonical commit-bound SHA-256 source identity from Git blobs and modes. |
| `generate-sbom.mjs` | Generates the CycloneDX source/dependency SBOM. |
| `create-receipt.mjs` | Creates receipt schema 4 with exact subjects, checksums, source identity, and target status. |
| `verify-release-evidence.mjs` | Rejects source, SBOM, checksum, status, path, or subject-set drift before publication. |

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

Installers land under `target/release/bundle/`. Before upload, run the target-specific status writer and exact staging script. Example:

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux --architecture x86_64 --channel preview \
  --signed false --notarized false --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
node scripts/release/stage-release-assets.mjs \
  --platform linux --architecture x86_64 --output-dir release-output
```

`release-output` must contain only installable package files and one target-status JSON record. AppDir contents, `.app` internals, logs, and arbitrary bundle files are not release subjects.

## Production workflow

1. Merge a reviewed change whose synchronized `VERSION` differs from the prior release.
2. `Release Kickoff` validates parity and creates `v<VERSION>` without moving any existing tag.
3. Kickoff dispatches `Release` on that tag because ordinary tag-push recursion from `GITHUB_TOKEN` is suppressed by GitHub.
4. The unified matrix packages Windows x86_64, macOS aarch64, Linux x86_64, and Linux aarch64.
5. Publication verifies the complete target matrix, generates evidence, attests exact subjects, and creates or updates one GitHub Release.

The release is blocked by missing artifacts, target-status drift, source drift, checksum/SBOM/receipt mismatch, unreceipted files, or attestation failure. It is not blocked by absent signing certificates because official upstream artifacts make no publisher-signature claim.

## Related documents

- [`docs/RELEASE-CHECKLIST.md`](../../docs/RELEASE-CHECKLIST.md)
- [`docs/RELEASE-SECURITY.md`](../../docs/RELEASE-SECURITY.md)
- [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md)
- [`docs/release/SIGNING.md`](../../docs/release/SIGNING.md)
- [`docs/release/PANDOC_STRATEGY.md`](../../docs/release/PANDOC_STRATEGY.md)
