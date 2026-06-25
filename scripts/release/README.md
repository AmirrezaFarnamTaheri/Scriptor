# Release Scripts

Release engineering scripts for Scriptor v0.1.0.

## Scripts

| Script | Purpose |
|---|---|
| `package.ps1` | Full pre-release pipeline: checks, tests, smoke, optional Tauri bundle. |
| `sign-installers.ps1` | Optional Authenticode signing for MSI/NSIS artifacts (CI or local). |
| `verify-bundle.mjs` | Cross-platform post-bundle artifact check (used in Release CI). |
| `write-manifest.ps1` | Writes `dist/release-manifest.json` with SHA-256 hashes for Windows installers. |
| `smoke.ps1` | CLI workflow smoke on the minimal fixture vault (open, scan, index, search, export dry-run). |
| `perf-gate.ps1` | Enforces scan/search performance budgets via `bench-large.ps1`. |

## Local packaging

```powershell
pnpm install
powershell -ExecutionPolicy Bypass -File scripts/release/package.ps1
```

Installers land under `target/release/bundle/` (MSI + NSIS on Windows).

Skip the Tauri bundle while iterating:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release/package.ps1 -SkipTauri
```

## Pandoc

Scriptor does not bundle Pandoc in v0.1. See `docs/release/PANDOC_STRATEGY.md` for discovery order and enterprise overrides.

## Signed releases (GitHub Actions)

The `Release` workflow builds installers on tag push (`v*`) or manual dispatch.

- **Windows:** MSI + NSIS, optional Authenticode signing, `release-manifest.json`
- **macOS:** DMG with ad-hoc signing (`signingIdentity: "-"`) when no Apple secrets are set
- **Linux:** `.deb` + AppImage on `ubuntu-22.04`

Optional Authenticode signing uses repository secrets:

| Secret | Value |
|---|---|
| `WINDOWS_CERTIFICATE` | Base64-encoded `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password |

When secrets are absent, the sign step is skipped and artifacts remain unsigned.

## CI gates

`CI` workflow runs on push/PR:

- Typecheck, MCP/plugin validation, lint, frontend build, Rust tests
- Minimal vault scan budget (Ubuntu)
- Release smoke + 1k scan performance gate (Windows)

## Related documents

| Document | Purpose |
|----------|---------|
| [`docs/release/SIGNING.md`](../../docs/release/SIGNING.md) | Code signing and notarization |
| [`docs/release/PANDOC_STRATEGY.md`](../../docs/release/PANDOC_STRATEGY.md) | Pandoc for exports |
| [`docs/CAPABILITIES.md`](../../docs/CAPABILITIES.md) | Release validation commands |
| [`.github/workflows/release.yml`](../../.github/workflows/release.yml) | Release workflow |
