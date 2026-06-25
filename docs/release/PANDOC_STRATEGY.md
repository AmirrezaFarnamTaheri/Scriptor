# Pandoc Strategy

Scriptor exports through Pandoc with explicit, allow-listed arguments. The desktop app and CLI share `scriptor-export-runner` discovery logic.

## Resolution order

1. **`SCRIPTOR_PANDOC_PATH`** — absolute path to a Pandoc executable. Used when IT installs Pandoc outside `PATH` or when multiple versions are present.
2. **`pandoc` on `PATH`** — default. On Windows, the resolved path comes from `where pandoc`; on Unix, `which pandoc`.

Verify discovery:

```powershell
pnpm cli -- export-discover
```

## Installation options

| Approach | Status | Notes |
|---|---|---|
| System Pandoc on `PATH` | **Default** | Matches typical power-user setups; smallest installer. |
| `SCRIPTOR_PANDOC_PATH` override | **Supported** | Document for enterprise deployments. |
| Bundled Pandoc in installer | **Optional** | `SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1` |

Export dry-run works without Pandoc installed (argument preview only). Real exports require a working Pandoc binary and any format-specific engines (e.g. LaTeX for PDF).

## Recommended setup

**Windows (winget):**

```powershell
winget install --id JohnMacFarlane.Pandoc
```

**macOS (Homebrew):**

```bash
brew install pandoc
```

**Linux:** distribution package or official Pandoc release archive.

## Failure modes

| Symptom | Fix |
|---|---|
| `pandoc was not found on PATH` | Install Pandoc or set `SCRIPTOR_PANDOC_PATH`. |
| Export succeeds in dry-run but fails at runtime | Pandoc missing filters/engines for the chosen format. |
| Wrong Pandoc version picked | Set `SCRIPTOR_PANDOC_PATH` to the intended binary. |

## Security

- Export args are built from structured Rust types, not shell concatenation.
- `extra_pandoc_args` pass through an allow-list in `export-runner`.
- Bundled Pandoc, if added later, must ship pinned version metadata in `export-discover` output for support diagnostics.
