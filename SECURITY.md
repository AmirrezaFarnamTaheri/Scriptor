# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Email **taherifarnam@gmail.com** with:

- affected version/commit;
- environment and prerequisites;
- reproducible steps or proof of concept;
- impact and data/authority crossed;
- suggested embargo or coordination needs.

Do not include real secrets or third-party personal data. Reports are acknowledged as soon as practical; disclosure timing is coordinated after impact and remediation are understood.

## Supported version

Only the current tagged release and current `main` branch receive security fixes. Release identity comes from [`VERSION`](VERSION).

## Trust boundaries

- **Renderer:** treated as untrusted relative to native filesystem, keychain, process, backup, Git, network, and publish authority.
- **Tauri commands:** classified by operation; sensitive commands require a fresh one-time scoped grant issued after native user confirmation.
- **Daemon/IPC:** same-user local endpoint with HMAC-protected endpoint metadata, a per-endpoint nonce required on every request and event subscription, typed/versioned messages, bounded frames/queues, automatic authenticated resubscription, and explicit state resynchronization after an interrupted event stream. Note that on Windows, local TCP/named pipe endpoint security relies on HMAC-SHA256 bearer token authentication stored in user-scoped `%LOCALAPPDATA%` (or OS Credential Manager) rather than Unix socket filesystem permissions.
- **MCP:** explicit tools, durable intent/outcome audit records, idempotency keys, bounded logs, and recovery of pending intents.
- **External tools/code chunks:** launched through the process broker with executable resolution, environment sanitization, network policy, time/output bounds, process-tree cancellation, and receipts.
- **Plugins:** current runtime is restricted/manifest-first; permission consent, signed third-party distribution, and isolated execution remain graduation requirements.
- **AI providers:** credentials stay in the native keychain boundary; network calls are issued by Rust through validated endpoints and do not expose raw secrets to JavaScript.

## Data and privacy

Scriptor is local-first. It does not require telemetry. Diagnostics are opt-in and should include only allowlisted, redacted fields. Remote PlantUML and remote fonts are disabled. Any optional remote integration must name the endpoint and data sent.

## Encryption status

`crates/vault/src/encryption.rs` contains versioned cryptographic primitives and tests. **Encrypted vaults are experimental and not a supported end-to-end security capability.** Indexes, backups, Git history, temporary files, metadata leakage, key recovery, and migration are not solved by a per-file primitive alone. See [`docs/ENCRYPTION-THREAT-MODEL.md`](docs/ENCRYPTION-THREAT-MODEL.md).

## Release integrity

Production artifacts require platform signatures, notarization where applicable, SHA-256 checksums, CycloneDX SBOM, immutable release receipt, and GitHub provenance attestations. Verification instructions: [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md).
The production go/no-go sequence is [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md); the current evidence vocabulary and unverified areas are recorded in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Dependency and CI policy

- lockfiles are validation inputs and must not be mutated by audit jobs;
- external GitHub Actions use reviewed immutable commit SHAs with exact version comments;
- Node, pnpm, Rust, runners, and release tools are pinned;
- `cargo deny`, `pnpm audit --prod`, action pin, version, boundary, docs, and source-contract gates run in CI;
- dependency updates occur in separate reviewed changes.
