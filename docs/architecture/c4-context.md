# System context overview (C4 level 1)

## Personas and journeys

1. **Developer / Power User** manages Markdown notes, knowledge graphs, Git workflows, workspace configuration, and MCP-assisted automation.
2. **Technical Writer** authors structured documentation, reviews changes and history, and publishes output artifacts.
3. **Agentic Auditor** inspects repository and workspace evidence through explicitly permitted read or draft-producing MCP tools; write operations remain approval-gated.

## System context diagram

```mermaid
C4Context
    title System Context Diagram for Scriptor

    Person(developer, "Developer / Power User", "Manages notes, Git workflows, graphs, configuration, and automation")
    Person(writer, "Technical Writer", "Authors, reviews, and publishes structured documentation")
    Person(auditor, "Agentic Auditor", "Inspects evidence and proposes approval-gated changes")

    System(scriptor, "Scriptor App", "Local-first desktop and web workspace for knowledge authoring and review")
    System_Ext(gitRemote, "Git Remote Repository", "Remote version-control and synchronization service")
    System_Ext(mcpServers, "MCP Servers", "Permission-scoped tools exposed through Model Context Protocol")
    System_Ext(localFS, "Local File System", "Vault content, configuration, and generated artifacts")

    Rel(developer, scriptor, "Operates workspace", "Keyboard, pointer, touch")
    Rel(writer, scriptor, "Authors and publishes", "Keyboard, pointer, touch")
    Rel(auditor, scriptor, "Inspects and proposes drafts", "Permission-scoped MCP workflow")

    Rel(scriptor, localFS, "Reads and writes approved vault data", "Local file APIs")
    Rel(scriptor, gitRemote, "Pushes and pulls on user request", "Git transport")
    Rel(scriptor, mcpServers, "Discovers and invokes allowed tools", "JSON-RPC / stdio")
```
