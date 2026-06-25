# `@scriptor/mcp`

MCP tool schemas, permission modes, audit logging, and read-only automation for Scriptor vaults.

## Shipped

- Read-only tools: search, read note, backlinks, broken links, export profiles.
- Permission modes: `off`, `read-only`, `draft`, `write-approved`.
- Stdio server for CLI subprocess use and desktop audit UI.

## Validation

```powershell
pnpm check:mcp
pnpm mcp:stdio
```

Set `SCRIPTOR_VAULT` to an absolute vault path when running outside the desktop shell.
