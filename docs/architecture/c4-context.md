# C4 Model Specification: Level 1 System Context for Scriptor

> **Specification Standard:** C4 Model Level 1 System Context (`architecture-c4-model`) for Scriptor (`D:\GitHub\Scriptor`).

## 1. System Overview

**Scriptor** is a local-first, privacy-focused Markdown knowledge and writing workspace for desktop users. It combines long-form Markdown note editing, interactive canvas research, citation management, full-text search indexing, and automated Git synchronization into a desktop application shell.

---

## 2. Personas & Stakeholders

| Persona | Role & Primary Goal | Key Workflows |
|---|---|---|
| **Academic Researcher** | Manages citations, literature notes, and paper drafts. | Zotero reference sync, PDF annotation, bibtex/CSL citation generation. |
| **Technical Writer** | Authors structured documentation, API guides, and Markdown books. | Split editor preview, canvas diagramming, automated Git commits. |
| **Knowledge Worker** | Builds a personal knowledge graph (PKM) from daily notes and web clips. | Vault indexing, full-text search, bidirectional link traversal. |

---

## 3. External System Dependencies & Trust Boundaries

```mermaid
C4Context
    title System Context Diagram for Scriptor

    Person(user, "User / Author", "Writes notes, organizes knowledge, and builds research canvases.")

    System(scriptor, "Scriptor App", "Local-first desktop workspace for Markdown editing, research, and indexing.")

    System_Ext(zotero, "Zotero / Citation Engines", "External reference manager providing CSL JSON and BibTeX libraries.")
    System_Ext(git_remotes, "Git Remote Hosts", "GitHub / GitLab / Gitea servers for background vault backup.")
    System_Ext(pdf_engine, "PDF Rendering Subsystem", "Local headless PDF compilation and export engine.")
    System_Ext(llm_provider, "Local / Remote LLM Provider", "Optional AI assistant for text completion, tagging, and summary.")

    Rel(user, scriptor, "Uses UI for writing and research", "Tauri 2 / React 19 UI")
    Rel(scriptor, zotero, "Syncs references & collections", "IPC / HTTP API")
    Rel(scriptor, git_remotes, "Pushes/pulls vault commits", "SSH / HTTPS / Native Git")
    Rel(scriptor, pdf_engine, "Generates formatted PDF exports", "Headless Chromium / Typst")
    Rel(scriptor, llm_provider, "Queries semantic completions", "Local Ollama / OpenRouter")
```

---

## 4. Trust Boundaries & Security Model

1. **Local Vault Boundary:** Vault files (`.md`, `.canvas`, images) are stored strictly as plain text on the local filesystem (`D:\GitHub\Scriptor` or user vaults). No vault data is sent to external servers without explicit user invocation.
2. **Process Launch Isolation:** System commands and external tools are launched through `crates/system-bridge` with explicit authorization inventory checks against `scripts/validation/process-launch-inventory.json`.
3. **Network Isolation:** Third-party integrations (Zotero, Git remotes, LLMs) use authenticated nonces and encrypted local storage for credentials.
