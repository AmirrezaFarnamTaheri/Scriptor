# Container diagram (C4 level 2)

This view presents Tauri desktop as the primary supported product surface. The headless daemon, CLI, TUI, and MCP are supported operational surfaces that reuse selected Rust and TypeScript packages with their own process boundaries. Mobile remains experimental or design-only and is not represented as sharing the desktop or headless deployment boundaries.

## Containers

- **React workspace:** React 19, TypeScript 6, and Vite 8 render the editor, panels, graph, canvas, and review surfaces. The renderer does not receive unrestricted native authority.
- **Tauri desktop host:** Tauri 2 packages the desktop application, exposes permissioned Rust command adapters, and manages the bundled daemon sidecar.
- **Scriptor daemon and Rust kernel:** The authenticated local daemon owns vault sessions and routes indexing, Git, export, file-watching, and other native operations through Rust crates.
- **MCP stdio surface:** Permission-scoped MCP schemas and runners expose read, draft, and approval-gated operations with audit records.
- **Vault and Git working tree:** Portable Markdown, configuration, assets, indexes, and repository metadata remain on local disk.

## Diagram

```mermaid
C4Container
    title Primary desktop containers for Scriptor

    Person(user, "User", "Writes, reviews, configures, and publishes local knowledge")
    System_Ext(mcpClient, "MCP Client", "Invokes explicitly exposed Scriptor tools")

    System_Boundary(scriptor, "Scriptor") {
        Container(reactApp, "React Workspace", "React 19, TypeScript 6, Vite 8", "Renders the local-first workspace and requests typed operations")
        Container(tauriHost, "Tauri Desktop Host", "Tauri 2, Rust", "Enforces desktop permissions, adapts commands, and manages the daemon sidecar")
        Container(daemon, "Scriptor Daemon", "Rust", "Owns vault sessions and coordinates indexing, Git, export, watching, and native services")
        Container(mcpServer, "MCP Stdio Surface", "TypeScript and Rust contracts", "Exposes permission-scoped tools with durable audit behavior")
        ContainerDb(vaultStore, "Vault and Git Working Tree", "Local Markdown, assets, SQLite, Git", "Stores portable content, indexes, configuration, and repository state")
    }

    Rel(user, reactApp, "Operates", "Keyboard, pointer, touch")
    Rel(reactApp, tauriHost, "Requests permissioned native operations", "Typed Tauri IPC")
    Rel(tauriHost, daemon, "Starts and calls", "Authenticated local IPC")
    Rel(daemon, vaultStore, "Reads and mutates approved data", "Atomic local I/O and Git")
    Rel(mcpClient, mcpServer, "Invokes tools", "JSON-RPC over stdio")
    Rel(mcpServer, daemon, "Routes allowed operations", "Permission and audit contracts")
```

## Source references

- `package.json`
- `apps/desktop/README.md`
- `docs/architecture/IPC_DAEMON.md`
- `packages/mcp/README.md`
- `PRODUCT.md`
