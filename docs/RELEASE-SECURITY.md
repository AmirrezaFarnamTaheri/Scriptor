# Release security and verification

## Source of version truth

`VERSION` is canonical. `node scripts/release/version.mjs check` fails when any npm package, Cargo package, Tauri config, workflow input, or tag disagrees. `version:sync` intentionally updates manifests in a reviewed release change.

## Channels

- **Preview:** manual, may be unsigned, and is not published automatically.
- **Production:** `v*` tag or explicit production dispatch; signing is best-effort when platform credentials are configured.

## Production signing

| Platform | Required proof |
|---|---|
| Windows | Authenticode signature and `signtool verify /pa` for MSI/NSIS |
| macOS | Developer ID signature, notarization credentials, `codesign --verify`, `stapler validate` |
| Linux | armored detached OpenPGP signature for DEB/AppImage plus exported release public key |

Production workflows continue without these optional secrets and clearly record unsigned artifacts in their job logs and release evidence. Consumers should verify signatures when present and treat unsigned artifacts according to their deployment policy.

## Supply-chain controls

- external actions pinned to full reviewed SHAs with exact version comments;
- fixed runner labels, Node `22.16.0`, pnpm `10.33.0`, Rust `1.96.0`, cargo-deny `0.18.4`;
- frozen pnpm install and `cargo metadata --locked`;
- validation jobs compare lockfile hashes and may not update them;
- checksums, CycloneDX 1.6 SBOM, source/tool receipt, and GitHub/Sigstore attestations;
- publication downloads build artifacts and uploads those exact bytes; it does not rebuild.

## Consumer verification

After downloading an artifact, SBOM, `SHA256SUMS`, receipt, and public key:

```bash
sha256sum --check SHA256SUMS
gh attestation verify <artifact> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux:

```bash
gpg --import scriptor-release-public-key.asc
gpg --verify <artifact>.asc <artifact>
```

Windows:

```powershell
Get-AuthenticodeSignature .\Scriptor*.exe
```

macOS:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Scriptor.app
spctl --assess --type execute --verbose=4 /Applications/Scriptor.app
xcrun stapler validate Scriptor*.dmg
```

A missing or invalid checksum, SBOM, receipt, or attestation is a release blocker. Signatures are additionally required where the consumer deployment policy mandates them.
