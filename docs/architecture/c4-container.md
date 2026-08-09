# C4 Model Specification: Level 2 Containers for Scriptor

> **Specification Standard:** C4 Model Level 2 Container Diagram (`architecture-c4-model`) for Scriptor (`D:\GitHub\Scriptor`).

## 1. Container Architecture

Scriptor is structured as a hybrid desktop application combining a **Tauri 2 Native Desktop Shell**, a **React 19 Frontend SPA Monorepo**, and a suite of high-performance **Rust Engine Crates**.

---

## 2. Container Diagram

```mermaid
C4Container
    title Container Diagram for Scriptor

    Person(user, "User / Author", "Desktop user interacting with Scriptor UI.")

    System_Boundary(scriptor_boundary, "Scriptor System") {
        Container(desktop_ui, "Desktop UI Shell", "Tauri 2, React 19, Vite 8, Tailwind CSS", "Provides workspace interface, editor, canvas, and file tree.")
        Container(ipc_layer, "IPC Bridge Layer", "Rust ts-rs, Serde JSON, Nonce Auth", "Exposes type-safe IPC commands between React UI and Rust core.")
        Container(vault_engine, "Vault & Core Engine", "Rust (scriptor-vault)", "Manages local file I/O, frontmatter parsing, note mutation, and file watching.")
        Container(indexer_engine, "Indexer & Search Engine", "Rust (scriptor-indexer, Tantivy, SQLite)", "Indexes links, tags, full-text search content, and graph topology (`PRAGMA foreign_keys = ON`).")
        Container(daemon_ipc, "Daemon Service", "Rust (scriptor-daemon)", "Handles background indexing tasks, cron backups, and system bridge execution.")
        Container(git_engine, "Git Sync Subsystem", "Rust (scriptor-native-git)", "Performs atomic auto-commits and remote repository synchronization.")
    }

    Rel(user, desktop_ui, "Interacts via keyboard & mouse", "Native Window / Webview")
    Rel(desktop_ui, ipc_layer, "Invokes typed IPC commands", "Tauri IPC / Serde")
    Rel(ipc_layer, vault_engine, "Delegates note I/O & vault operations", "In-Process Function Calls")
    Rel(ipc_layer, indexer_engine, "Queries search & graph topology", "SQLite / Tantivy Query")
    Rel(vault_engine, indexer_engine, "Emits file change events", "Tokio Channels")
    Rel(daemon_ipc, git_engine, "Triggers scheduled vault backup", "Rust Function API")
```

---

## 3. Container Specifications

| Container | Tech Stack | Responsibility | Key Interfaces |
|---|---|---|---|
| **Desktop UI Shell** | React 19, Vite 8, Radix UI, Lucide | User interface, markdown editor, canvas views, modals. | Tauri IPC `@tauri-apps/api` |
| **IPC Bridge Layer** | Rust `scriptor-ipc`, `ts-rs` | Serializes/deserializes TypeScript types to Rust structs. | `tsconfig.contracts.json` |
| **Vault & Core Engine** | Rust 1.96, Tokio, `thiserror` | Vault file CRUD, frontmatter YAML parsing, atomic writes. | `scriptor-vault` Rust Crate |
| **Indexer & Search** | Rust, SQLite (`rusqlite`), Tantivy | SQLite relational link graph (`PRAGMA foreign_keys = ON`), Tantivy FTS index. | SQLite DB & Tantivy Index |
| **Daemon Service** | Rust `scriptor-daemon` | Background worker queue, scheduled jobs, process bridge. | IPC Nonce Channel |
| **Git Engine** | Rust `scriptor-native-git`, `git2` | Atomic Git commits, staging, branch management, git push/pull. | libgit2 C Bindings |
