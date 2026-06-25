# Scriptor Desktop App

Tauri 2 desktop shell for the Scriptor workspace.

## Responsibilities

- Tauri configuration, permissions, and resource bundling (including the headless daemon sidecar).
- Native window, folder picker, and app lifecycle.
- Rust command adapters for vault, indexer, export, Git, canvas, MCP, and daemon IPC.
- Mounting the Vite/React renderer from the repository root.

## Commands

```powershell
pnpm prepare:desktop   # stage scriptor-daemon into src-tauri/binaries/
pnpm desktop:dev
pnpm desktop:build
```

See [`docs/CAPABILITIES.md`](../../docs/CAPABILITIES.md) and [`docs/architecture/IPC_DAEMON.md`](../../docs/architecture/IPC_DAEMON.md).
