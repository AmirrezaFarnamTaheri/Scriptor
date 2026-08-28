# Boundary outcome contract

Scriptor boundary adapters use one six-state outcome algebra. The purpose is to prevent a missing optional value, malformed persisted state, partial result, execution failure, and successful recovery from collapsing into the same empty/default return value.

| Status | Contract | Default allowed? |
| --- | --- | --- |
| `value` | Authoritative operation result. | Not applicable. |
| `absent-optional` | Optional state is genuinely absent. The caller may map this to an explicit documented default or empty value. | **Yes, only here.** |
| `invalid` | Input, configuration, serialized state, or persisted data is malformed. Return a typed code and message. | No. |
| `degraded` | Useful partial state is available, but warnings identify omitted/unavailable portions. | No silent default; warnings travel with the value. |
| `failed` | The operation failed. Return code, message, and whether retry/recovery is reasonable. | No. |
| `recovered` | The operation succeeded through an explicit recovery path. Preserve a recovery receipt. | No silent erasure of the recovery event. |

`contracts/operations.json` assigns the allowed statuses to every catalogued Tauri command, daemon RPC method, MCP tool, and CLI command. Generated TypeScript/Rust metadata and parity checks make additions fail closed until their boundary semantics are declared.

## Adapter rules

1. Do not use `unwrap_or_default`, `.ok()`, `filter_map(Result::ok)`, or equivalent at authoritative boundaries unless the source contract explicitly represents `absent-optional`.
2. Invalid vault configuration is `invalid`, not absence.
3. Database row decode errors are `failed` or `degraded` with warnings, never silently omitted.
4. Process/IPC failures use structured codes and recoverability rather than untyped strings.
5. Recovery after atomic-write/journal repair is `recovered`; emit or retain a receipt when the boundary exposes it.
