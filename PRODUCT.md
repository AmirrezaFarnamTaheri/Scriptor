# Product

**Scriptor** · *The instrument for serious writing* · v0.1.0

## Users

Scriptor is for writers, researchers, students, technical authors, and knowledge workers who live in Markdown notes for long sessions. They need a local-first workspace that handles research structure, citations, backlinks, exports, versioning, and AI-assisted review without turning their vault into a proprietary database.

## Product purpose

Scriptor is a fast, desktop-native, local-first Markdown knowledge workspace. Its purpose is to help users capture notes, connect ideas, maintain healthy knowledge graphs, publish polished documents, use optional canvas boards for visual thinking, and automate carefully through Git, MCP, and AI review flows.

![Workspace layout: vault tree, split editor and preview, inspector rail](docs/assets/screenshots/editor-preview.png)

Success means users trust the app with real vaults because files stay portable, writes are explicit, exports are reproducible, and the interface stays calm under dense research work.

## Platforms

| Platform | Status | Installers |
|----------|--------|------------|
| Windows 10+ | Supported | MSI, NSIS |
| macOS 12+ | Supported | DMG |
| Linux (x64) | Supported | DEB, AppImage |

Build from source on any platform with Node.js 22+, pnpm 9+, and Rust stable.

## Brand personality

Precise, luminous, composed.

The product should feel like a high-quality research instrument: quiet, exact, readable, and capable. It should not feel like a marketing site, a social knowledge feed, a generic AI dashboard, or an overloaded IDE.

See [`docs/brand/BRAND.md`](docs/brand/BRAND.md) for logomark, wordmark, and asset paths.

## Design exclusions

- No legacy Electron feel or generic material-dashboard chrome.
- No purple-blue AI dashboard gradient aesthetic.
- No beige, cream, sand, parchment, or faux-paper body background.
- No marketing hero as the first screen.
- No decorative widget dashboards that hide the writing task.
- No chat-first AI surface that competes with the editor.
- No dense developer IDE chrome unless the user is explicitly editing code.

## Design principles

1. **The workspace is the product.** Open into writing, search, graph, export, and vault status — not a landing page.
2. **Files are sacred.** Every mutation should feel inspectable, reversible, and tied to the vault model.
3. **Show capability through operational surfaces.** Jobs, Git state, export readiness, backlinks, and vault health should be visible without shouting.
4. **AI is an assistant with boundaries.** Read-only and draft modes come before write-approved automation.
5. **Performance is part of trust.** Indexing, export, graph building, and preview work should feel measurable and calm.

## Accessibility and inclusion

Target WCAG 2.2 AA as the release floor. Keyboard navigation, visible focus states, reduced-motion support, high text contrast, readable editor typography, and non-color-only state indicators are required. The default interface should work for long reading and writing sessions without visual fatigue.

See [`docs/validation/ACCESSIBILITY_AUDIT.md`](docs/validation/ACCESSIBILITY_AUDIT.md) for the release checklist.

## Capability boundaries

- Markdown remains the canonical authoring surface.
- Canvas is optional and lazy-loaded for visual thinking, planning, diagrams, and presentation boards.
- Plugins extend through contracts and permissioned slots, not raw filesystem handles.
- AI/MCP tools begin read-only and graduate through draft and write-approved modes only after audit and diff review exist.
- Pandoc is an external dependency for exports — Scriptor discovers it on `PATH` or via `SCRIPTOR_PANDOC_PATH`.

## Related documents

| Document | Purpose |
|----------|---------|
| [`DESIGN.md`](../DESIGN.md) | Visual and interaction rules |
| [`docs/CAPABILITIES.md`](docs/CAPABILITIES.md) | Shipped surfaces |
| [`docs/guides/GETTING_STARTED.md`](docs/guides/GETTING_STARTED.md) | First-run guide |
| [`CHANGELOG.md`](../CHANGELOG.md) | Release history |
