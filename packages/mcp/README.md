# @scriptor/mcp

MCP tool schemas, permission modes, reviewed drafts, and automation for Scriptor vaults.

## Validation

```powershell
pnpm check:mcp
pnpm mcp:stdio
```

Set `SCRIPTOR_VAULT` to an absolute vault path when running the stdio server outside the
desktop shell. A runtime in `draft` or `write-approved` mode additionally needs a stable
vault identity (`McpVaultContext.vaultId`): every draft is stamped with it, approval refuses
a draft that was reviewed against a different vault, and a write tool is not advertised at
all while its bridge (`saveNote` / `renameNote` / `deleteNote`) is absent.

The TypeScript runtime keeps a bounded process-local audit view for immediate UI inspection. Approved mutations are separately journaled durably by the native vault/daemon layer in `.scriptor/audit/mcp-mutations.jsonl`, using intent/outcome records and hash-chain verification. Do not treat the process-local audit list as the durable security record.
