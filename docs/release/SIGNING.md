# Release trust status and downstream signing

Scriptor separates upstream publication integrity from operating-system publisher signatures.

## Upstream policy

Official GitHub Releases are intentionally unsigned:

- no Windows certificate is required;
- no Apple Developer ID or notarization credential is required;
- no Linux OpenPGP private key is required;
- no signing secret is read by the release workflow;
- previews and production releases use the same explicit unsigned policy;
- production publication still requires complete checksum, SBOM, receipt, source-identity, exact-subject, and GitHub-attestation evidence.

This avoids the former contradiction in which release creation was nominally supported but every production job stopped before compilation when repository signing secrets were absent.

## Target-status evidence

Each build writes `signing-evidence-<platform>-<architecture>.json` using schema 2. The record includes:

- platform and architecture;
- preview or production channel;
- `signed`, `notarized`, and `signatureType` values;
- verifier instructions;
- exact source commit;
- creation timestamp.

The official workflow writes `signed: false`, `notarized: false`, and `signatureType: "none"`. The publication verifier requires the complete target matrix:

- Windows `x86_64`;
- macOS `aarch64`;
- Linux `x86_64`;
- Linux `aarch64`.

The verifier rejects duplicates, missing targets, unexpected targets, wrong channels, and source-commit mismatches. Publication moves the four records into `release-evidence`; receipt schema 4 embeds the same normalized records and verifies byte-for-byte agreement with that metadata. Trust records are not installer checksum or attestation subjects.

## Operating-system behavior

Because upstream installers are unsigned:

- Windows SmartScreen may report an unknown publisher;
- macOS Gatekeeper may require the user to approve opening the app through System Settings or the Finder context menu;
- Linux packages rely on the downloaded checksum and GitHub attestation rather than an upstream OpenPGP package signature.

Release notes must state these limitations prominently. The application must never claim an Authenticode signature, Apple notarization, or OpenPGP signature that is not present.

## Downstream distributor signing

A downstream distributor may sign a copied installer using its own certificate or package repository process. That produces different bytes and therefore a different checksum and attestation subject from the upstream GitHub Release.

A downstream distributor must:

1. verify the upstream checksum and GitHub attestation first;
2. retain the upstream receipt and source commit;
3. sign only in its controlled distribution environment;
4. publish new checksums and signature verification instructions under its own identity;
5. never replace upstream assets in the official Scriptor release.

The evidence schema can represent a correctly signed artifact for independent tooling, but official upstream CI does not import or consume private signing material.

## Local validation

Validate the secret-free policy and target matrix:

```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```

Write an unsigned local status record:

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production \
  --signed false \
  --notarized false \
  --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
```

The release verifier remains fail-closed for integrity and completeness even though publisher signing is not a prerequisite.
