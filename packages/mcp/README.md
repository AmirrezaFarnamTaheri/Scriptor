# @scriptor/mcp

MCP tool schemas, permission modes, reviewed drafts, and automation for Scriptor vaults.

The TypeScript runtime keeps a bounded process-local audit view for immediate UI inspection. Approved mutations are separately journaled durably by the native vault/daemon layer in `.scriptor/audit/mcp-mutations.jsonl`, using intent/outcome records and hash-chain verification. Do not treat the process-local audit list as the durable security record.
