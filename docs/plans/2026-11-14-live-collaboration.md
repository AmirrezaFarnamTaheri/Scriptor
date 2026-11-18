# Real-time collaboration implementation plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce opt-in, durable, multi-author, local-first Scriptor editing without misrepresenting Google Docs or Overleaf Git synchronization as live editing.

**Architecture:** Use a versioned, scope-bound update protocol and proven Yjs-compatible text CRDT. The native authority owns vault-bound durable operation storage and relay credentials; a separate authenticated WSS relay persists deduplicated updates before acknowledging. CodeMirror/Monaco publish incremental transactions; provider adapters consume reviewed snapshots only.

**Tech Stack:** TypeScript/Node 22 source tests, React, CodeMirror 6, Monaco, Rust/Tauri, SQLite/WAL, Yjs-compatible binary updates, authenticated WebSocket relay.

## Global Constraints

- The 2026-11-14 approved architecture is normative: room, document and epoch identities; explicit per-document consent; native scope validation; isolated document ACL; bounded 256 KiB update, 2 KiB awareness, 2 MiB materialized document, 64 MiB local unacknowledged queue.
- Revoked editors cannot write; viewers cannot write; stale vault/room/epoch responses cannot alter another session; offline acknowledged-local edits survive restart.
- A relay ACK means transactionally durable server storage; transmitting a frame does not count.
- Existing Drive/opaque Docs, finite polling, selected-file Overleaf Git and native CAS/recovery paths remain independent and functional.
- Do not use undocumented Overleaf editor endpoints or claim Google Docs/Overleaf-native real-time collaboration.
- This branch targets `main`, not the 194-file PR #336 UX remediation branch, and is draft until exact-head tests pass.

---

### Task 1: Protocol, update-queue and permission-state contracts

**Files:**
- Create: `src/lib/liveCollaborationProtocol.ts`
- Create: `src/lib/liveCollaborationProtocol.test.ts`
- Create: `src/lib/liveCollaborationQueue.ts`
- Create: `src/lib/liveCollaborationQueue.test.ts`

**Interfaces:**
- Consumes: untrusted native/relay messages and stable `{roomId, documentId, epoch, peerId}` origin.
- Produces: `parseLiveCollaborationEnvelope(value, expectedScope)`, `parseLiveCollaborationScope(value)`, `PendingCollaborationQueue` and exact-match acknowledgement decisions.

- [ ] **Step 1: Add focused failing tests.** Test wrong vault/room/document/epoch, invalid frame/payload/base64, over-budget frames, unordered/duplicate message IDs, wrong acknowledgements, queued-state restore, quota overflow, and identity mismatch.
- [ ] **Step 2: Verify failure.** Run `node --experimental-strip-types --test src/lib/liveCollaborationProtocol.test.ts src/lib/liveCollaborationQueue.test.ts`; expected missing-module failure.
- [ ] **Step 3: Implement minimum behavior.** Parse `unknown` without unchecked casts; enforce hard byte ceilings; preserve message identity/sequence and ignore duplicate ACKs; quota failure retains prior queue.
- [ ] **Step 4: Verify focused pass.** Run the same test command; expect all contract tests to pass.
- [ ] **Step 5: Run integration check.** `pnpm check:contracts && pnpm test:source`; expect zero failures.
- [ ] **Step 6: Commit passing deliverable.** `git add src/lib/liveCollaborationProtocol* src/lib/liveCollaborationQueue* && git commit -m "feat: add collaboration wire and retry contracts"`.

### Task 2: Native durable journal and projection coordinator

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/collaboration_live.rs` (proposed)
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`, `apps/desktop/src-tauri/src/lib.rs` (observed)
- Add native integration tests next to the command module and vault save coordinator.

**Interfaces:**
- Consumes: validated scope, binary CRDT updates, explicit native authorization, expected file hash.
- Produces: begin/append/pending/ack/replay/stop commands; durable journal receipt and CAS projection receipt.

- [ ] **Step 1: Test** wrong vault and symlink, stale epoch, failed append/fsync, restart replay, repeated ACK, external file CAS refusal, frozen restore, and simultaneous same-path writer.
- [ ] **Step 2: Verify RED.** Run `cargo test -p scriptor-desktop collaboration_live`; command absent and tests fail.
- [ ] **Step 3: Implement** a scoped SQLite WAL journal with unique update IDs, transactional state transition, bounded queue and fsync acknowledgement; use existing scoped vault authorization and CAS save path. On error pause session and retain recoverable local content.
- [ ] **Step 4: Verify GREEN.** Run focused native tests; all pass.
- [ ] **Step 5: Run** `cargo check --locked` and source contract checks; both pass.
- [ ] **Step 6: Commit** native journal and tests only.

### Task 3: Authenticated and persistent self-hosted relay

