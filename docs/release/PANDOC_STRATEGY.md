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

## Pandoc GPL / AGPL licensing boundary

Pandoc is licensed under **GPL-2.0-or-later**. Scriptor is licensed under **AGPL-3.0-or-later**. The two licenses are compatible for distribution, but the boundary matters for how Scriptor invokes Pandoc.

### How Scriptor uses Pandoc

Scriptor calls Pandoc as an **external process** via `std::process::Command` in `crates/export-runner`. No Pandoc source code is linked, statically or dynamically, into the Scriptor binary. Pandoc's GPL-licensed code never enters the Scriptor address space.

```
┌──────────────┐   subprocess   ┌──────────────┐
│ Scriptor      │ ─────────────→ │ pandoc        │
│ (AGPL-3.0)   │ ←───────────── │ (GPL-2.0+)   │
└──────────────┘   stdout/file  └──────────────┘
```

### What this means

| Scenario | License obligation |
|---|---|
| Scriptor ships without Pandoc | No GPL obligation. User installs Pandoc separately. |
| Scriptor bundles Pandoc in installer | Pandoc remains a separate work; installer must comply with GPL-2.0+ for the Pandoc binary (source offer, license notice). Scriptor's AGPL-3.0+ applies only to Scriptor code. |
| Scriptor calls Pandoc at runtime | No combined-work obligation. Process-level invocation is not linking. |
| Scriptor distributes Pandoc filters | Filters that import Pandoc modules are GPL-2.0+ derivative works. Filters authored by Scriptor that only communicate via stdin/stdout are separate works. |

### `extra_pandoc_args` allowlist

User-supplied `extra_pandoc_args` pass through an allowlist in `crates/export-runner/src/allowlist.rs`. This prevents arbitrary argument injection and ensures only documented, safe flags reach the Pandoc subprocess. The allowlist is not a licensing mechanism — it is a security boundary.

### Bundled Pandoc (optional)

If Scriptor ever bundles Pandoc in the installer (`SCRIPTOR_BUNDLED_PANDOC_DIR`), the release process must:

1. Ship the Pandoc binary's own license file alongside the binary.
2. Include a written offer for Pandoc source code per GPL-2.0 §6.
3. Document the Pandoc version and license in release notes.

These obligations apply to the Pandoc binary only — not to Scriptor itself.

## Security

- Export args are built from structured Rust types, not shell concatenation.
- `extra_pandoc_args` pass through an allow-list in `export-runner`.
- Bundled Pandoc, if added later, must ship pinned version metadata in `export-discover` output for support diagnostics.
