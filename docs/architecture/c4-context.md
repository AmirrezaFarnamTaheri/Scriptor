# System Context Overview (C4 Level 1)

## Personas & User Journeys
1. **Developer / Power User**: Interacts with Scriptor to manage markdown notes, visualize knowledge graphs, configure MCP extensions, and manage Git repositories.
2. **Technical Writer**: Authors structured documentation, reviews history, and publishes artifacts.
3. **Agentic Auditor**: Conducts automated code quality, performance, and accessibility reviews.

## System Context Diagram
```mermaid
C4Context
    title System Context Diagram for Scriptor

    Person(user, "User / Developer", "Authoring, note taking, and workspace navigation")
    System(scriptor, "Scriptor App", "Desktop/Web technical workspace for knowledge and note management")
    System_Ext(gitRemote, "Git Remote Repository", "GitHub / GitLab for version control and synchronization")
    System_Ext(mcpServers, "MCP Servers", "Model Context Protocol tools and servers for extended functionality")
    System_Ext(localFS, "Local File System", "Persistent vault storage and configuration files")

    Rel(user, scriptor, "Uses", "Keyboard / Touch UI")
    Rel(scriptor, localFS, "Reads & Writes", "File I/O")
    Rel(scriptor, gitRemote, "Pushes & Pulls", "Git CLI / Transport")
    Rel(scriptor, mcpServers, "Invokes Tools", "JSON-RPC / Stdio")
```
