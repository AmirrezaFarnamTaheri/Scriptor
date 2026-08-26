# Scriptor project guidance

> **Pointer file.** The authoritative agent rules live in [`AGENTS.md`](AGENTS.md).
> Contributor workflow and gates live in [`CONTRIBUTING.md`](CONTRIBUTING.md).
> Design and visual contract live in [`DESIGN.md`](DESIGN.md).
> Toolchain versions and script names are read from `package.json` and `Cargo.toml`, not duplicated here.

## Source of truth

| Concern | Authoritative file |
|---|---|
| Agent rules / change discipline | [`AGENTS.md`](AGENTS.md) |
| Contributor workflow, PRs, required checks | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| UI / accessibility / visual system | [`DESIGN.md`](DESIGN.md) |
| Architecture, runtime topology | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Capability status (shipped / experimental / design-only) | [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) |
| Verification vocabulary and proof gates | [`docs/VERIFICATION.md`](docs/VERIFICATION.md) |
| Toolchain versions | `package.json` (`engines`, `packageManager`), `Cargo.toml`, `rust-toolchain.toml` |
| Theme values, typography, spacing | `src/index.css`, `src/styles/` |
| Package boundaries | `packages/*/package.json` + boundary validation scripts |

When this file or any other document disagrees with the executable configuration (`package.json`, `Cargo.toml`, source files), update the document to match the configuration — do not patch the configuration to match the document.

## Update discipline

When you change behavior, claims, or toolchain versions, update the source-of-truth files in the same change. Do not duplicate the same fact across multiple `.md` files; instead, link to the authoritative one. New evidence belongs in [`docs/VERIFICATION.md`](docs/VERIFICATION.md), not in a separate status snapshot.
