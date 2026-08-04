# Container & Component Diagram (C4 Level 2)

## Container Specification
- **Frontend SPA**: React 18, TypeScript, Tailwind v4, Vite. Renders the interactive workspace, handles state colocation, and manages WCAG-compliant UI shells.
- **MCP Gateway Container**: Manages connection pools, tool registration, and RPC invocations for registered Model Context Protocol tools.
- **Local Storage / Vault Container**: Manages markdown files, metadata caches, and IndexedDB state persistence.

## Container Diagram
```mermaid
C4Container
    title Container Diagram for Scriptor

    Person(user, "User", "Interacts with workspace")
    
    Container(reactApp, "React 18 Frontend", "React, TypeScript, Vite", "Renders panels, topbar, drawers, and knowledge graphs")
    Container(mcpGateway, "MCP Gateway", "Node.js / Stdio Bridge", "Orchestrates MCP server tools and IPC channels")
    Container(vaultStore, "Vault File System", "Local Disk / Markdown", "Stores notes, config files, and git repository state")

    Rel(user, reactApp, "Interacts with", "HTTPS / Local DOM")
    Rel(reactApp, mcpGateway, "Sends tool calls", "JSON-RPC")
    Rel(reactApp, vaultStore, "Reads / Writes files", "File System API")
    Rel(mcpGateway, vaultStore, "Indexes metadata", "Disk I/O")
```
