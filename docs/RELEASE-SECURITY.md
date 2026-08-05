# Release security and verification

## Source of version truth

`VERSION` is canonical. `node scripts/release/version.mjs check` fails when an npm package, Cargo package, Tauri config, explicit release version, or release tag disagrees. Non-tag branch refs are not interpreted as versions. `node scripts/release/version.mjs sync` is used only in a reviewed version-change branch; lockfiles are regenerated and checked before merge.

## Channels and release ownership

- **Preview:** a manual run with `publish: false`. It derives the version from the checked-out canonical `VERSION`, uploads workflow artifacts, and never creates a GitHub Release.
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

Release receipt schema 4 embeds the verified target matrix alongside source identity, toolchain metadata, checksums, and the exact installer subject set. It permits an unsigned production record but never permits missing or falsely described trust status.

## Exact artifact boundary

Each packaging job transports only its distributable installers and one architecture-bound trust-status record. Publication then separates them into two sets:

- `release-artifacts`: exactly seven installer files—one MSI, one NSIS EXE, one DMG, two DEBs, and two AppImages;
- `release-evidence`: exactly four trust-status JSON records, then the generated SBOM, checksum file, and receipt.

Unpacked AppDir contents, `.app` internals, DMG helper scripts, CI logs, caches, source maps, temporary key material, and arbitrary files under `target/release/bundle` are never release subjects.

Publication downloads the staged files and does not rebuild. It then generates:

- `SHA256SUMS` for the seven installer subjects only;
- CycloneDX 1.6 SBOM bound to the release version and source identity;
- source-bound release receipt schema 4 containing the four normalized trust records;
- GitHub provenance and SBOM attestations for every installer subject.

The four trust-status records are published as metadata and embedded in the receipt, but they are not installer subjects and therefore are not listed in `SHA256SUMS`.

## Supply-chain controls

- external actions pinned to reviewed full commit SHAs;
- fixed runner labels and pinned Node, pnpm, and Rust versions;
- frozen pnpm dependency installation and locked Cargo resolution;
- architecture-specific artifact names to prevent x86_64/aarch64 collisions;
- immutable tag creation with refusal to retarget an existing version;
- exact installer and metadata cardinality checks before evidence generation;
- exact subject-set verification before release upload;
- clean-checkout source identity bound to the release commit;
- retained packaging and publication diagnostics that are not mixed into release assets.

## Consumer verification

Download one installer plus `SHA256SUMS`, `scriptor.cyclonedx.json`, and `release-receipt.json` from the same GitHub Release.

Verify the GitHub attestation:

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux checksum verification for one downloaded installer:

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
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
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```

Maintainers can additionally download all seven installers into `release-artifacts`, place the four trust records plus SBOM/checksum/receipt files in `release-evidence`, check out the exact tag, and run:

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

A missing or invalid checksum, SBOM, receipt, target-status record, source identity, exact-subject match, or GitHub attestation is a production release blocker. An operating-system publisher signature is not claimed for official upstream installers.
