# Maintainers

## Lead maintainer

**Amirreza "Farnam" Taheri**  
Email: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Project status

Scriptor **v0.1.0** is the first public release. The project is actively maintained by the lead maintainer.

| Area | Contact |
|------|---------|
| Bug reports | [GitHub Issues](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues) |
| Security | [SECURITY.md](SECURITY.md) — private email only |
| Commercial licensing | [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md) |
| Contributions | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Support the project

- **Star the repository:** [github.com/AmirrezaFarnamTaheri/Scriptor](https://github.com/AmirrezaFarnamTaheri/Scriptor)
- **Report issues and contribute** via pull requests
- **Donations (optional):** see [README.md](README.md#support-scriptor)

## Release process

Releases are tagged `v*` and built by [`.github/workflows/release.yml`](.github/workflows/release.yml). Installers are published to GitHub Releases. See [`docs/release/SIGNING.md`](docs/release/SIGNING.md) for signing and notarization.

## Validation matrix

The full local release gate (`pnpm check:release`) runs all checks below. CI mirrors these on Ubuntu and Windows.

| Check | Command | Scope |
|-------|---------|-------|
| Contract packages | `pnpm check:contracts` | TypeScript contract compilation |
| MCP validation | `pnpm check:mcp` | MCP tool manifest and runner |
| Plugin validation | `pnpm check:plugins` | Plugin manifest, sandbox, registry |
| Canvas validation | `pnpm check:canvas` | Canvas engine contracts |
| Editor validation | `pnpm check:editor` | Editor engine contracts |
| Renderer validation | `pnpm check:renderer` | Renderer contracts |
| Export validation | `pnpm check:export` | Export pipeline contracts |
| Portal validation | `pnpm check:portal` | Portal capture contracts |
| Knowledge validation | `pnpm check:knowledge` | Knowledge graph contracts |
| Citation validation | `pnpm check:citations` | Citation engine contracts |
| Headless validation | `pnpm check:headless` | Headless runner contracts |
| Lint | `pnpm lint` | ESLint |
| Build | `pnpm build` | Production frontend build |
| Rust tests | `pnpm test:rust` | `cargo test --workspace` |
| Visual regression | `pnpm test:visual` | Playwright visual tests |
| TUI smoke | `pnpm check:tui` | Terminal UI smoke test |
| Daemon smoke | `pnpm check:daemon` | IPC daemon smoke test |
| Container smoke | `pnpm check:container` | Container image smoke |
| Release smoke | `pnpm release:smoke` | Release artifact smoke |
| Perf gate | `pnpm release:perf-gate` | Performance baseline check |
| Canvas bench | `pnpm bench:canvas` | Canvas interaction benchmark |
| Startup bench | `pnpm bench:startup` | Startup time benchmark |
| Idle memory bench | `pnpm bench:idle-memory` | Idle memory benchmark |
| Accessibility | `pnpm check:a11y` | Static a11y checks |
| axe-core audit | `pnpm check:a11y-axe` | WCAG 2a/2aa/2.1aa automated audit |
| Rust tests | `cargo test --workspace` | Rust unit and integration tests |
| E2E tests | `pnpm test:e2e` | Playwright end-to-end tests |

## Commercial inquiries

See [COMMERCIAL-LICENSING.md](COMMERCIAL-LICENSING.md).
