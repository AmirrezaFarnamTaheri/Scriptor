# Google ecosystem integration completion plan

## Outcome

Complete the existing Google Drive, Docs, Calendar, Tasks, and Gmail workflows as coherent desktop integrations. A user can configure one public OAuth desktop client ID, connect each service independently, discover and select provider resources without copying opaque IDs, persist vault-scoped choices, and complete the existing reviewed read/write workflows with clear recovery and verification evidence.

Sheets, Slides, unrestricted Drive browsing, automatic external mutation, media replication, and replacement of Scriptor's Markdown/source-file model are outside this scope.

## Architectural constraints

- Preserve the existing separate keychain token bundles and least-privilege OAuth scopes for Drive/Docs, Calendar/Tasks, and Gmail. A shared client ID is configuration only; credentials and connection state must never be conflated.
- Persist public configuration and selected resource IDs through the canonical vault-config mutation path. Keep secrets and OAuth tokens in the operating-system keychain.
- Bind every vault-affecting request to the originating vault ID and every provider mutation to the existing one-time authorization broker.
- Provider listings must use bounded pagination, validate response shapes, reject pagination loops/partial authoritative results, and ignore stale replies after disconnect, vault switch, query change, or resource change.
- Preserve the existing review-before-write rules for collaboration merges, Docs text conversion, planner reconciliation, Gmail import, and provider mutations.
- External processes, if any become necessary, must use `crates/system-bridge/src/process.rs`.
- No local test, build, lint, typecheck, browser, install, or app-runtime commands. Verification runs only in GitHub workers.

## Work lanes and ownership

### 1. Shared configuration and frontend resource selectors — owner: frontend settings/resource-selector worker

Primary files: `crates/vault/src/config.rs`, `src/types/vault.ts`, `src/lib/settingsDefaults.ts`, `src/components/GoogleIntegrationSettingsSection.tsx`, `src/hooks/useGoogleCalendarSync.ts`, `src/components/TaskPanel.tsx`, `src/components/PlannerWorkspace.tsx`, supporting i18n/config mutation tests.

- Reuse the persisted public OAuth desktop client ID at `calendar_sync.google_client_id`, expose it across all five workflows, and preserve existing vaults without a schema migration.
- Add vault-scoped Drive collaboration binding for the selected folder and retain the existing Calendar ID, Tasks list ID, lookahead, event display, task mirroring, and capture-note settings.
- Model independent service connection states: Drive/Docs, Calendar/Tasks, and Gmail can be connected, disconnected, expired, or errored without changing either of the other token bundles.
- Provide explicit connect/reconnect/disconnect controls per service. A failed or cancelled connection must not persist a half-configured resource selection.
- Centralize Google authentication error classification and lifecycle invalidation so stale async completions cannot restore a disconnected account.
- Consume the native Calendar and Tasks discovery contracts, render validated selectors with explicit `primary`/`@default` choices, persist selections, and disable writes for read-only resources without hiding readable data.

Acceptance criteria:

- Existing vaults that only contain `calendar_sync.google_client_id` load with the same effective client ID and save in the canonical form.
- Changing the client ID does not delete credentials automatically; reconnect is explicit and the UI explains when a stored token belongs to another client.
- Disconnecting one service clears only its keychain record and in-memory data.
- Config writes use expected-vault identity and expose persistence errors without presenting unsaved settings as durable.

### 2. Drive and Docs resource discovery — owner: root coordinator

Primary files: `apps/desktop/src-tauri/src/commands/collaboration.rs`, `src/bridge/commands/collaboration.ts`, `src/components/CollaborationPanel.tsx`, `src/hooks/useCollaborationPolling.ts`, collaboration styles and harnesses.

