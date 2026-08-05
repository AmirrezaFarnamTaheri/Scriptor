# Release security and verification

## Source of version truth

`VERSION` is canonical. `node scripts/release/version.mjs check` fails when an npm package, Cargo package, Tauri config, workflow input, or release tag disagrees. `node scripts/release/version.mjs sync` is used only in a reviewed version-change branch; lockfiles are regenerated and checked before merge.

## Channels and release ownership

- **Preview:** a manual run with `publish: false`. It packages the requested version, uploads workflow artifacts, and never creates a GitHub Release.
- **Production:** an immutable `v<version>` tag whose value matches `VERSION`. The primary `Release` workflow is the only workflow allowed to create or modify a GitHub Release.

A `VERSION` change merged to `main` starts `Release Kickoff`. It validates version parity, creates the tag only when it does not already exist, refuses to move or reuse a tag that points elsewhere, and dispatches the production workflow on that tag. The explicit dispatch is required because GitHub suppresses ordinary workflow recursion for events created with `GITHUB_TOKEN`.

## Official artifact trust model

Official Scriptor installers are intentionally **unsigned**. The release workflow has no certificate, notarization, private-key, or signing-secret dependency. Windows and macOS may therefore display unknown-publisher or unidentified-developer warnings.

The supported upstream target matrix is:

| Platform | Architecture | Published installer kinds |
|---|---|---|
| Windows | `x86_64` | MSI, NSIS EXE |
| macOS | `aarch64` | DMG |
| Linux | `x86_64` | DEB, AppImage |
| Linux | `aarch64` | DEB, AppImage |

Every packaging job writes one architecture-bound record named `signing-evidence-<platform>-<architecture>.json`. Official records state:

- `signed: false`;
- `notarized: false`;
- `signatureType: "none"`;
- the exact source commit;
- the release channel, target platform, and architecture;
- the verifier instruction: checksum plus GitHub attestation.

The publication job requires exactly one record for every supported target. Missing, duplicate, unexpected, wrong-channel, or wrong-commit records block publication.

Release receipt schema 4 embeds the verified target matrix alongside source identity, toolchain metadata, checksums, and the exact release subject set. It permits an unsigned production record but never permits missing or falsely described trust status.

## Exact artifact boundary

The workflow stages only distributable installer files and architecture-bound trust-status records. It does not publish unpacked AppDir contents, `.app` internals, CI logs, caches, source maps, temporary key material, or arbitrary files under `target/release/bundle`.

Publication downloads those staged files and does not rebuild. It then generates:

- `SHA256SUMS` for the exact subject set;
- CycloneDX 1.6 SBOM;
- source-bound release receipt schema 4;
- GitHub artifact attestations for every staged subject.

## Supply-chain controls

- external actions pinned to reviewed full commit SHAs;
- fixed runner labels and pinned Node, pnpm, and Rust versions;
- frozen pnpm dependency installation and locked Cargo resolution;
- architecture-specific artifact names to prevent x86_64/aarch64 collisions;
- immutable tag creation with refusal to retarget an existing version;
- exact subject-set verification before release upload;
- clean-checkout source identity bound to the release commit;
- retained packaging and publication diagnostics that are not mixed into release assets.

## Consumer verification

Download the installer, `SHA256SUMS`, `scriptor.cyclonedx.json`, and `release-receipt.json` from the same GitHub Release.

Verify the GitHub attestation:

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux checksum verification:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

macOS checksum verification:

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

Windows PowerShell checksum verification:

```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$expected = (Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }).Split(' ')[0]
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $expected -or $actual -ne $expected) { throw 'Checksum verification failed.' }
```

Maintainers can additionally download the complete subject set into `release-artifacts`, place SBOM/checksum/receipt files in `release-evidence`, check out the exact tag, and run:

```bash
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

A missing or invalid checksum, SBOM, receipt, target-status record, source identity, exact-subject match, or GitHub attestation is a production release blocker. An operating-system publisher signature is not claimed for official upstream installers.
