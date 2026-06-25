# `@scriptor/plugin-api`

Plugin manifest validation, contribution registry, safe mode, and scoped vault query adapters.

## Shipped

- Manifest schema aligned with `@scriptor/core` plugin contracts.
- Contribution slots: commands, inspector widgets, export profiles, MCP tools, canvas templates.
- Safe mode and first-party samples (`plugin-vault-lint`, `plugin-canvas-kit`, `plugin-publish-pack`).

## Validation

```powershell
pnpm check:plugins
```

See [`docs/architecture/PLUGIN_SYSTEM.md`](../../docs/architecture/PLUGIN_SYSTEM.md).