- Extend the native Drive adapter with bounded folder discovery and an explicit create-Scriptor-folder action. Return only validated IDs, names, parent/binding metadata, and pagination state.
- Let the user select a discovered folder or create one, then persist the folder binding per vault. Keep an advanced manual-ID path for shared folders that discovery cannot enumerate.
- Resolve and display the connected Drive account independently from Calendar and Gmail.
- Add bounded Google Docs discovery inside the selected folder, including opaque Scriptor revision documents and ordinary Google documents as distinguishable types.
- Replace the manual-only Docs document-ID flow with a discovered document selector while retaining manual ID entry as an advanced fallback.
- Preserve immutable Drive JSON/opaque Docs revision semantics, checksum validation, exact-folder verification, reviewed merge application, explicit conversion-loss consent, and finite polling.
- On folder or transport changes, stop polling, revoke consent, clear incompatible pagination/previews, and retain the local note unchanged.

Acceptance criteria:

- A connected user can discover or explicitly create a Drive folder, select it, reopen the vault, and see the same validated binding.
- Folder creation requires a scoped write authorization and cannot silently reuse an ambiguous same-name folder.
- Docs discovery never escapes the selected folder; trashed, wrong-MIME, invalid, duplicate, or over-limit responses fail closed.
- A user can select a discovered Google document, preview the loss-aware conversion, apply it only after review, or create a new plain-text copy without overwriting an existing document.
- Opaque Docs transport continues to round-trip Markdown bytes and rejects edited envelopes, bad checksums, extra tabs, and unsupported blocks.

### 3. Native Calendar, Tasks, and Gmail provider contracts — owner: native Google provider worker

Primary files: `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_calendar.ts`, `src/bridge/commands/google_gmail.ts`, desktop command registration and native/provider contract tests.

- Add bounded native listing for the user's calendars and task lists, including pagination, stable IDs, display names, access/write capability, and primary/default indicators.
- Return validated discovery DTOs that let the frontend distinguish readable and writable calendars/task lists and identify `primary`/`@default` resources explicitly.
- Change Gmail listing to a validated paginated result with `messages` and `nextPageToken`, retaining bounded concurrent detail fetches and official Gmail query semantics.
- Keep current Calendar event and Google Task write commands compatible with reviewed planner create/update, task create/update/complete/delete, bounded vault-task mirroring, and conflict/precondition handling.
- Surface incomplete pagination, refresh failure, authorization expiry, pending mutation batches, and partial batch failures without treating cached data as authoritative.

Acceptance criteria:

- Calendar and task-list selection survives restart and is isolated by vault.
- Pagination is bounded and deduplicated; loops, malformed pages, and truncated authoritative task sets fail closed.
- A stale refresh or mutation completion cannot overwrite data after disconnect, vault switch, selected-resource change, or a newer refresh.
- Planner writes require current provider revisions where applicable; conflicts remain reviewable and no automatic conflict direction is chosen.
- Vault-task mirroring never claims success from a partial local or remote task set, remains capped at 1,000 reviewed mutations per approval, reports pending work, and affects only tasks carrying this vault's source marker.
- Event and task mutations use their existing distinct authorization scopes and validate IDs, dates, sizes, and access mode at the native boundary.

### 4. Gmail workflow completion — owner: Gmail panel worker

Primary files: `src/components/GmailManagerPanel.tsx`, `src/lib/gmailRfc5322.ts`, `packages/plugins/gmail-manager/`, Gmail styles, harnesses and browser tests. The native/bridge pagination contract is owned by lane 3.

- Change message listing to a validated paginated result with `messages` and `nextPageToken`; support bounded `Load more` while preserving Gmail query semantics.
- Reset pagination and selection when the query changes, and append pages with ID deduplication. Ignore late pages/details after a query change, disconnect, plugin disable, panel close, or newer request.
- Preserve independent Gmail OAuth/client lifecycle and capability checks on every native command.
- Complete the existing message workflow: search/inbox refresh, message detail, Markdown import, archive, trash, compose/send, disconnect, error recovery, empty/loading states, and keyboard/focus behavior.
- Keep message bodies plain-text and bounded. Continue fetching supported text attachments through the official Gmail API, reject unsafe identifiers and oversized responses, and never render provider HTML.

Acceptance criteria:

