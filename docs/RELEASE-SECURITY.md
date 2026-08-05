# Release security and verification

## Source of version truth

`VERSION` is canonical. `node scripts/release/version.mjs check` fails when any npm package, Cargo package, Tauri config, workflow input, or tag disagrees. `version:sync` intentionally updates manifests in a reviewed release change.

## Channels

- **Preview:** manual, may be unsigned, and is never published automatically.
- **Production:** every `v*` tag. All platform signing inputs are mandatory and validated before packaging starts.

A production build fails before compilation when any required credential is absent. There is no best-effort production mode and no automatic downgrade to an unsigned public artifact.

## Production signing contract

| Platform | Required inputs | Required proof |
|---|---|---|
| Windows | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | Authenticode signature and `signtool verify /pa` for every MSI/NSIS installer |
| macOS | certificate, identity, Apple ID, app password, and team ID | Developer ID signature, notarization, `codesign --verify`, and `stapler validate` |
| Linux | `LINUX_SIGNING_KEY` | armored detached OpenPGP signature for every DEB/AppImage plus exported public key |

Each packaging job writes `signing-evidence-<platform>.json`. The publication job requires exactly one valid record for Windows, macOS, and Linux, binds every record to the release commit, and rejects unsigned production evidence. macOS production evidence must also state `notarized: true`.

The release receipt uses schema version 3 and embeds the verified signing evidence alongside source identity, toolchain metadata, checksums, and the exact artifact subject set. A receipt cannot be created or verified for a production release unless signing evidence is complete and valid.

## Supply-chain controls

- external actions pinned to full reviewed SHAs with exact version comments;
- fixed runner labels, Node `22.16.0`, pnpm `10.33.0`, Rust `1.96.0`, cargo-deny `0.20.2`;
- frozen pnpm install and `cargo metadata --locked`;
- validation jobs compare lockfile hashes and may not update them;
- every ignored RustSec advisory has a reachable-surface owner, review deadline, upstream reference, and exit condition in [`security/RUSTSEC-EXCEPTIONS.md`](security/RUSTSEC-EXCEPTIONS.md);
- checksums, CycloneDX 1.6 SBOM, source/tool receipt, signing evidence, and GitHub/Sigstore attestations;
- publication downloads build artifacts and uploads those exact bytes; it does not rebuild.

## Consumer verification

After downloading an artifact, SBOM, `SHA256SUMS`, receipt, and public key:

```bash
sha256sum --check SHA256SUMS
gh attestation verify <artifact> --repo AmirrezaFarnamTaheri/Scriptor
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

Linux:

```bash
gpg --import scriptor-release-public-key.asc
gpg --verify <artifact>.asc <artifact>
```

Windows:

```powershell
Get-AuthenticodeSignature .\Scriptor*.exe
signtool verify /pa .\Scriptor*.exe
```

macOS:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Scriptor.app
spctl --assess --type execute --verbose=4 /Applications/Scriptor.app
xcrun stapler validate Scriptor*.dmg
```

A missing or invalid checksum, SBOM, receipt, attestation, platform signature, or macOS notarization record is a production release blocker.
