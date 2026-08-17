# Scriptor

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-0f766e.svg)](VERSION)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

**A local-first Markdown workspace for serious writing and research.** Scriptor combines a Tauri desktop shell, a Rust vault/indexing kernel, a React workspace, Git-aware editing, citations, graph navigation, publishing, canvas tools, and permissioned automation while keeping Markdown files portable on disk.


## Current release posture

Version `1.0.0` is an early production candidate. Core writing, vault, indexing, knowledge, Git, export, daemon, and desktop surfaces are implemented. Experimental capabilities are identified in [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md); encryption, WASM plugins, local embeddings, mobile, and Tantivy are not marketed as shipped security or platform guarantees.

## Principles

- **Local-first:** Markdown remains the source of truth.
- **Explicit authority:** destructive, secret, network, process, backup, and publishing actions require scoped authorization.
- **Bounded work:** scans, graph traversals, event queues, subprocess output, logs, and audit tails have explicit limits.
- **Recoverable mutation:** Git commits isolate the index, MCP writes use intent/outcome records, and restores verify manifests before promotion.
- **One contract per boundary:** Rust IPC definitions generate TypeScript contracts; runtime JSON is validated before use.
- **Honest maturity:** implemented, experimental, and design-only capabilities are documented separately.

## Requirements

- Node.js `22.16.0`
- pnpm `10.33.0`
- Rust `1.96.0`
- Platform dependencies required by Tauri 2

## Start from source

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pnpm dev --host 127.0.0.1
```

Desktop development:

```powershell
pnpm desktop:dev
```

See [`docs/guides/GETTING_STARTED.md`](docs/guides/GETTING_STARTED.md) for first-run and vault workflows.

## Verification

Fast repository-native checks:

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

Full verification:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The full release gate includes contract runners, Rust tests, Playwright E2E/visual/accessibility tests, daemon/TUI/container smoke tests, performance gates, dependency audits, release packaging, and signature checks.

## Architecture

The current architecture, trust boundaries, data flows, and crate/package ownership are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Key implementation roots:

| Plane | Entry points |
|---|---|
| Desktop | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| Vault | `crates/vault/src/lib.rs` |
| Index/search/graph | `crates/indexer/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| External tools | `crates/system-bridge/src/process.rs` |
| Frontend packages | `packages/*/src/index.ts` |

Workspace package imports are enforced through declared `package.json` exports. See [`packages/README.md`](packages/README.md).

## Release security

Production releases are tag-driven and fail unless:

- tag/input version matches [`VERSION`](VERSION) and every manifest;
- GitHub Actions are pinned to immutable SHAs;
- Windows installers are Authenticode-signed;
- macOS bundles are Developer ID-signed and notarized;
- Linux packages have detached OpenPGP signatures;
- checksums, CycloneDX SBOM, release receipt, and GitHub attestations are produced from the same downloaded build artifacts.

Verification instructions: [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md).

## Documentation

- [`docs/README.md`](docs/README.md) — documentation index
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current architecture and trust boundaries
- [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) — shipped/experimental/design-only ledger
- [`PRODUCT.md`](PRODUCT.md) — product outcomes and exclusions
- [`DESIGN.md`](DESIGN.md) — UI system and accessibility contract
- [`SECURITY.md`](SECURITY.md) — threat boundaries and vulnerability reporting
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development and verification workflow
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`docs/FINAL-REMEDIATION-REPORT.md`](docs/FINAL-REMEDIATION-REPORT.md) — current v1 product and release baseline
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — exact proof boundaries and required commands
- [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) — production go/no-go checklist

## License

Scriptor is licensed under **GNU AGPL-3.0-or-later**, including commercial use when the license obligations are followed. Organizations that do not want to comply with the AGPL may request a separate commercial license; see [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md).

## Maintainer

Amirreza “Farnam” Taheri — [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) — [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
