# Contributing

## Before changing code

1. Read [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
2. Check [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) before extending an experimental surface.
3. For TypeScript packages, read [`packages/README.md`](packages/README.md); import packages only through declared entry points.
4. Preserve unrelated staged, unstaged, and untracked work.

## Toolchain

The local gates use Node.js 22.12 or newer, pnpm 10.33.0, Rust 1.96.0, and
PowerShell 7 (`pwsh`). Browser accessibility checks also need a ChromeDriver
that matches the installed Chrome version; set `CHROMEWEBDRIVER` when it is not
discoverable automatically.

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

## Development

```powershell
pnpm web:dev
pnpm desktop:dev
```

## Change process

- Reproduce bugs with a failing test before the fix.
- Keep mutation, refactor, dependency update, and generated-file changes reviewable.
- Route external commands through `crates/system-bridge/src/process.rs`.
- Validate runtime JSON from `unknown`; do not add unchecked boundary assertions.
- Add authorization classification for every new native command.
- Use bounded queues/collections/output for long-lived or user-controlled data.
- Update source-of-truth files, then regenerate derived contracts.
- Update docs and the capability ledger when maturity or support changes.

## Required checks

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
pnpm lint
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Run focused package validators and relevant Playwright suites for the changed behavior. UI changes must include keyboard, screen-reader semantics, loading/empty/error states, narrow viewport, and 200% zoom evidence.

`pnpm check:release` is a broad release gate, not the fastest local feedback
loop. Start with the focused checks above, then run the full gate on a machine
with the desktop/browser prerequisites installed.

Proof terminology and platform/release gates are defined in [`docs/VERIFICATION.md`](docs/VERIFICATION.md). Never describe a static source check as a compiled, packaged, native, or browser-verified result.

## Pull requests

Describe:

- observable behavior changed;
- authority/data boundaries affected;
- tests and commands run with results;
- migration/rollback behavior;
- screenshots for user-visible changes;
- unverified platforms or residual risks.

Do not commit secrets, generated build directories, debug logs, or personal vault data.

## Licensing

Unless otherwise stated, contributions are licensed under **AGPL-3.0-or-later**. By submitting a contribution, you represent that you have the right to license it on those terms. See [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md) for the separate-license policy.

## Security

Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md).
