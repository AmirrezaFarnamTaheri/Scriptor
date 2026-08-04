# Operations and diagnostics

## Structured tracing

Desktop, daemon, and CLI initialize structured JSON tracing through `crates/system-bridge/src/observability.rs`. Fields with secret/token/password/key names are redacted. Local files rotate by size and retain a bounded segment count.

## Correlation

Long-running and cross-boundary operations should carry an operation/request ID through renderer command, Tauri/daemon adapter, external process receipt, and audit event. A failure report should be diagnosable by that ID without reading source.

## Health signals

- watcher generation and rescan-required state;
- index generation/freshness;
- daemon subscriber drops;
- process timeout/cancel/truncation outcomes;
- pending MCP intents;
- backup verification and restore journal;
- log rotation/repair state.

## Incident collection

Use redacted diagnostics only. Never attach a real vault, keychain value, full request body, or unreviewed audit log. Preserve source commit, app version, OS/arch, reproduction, operation ID, and the smallest relevant bounded log segment.