**Files:**
- Create: `services/collaboration-relay/` (proposed; isolated workspace)
- Add relay fixtures and integration tests in that directory.

**Interfaces:**
- Consumes: challenge signatures, owner-approved peer key/role, room+document+epoch, state vectors and update messages.
- Produces: authenticated SYNC/UPDATE/ACK/RESYNC and revocation events.

- [ ] **Step 1: Test** 3 authenticated peers, unauthorized viewers, revoked offline editor, same update ID after ambiguous success, crash before/after fsync, out-of-order updates, expiry and compaction recovery.
- [ ] **Step 2: Verify RED.** Run relay's dedicated `npm test`; expected failing assertions.
- [ ] **Step 3: Implement** WSS-only production listener, peer-key identity challenge, membership authorization on every frame, append transaction before ACK, snapshot+cursor safe compaction, bounded presence TTL, TLS/trust documentation.
- [ ] **Step 4: Verify GREEN.** Run relay integration suite; no safety/auth failures.
- [ ] **Step 5: Run** package security/license review and concurrent mutation stress; no dropped acknowledged updates.
- [ ] **Step 6: Commit** relay, fixtures and deployment guide without enabling automatic cloud traffic.

### Task 4: Local session coordinator and CodeMirror/Monaco bindings

**Files:**
- Create: `src/hooks/useLiveCollaboration.ts` (proposed)
- Modify: `packages/editor/src/codemirror.tsx`, `src/components/editor/MonacoMarkdownEditor.tsx`, `src/components/SourceMonacoEditor.tsx`, `src/hooks/useWorkspaceEditor.ts`.

**Interfaces:**
- Consumes: journal receipts, Yjs-compatible updates, editor incremental transactions and active note.
- Produces: bound text transactions, awareness anchors, local/relay status, single-owner projection.

- [ ] **Step 1: Test** cross-editor edits, local per-author undo, remote cursor positions, IME, multi-codepoint text, active-path switch, stale async completion, fallback editor and native save coordinator ownership.
- [ ] **Step 2: Verify RED.** Run focused editor and browser e2e tests; expected missing binding failures.
- [ ] **Step 3: Implement** incremental transaction bindings (never `setValue` for incoming remote edits), opt-in session controls and accessible status. Shared sessions bypass obsolete autosave only while native collaboration owns the document.
- [ ] **Step 4: Verify GREEN.** Focused editor and Playwright tests pass with 3 peer sessions.
- [ ] **Step 5: Run** `pnpm check:editor && pnpm check:contracts && pnpm test:e2e`; zero regression.
- [ ] **Step 6: Commit** editor integration and tests.

### Task 5: M1 recovery, security and release evidence

**Files:**
- Create: `e2e/live-collaboration-workflows.spec.ts` (proposed)
- Create: `docs/validation/LIVE-COLLABORATION-ACCEPTANCE.md` (proposed)

**Interfaces:**
- Consumes: independent desktop clients, isolated relay and vault fixtures.
- Produces: reproducible acceptance receipts tied to an exact commit.

- [ ] **Step 1: Test** 100 deterministic seeds x 1000 edits x 3 peers; network partitions, restarts, lost/delayed ACK, revoked peers, corrupt snapshots, same-file contention, native packaged multi-client smoke.
- [ ] **Step 2: Verify RED.** Run acceptance suite and capture failing cases.
- [ ] **Step 3: Repair** only concrete data-loss, authorization, latency, accessibility or crash-recovery defects uncovered by those tests.
- [ ] **Step 4: Verify GREEN.** Same suite converges to byte-identical text, all previously acknowledged-local changes survive and unauthorized writes are rejected.
- [ ] **Step 5: Run** release source checks, cross-platform packaged smoke and approved relay TLS/security review; record all statuses.
- [ ] **Step 6: Commit** acceptance evidence and keep feature experimental until live-device verification.

## Subsequent, independently reviewable plans

**M2 Overleaf project-wide Git:** Add a full safe manifest/diff/merge protocol with explicit binary/assets and delete reviews. Use official Git only, stale HEAD refusal, no force pushes; selected-file workflow remains available.

**M3 Google Docs structured interoperability:** Add tab-aware rich document model, selective `batchUpdate` patch planner with required revision and reread-on-ambiguous-write; unsupported rich objects fail closed or remain provider-owned.

**M4 provider reconciliation:** Track provider checkpoints independently from CRDT acknowledgements, with stale-proof receipts and reviewed external divergences.

**M5 native Overleaf editor:** Do not implement until an officially supported protocol becomes available and is vetted.

## Externally observable decisions

No unresolved decision blocks Task 1. The approved first deployment is explicitly self-hosted, non-E2EE with visible relay-operator disclosure. Any managed hosting, automatic provider write, or unsupported native Overleaf connection requires separate user approval.