- Gmail can connect with the shared public client ID without gaining access to Drive, Calendar, or Tasks tokens.
- Search returns the first bounded page; `Load more` appends unique results and disappears at the terminal page.
- Query change/disconnect/plugin disable invalidates in-flight list and detail requests and clears sensitive cached content.
- Archive, trash, and send each require the correct one-time authorization and refresh the visible state only after provider success.
- Import produces valid escaped frontmatter and Markdown through the canonical note-creation workflow; provider content cannot inject YAML structure or active HTML.
- The Gmail workspace remains unavailable unless `scriptor.gmail-manager` is explicitly enabled, and native capability checks remain mandatory for reads, auth, and writes.

### 5. Integration composition, localization, documentation, and evidence — owner: integration/QA worker

Primary files: app workspace/command composition, i18n catalogs, `e2e/`, `src/e2e/`, `scripts/validation/`, `PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/CAPABILITY-MATURITY.md`, translated documentation, `CHANGELOG.md`, `docs/VERIFICATION.md`.

- Present the five services as one Google ecosystem settings area with independent status, resource selection, recovery, and entry points into Drive collaboration, Planner/Tasks, and Gmail.
- Ensure new labels, errors, disclosures, empty states, and pagination controls are localized in every supported locale and remain usable in RTL.
- Add deterministic native/unit/source-contract coverage for validation, pagination, migration, capability boundaries, vault scoping, stale-response invalidation, and authorization scope matching.
- Add browser workflows for each service using the existing deterministic provider harness: connect/cancel/reconnect/disconnect, discovery and selection, reload persistence, error/expiry recovery, mutations, no-mutation cancellation, and cross-vault isolation.
- Add narrow, 200% app-zoom, keyboard, focus, and visual coverage for populated and failure states. Do not refresh image baselines until behavioral assertions pass and new images receive human inspection.
- Update product claims to describe the implemented boundary precisely. Keep live-provider and packaged-desktop verification explicitly pending until separately evidenced.

Acceptance criteria:

- All five integrations have at least one full browser workflow plus focused failure/cancellation coverage; Gmail and Calendar/Tasks no longer rely only on unit/source contracts or a disconnected visual.
- Tests prove one service cannot read, mutate, disconnect, or overwrite the credentials/configuration of another.
- Tests prove resource IDs and provider data are validated at both the TypeScript bridge and Rust boundary.
- All supported locales contain the new keys, and RTL/narrow/zoom checks show no clipped controls, detached labels, inaccessible footers, or hidden recovery actions.
- Documentation and capability maturity match the shipped behavior and list live-account verification as a separate release gate rather than inferred proof.

## Implementation order

1. Preserve canonical configuration and define shared lifecycle contracts so the three credential lanes target one stable shape.
2. Implement Drive/Docs, Calendar/Tasks, and Gmail lanes in parallel against those contracts, with behavioral tests authored before each new command or UI behavior when practical.
3. Compose settings and localization after provider contracts stabilize.
4. Run GitHub worker verification in layers: source/unit contracts, frontend compile, Rust tests, browser workflows, localization, desktop packaging, then visual review.
5. Fix all functional failures before any designated screenshot-baseline refresh. Inspect every changed/new image before accepting it.

## Required GitHub verification

- Frontend/source-test worker: TypeScript compilation, unit tests, command/source contracts, localization contracts.
- Rust worker: formatting/checks, targeted native tests for collaboration and Google commands, full workspace Rust tests, audit.
- Browser worker: new Google ecosystem specs plus the complete browser suite.
- Visual worker: new integration states and full approved visual suite; baseline writes only through the designated refresh workflow.
- Desktop worker: packaged desktop build/smoke verification on supported platforms.

## Stop condition

The integration is complete when all five workflows meet the acceptance criteria, fresh GitHub workers pass except for separately documented upstream advisories, every new visual is reviewed, documentation reflects the exact supported boundary, and no service can cross another service's credential, scope, resource, or vault boundary. Live Google-account certification remains a distinct release-readiness activity requiring real provider credentials and does not get inferred from mocked CI.
