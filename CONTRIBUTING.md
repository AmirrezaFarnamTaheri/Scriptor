# Contributing to Scriptor

Thank you for considering a contribution to Scriptor.

## Before you start

1. Read [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md) for product and UX constraints.
2. Check [open issues](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues) to avoid duplicate work.
3. For large changes, open an issue or draft PR early for alignment with the maintainer.

## Development setup

**Requirements:** Node.js 22+, pnpm 9+, Rust stable.

```powershell
pnpm install
pnpm desktop:dev
```

### Validation before submitting

```powershell
pnpm build
pnpm lint
pnpm check:release
```

Targeted checks during development:

```powershell
pnpm check:contracts   # TypeScript contract packages
pnpm check:plugins     # Plugin manifest validation
pnpm check:daemon      # Headless daemon IPC smoke
pnpm check:tui         # Terminal UI smoke
pnpm test:rust         # Rust unit tests
```

## Documentation and screenshots

- Update docs when behavior, commands, or UI copy changes.
- User-visible changes belong in [`CHANGELOG.md`](CHANGELOG.md) under **Unreleased**.
- If you change workspace layout, inspector panels, dialogs, or chrome visible in README/docs, regenerate screenshots:

```powershell
pnpm screenshots:capture:web
```

Commit updated PNGs under `docs/assets/screenshots/` with your PR. See [`docs/assets/screenshots/README.md`](docs/assets/screenshots/README.md).

## Pull requests

- Keep diffs focused; match existing code style and naming.
- Ensure CI checks pass (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- Do not commit build artifacts (`dist/`, `target/`, `test-results/`) or secrets (`.env`).
- Update [`CHANGELOG.md`](CHANGELOG.md) for user-visible changes.

## Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md). Do not open public issues for security reports.

## Licensing

By contributing, you agree that your contributions are licensed under the same terms as the project: **AGPL-3.0** for non-commercial use, with commercial licensing handled separately per [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md).

## Contact

**Amirreza "Farnam" Taheri** — [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
