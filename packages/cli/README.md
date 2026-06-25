# `@scriptor/cli`

TypeScript contract aliases for CLI-facing types live in `@scriptor/core`.

The native CLI is the Rust crate **`scriptor-cli`** (`crates/cli`).

```bash
pnpm cli -- open ./my-vault
pnpm cli -- health-diagnostics ./my-vault
pnpm cli -- tui ./my-vault --via-daemon
cargo run -p scriptor-daemon -- serve
```

See [`docs/contracts/COMMAND_CATALOG.md`](../../docs/contracts/COMMAND_CATALOG.md).
