# Visual review gallery

These images are reviewed Windows baselines produced by the visual Playwright suite. They are
documentation artifacts, not release evidence by themselves; the exact commit, browser, viewport,
and pnpm test:visual result remain authoritative.

## Core workspace

![Light workspace](assets/screenshots/workspace-light.png)
![Dark workspace](assets/screenshots/workspace-dark.png)
![Mobile workspace](assets/screenshots/workspace-mobile.png)
![Tablet workspace](assets/screenshots/workspace-tablet.png)

## Product surfaces

![Command palette](assets/screenshots/command-palette.png)
![Canvas](assets/screenshots/canvas.png)
![Graph](assets/screenshots/graph.png)
![Git panel](assets/screenshots/git-panel.png)
![MCP panel](assets/screenshots/mcp-panel.png)
![Publish center](assets/screenshots/publish-center.png)
![Vault health](assets/screenshots/vault-health.png)

These captures are the visual index for the primary panels and widgets. The command palette is
the keyboard-first entry point; Canvas and Graph are capability-gated workspaces; Git and MCP
show transport/status surfaces; Publish and Vault health show review-before-mutation flows.

## Review states

![Editor preview](assets/screenshots/editor-preview.png)
![Conflict resolver](assets/screenshots/conflict-resolver.png)
![Note history](assets/screenshots/note-history.png)
![Settings](assets/screenshots/settings.png)
![Plugins](assets/screenshots/plugins.png)
![Keyboard shortcuts](assets/screenshots/keyboard-shortcuts.png)
![Onboarding](assets/screenshots/onboarding-tour.png)
![Inspector preview](assets/screenshots/inspector-preview.png)
![Editor recovery](assets/screenshots/editor-recovery.png)
![MCP sharing inventory](assets/screenshots/mcp-sharing-inventory.png)

## Widgets and responsive states

![Typography toolbar](assets/screenshots/toolbar-typography.png)
![Insert toolbar](assets/screenshots/toolbar-insert.png)
![Mobile inspector](assets/screenshots/mobile-inspector.png)
![Mobile vault](assets/screenshots/mobile-vault.png)

The supporting set covers knowledge navigation, reading/editing, recovery, configuration,
extension management, keyboard customization, and first-run guidance. Reader, Tasks, and Kanban
are additionally exercised by the functional Playwright regression suite; their screenshots are
captured as runtime evidence when the corresponding experimental surfaces are enabled.

The suite also covers dark mode, compact 1024/768/375px layouts, keyboard popovers, recovery
fallbacks, and indexing readiness. Any baseline change requires visual diff inspection and an
explicit review note in the change packet.
