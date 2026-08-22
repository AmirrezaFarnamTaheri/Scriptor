# Changelog

## Unreleased

### Fixed

- Prevented E2E editor fault injection from leaking into desktop builds by rejecting test-only markers in production assets and clearing inherited E2E mode during screenshot-to-desktop builds.
- Made the editor render fallback recover Monaco crashes into the supported CodeMirror editor instead of retrying the same failing engine loop.
- Made Cargo lockfile validation independent of Windows CRLF checkout normalization, so source and governance gates use the same semantics locally and in CI.
- Added behavioral loopback coverage for capture HTTP responses and strengthened HTML-to-Markdown table assertions after dependency upgrades.
- Made search cancellation clear its loading state, protected native Canvas template failures from being reported as successful local insertions, and restored full modal semantics to Canvas.
- Prevented workspace shortcuts from intercepting keyboard interaction inside native select controls.
- Updated release kickoff concurrency so a newer explicit request can replace an unapproved stale request; missing Rust evidence artifacts now fail CI visibly.
- Standardized local release scripts on PowerShell 7 and documented browser-driver requirements for the axe gate.
- Hardened local Starlight publishing around a server-derived plan, explicit `publish: true` opt-in, stale-hash checks, managed-only deletion, atomic writes, symlink/path confinement, output-drift repair, and native one-time authorization.
- Corrected FTS5 body snippets and BM25 column weighting, and removed the phantom ranked-search Tauri call from Smart Collections in favor of the implemented DQL engine.
- Serialized desktop Git mutations and bounded the reusable native Git mutation queue.
- Fenced vault switches behind active native command leases; serialized overlapping opens; and prevented stale editor, workspace, session, Git, Canvas, plugin-state, and preset completions from replacing a newer vault's state.
- Made vault JSON history/recent updates cross-process safe, hardened watcher replacement, and moved native Git execution and conflict writes through bounded, atomic platform boundaries.
- Closed Google Calendar disconnect authorization, restored the renderer/native bridge boundary, and removed unreachable incubating embeddings from the default desktop product graph.
- Corrected workspace package declarations/lock metadata, Tauri command contracts, plugin Rust backend identities, and source-test discovery so hidden dependency and phantom-command drift fails fast.
- Removed the unimplemented Zotero-sync product claim; the standalone connector now validates credentials at Zotero's current-key endpoint, confines credentials to the official HTTPS API origin, and does not write arbitrary vault paths.
- Reconciled release documentation with the intentional unsigned-but-attested upstream installer policy.

### Verification

- Added artifact-level regression coverage proving production bundle validation rejects compiled E2E editor crash hooks.
- Added dependency-free contracts for publishing, authorization, Git serialization, workspace boundaries, Tauri command registration, Cargo lock consistency, plugin backend resolution, and complete lightweight test ownership.

## 1.0.0 — 2026-08-17

Scriptor 1.0 is the current, single-schema product baseline.

- Plugin capability decisions are vault-backed and enforced by native, daemon, and MCP boundaries.
- Canvas documents use canonical, collision-free file names.
- Browser UI state uses the current versioned envelope only; legacy local-storage formats are rejected and quarantined.
- The release pipeline produces immutable, source-bound artifacts with checksums, SBOMs, receipts, and attestations.
- Historical change entries and migration narratives are intentionally not part of the v1 product contract.
