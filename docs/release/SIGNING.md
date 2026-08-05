# Release signing and notarization

Scriptor separates preview packaging from production publication.

- Preview builds may be unsigned and are not published automatically.
- Every `v*` production tag fails closed unless all Windows, macOS, and Linux signing credentials are configured.
- Production publication accepts only installers accompanied by source-bound platform signing evidence.

## Required production credentials

| Platform | Artifacts | Required secrets |
|---|---|---|
| Windows | MSI, NSIS | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` |
| macOS | DMG and app bundle | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` |
| Linux | DEB, AppImage | `LINUX_SIGNING_KEY` |

`APPLE_CERTIFICATE` and `WINDOWS_CERTIFICATE` are base64-encoded certificate files. `LINUX_SIGNING_KEY` is a base64-encoded armored private key. Secrets are imported only into the ephemeral runner environment.

## Validation sequence

1. `validate-signing-policy.mjs` verifies all required inputs before a production platform job builds.
2. The platform-native signing tool signs and verifies every installer.
3. macOS notarization is stapled and validated.
4. `write-signing-evidence.mjs` writes a commit-bound record into the platform artifact.
5. The publication job downloads all platform artifacts and runs `verify-signing-evidence.mjs`.
6. The verified records are embedded in release receipt schema 3.
7. SBOM, checksums, receipt, signatures, and the exact installers are published without rebuilding.

## Local validation

Preview packaging may omit signing inputs:

```powershell
$env:SCRIPTOR_RELEASE_CHANNEL = 'preview'
pnpm --dir apps/desktop build
```

A local production candidate must provide the same environment variables as CI and pass:

```powershell
$env:SCRIPTOR_RELEASE_CHANNEL = 'production'
node scripts/release/validate-signing-policy.mjs --platform windows --channel production
powershell -ExecutionPolicy Bypass -File scripts/release/sign-installers.ps1
```

Equivalent macOS and Linux verification must be performed on their native platforms. Production credentials must never be written to files inside the repository.

## Evidence format

Each `signing-evidence-<platform>.json` record includes:

- schema version;
- platform and release channel;
- signed and notarized status;
- signature type and verifier;
- source commit;
- creation timestamp.

The production verifier requires one unique record for each supported platform, `signed: true` everywhere, and `notarized: true` for macOS.
