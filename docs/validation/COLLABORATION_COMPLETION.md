# Drive collaboration polling, opaque Google Docs transport and text translation

These capabilities remain experimental and explicitly opted in. No live account, credential mutation or provider write was performed during verification.

## Polling

The panel requests a native Google Drive read authorization only after the user accepts the polling disclosure and presses Start automatic checks. A native lease is bound to its originating vault and folder, exists only in memory, expires after 15 minutes, allows at most 30 requests and enforces at least 30 seconds between requests. The native store admits at most eight live leases. Every read checks the active vault and owner. Removing credentials invalidates the leases.

Each request lists the newest 100 immutable revision records in the selected transport. The lease freezes that transport; changing it stops checks and resets consent. Pagination remains a separate explicit manual action. Automatic checks never share a revision, modify a preview, apply a merge or write a note. Incoming changes remain listed for explicit review. Errors back off to 60 and then 120 seconds; three consecutive errors stop the session. No lease is silently renewed.

Closing the panel, changing its folder/note/vault, hiding the window or pressing Stop invalidates pending results and removes the native lease. A submitted bounded HTTP read may finish after stopping; its result is discarded. Stopping during authorization keeps the starting phase visibly pending until that submitted authorization returns, then releases any resulting lease. No duplicate session is launched while that request is pending.

## Google Docs

The **opaque Markdown tunnel** is a separate selectable record transport. Each new Google document carries the existing collaboration record as canonical JSON encoded in base64, with a schema label and SHA-256 checksum. This preserves Markdown UTF-8 bytes, CRLF/LF, literal syntax and Unicode. Existing ancestor checks, mapped note validation, merge review and local content CAS remain in effect. Drive listings require the Google Docs MIME type and both application markers; reads also validate the exact parent folder and live-file metadata.

The decoder accepts one tab, bounded plain-text paragraph runs and the single newline added by Docs. Edited schema markers, noncanonical envelopes, checksum mismatches, extra tabs, nested tabs and non-text blocks fail. Record and note size limits apply before upload; opaque text is bounded below the native four-MiB response budget. Creates are immutable: an already-used record name must decode to the same record. Embedded asset files are not synchronized by this transport.

The optional **text translation** workflow below remains distinct from the byte-preserving tunnel.

Read authorization is scoped to a selected file in the selected folder. Native metadata validation requires a live Google Docs MIME type and the exact approved parent. The Docs API requests all tabs, then the renderer translates bounded paragraph text/headings/table text into a reviewed merge. Unknown blocks fail instead of being silently discarded. Embedded objects and smart chips become marked placeholders. Disclosure explicitly covers loss of comments, suggestions, history, layout, headers/footers/footnote text, tab navigation, rich styles, lists and access permissions.

Users must resolve conflicts and separately accept conversion losses before applying. Apply uses the existing editor save coordinator and the source content hash captured for that preview. Per-vault/folder ancestry remains in the existing validated cache.

Export creates a **new plain-text Google document** from the saved Markdown under separate write authorization. Markdown syntax stays literal; this is a text copy, not rich Markdown layout conversion. Existing Google documents are never updated or replaced. Native input/output size limits and strict request types remain enforced. The export API returns the new document identity and the UI reports creation only after its response.

The encoded Google documents are immutable transport records; the local Markdown file remains the editable surface. Rich-content round-trip preservation is not claimed for optional text conversion. The implementation follows the provider's documented [file conversion upload](https://developers.google.com/workspace/drive/api/guides/manage-uploads) and [all-tabs document read](https://developers.google.com/workspace/docs/api/how-tos/tabs) contracts.

## Verification

Focused renderer tests initially failed for missing translator/poll policy modules, then passed: 10 tests across the existing merge/mapping cases, Docs headings/tables/tab content, explicit loss disclosure, unsupported shapes and size rejection, and bounded retry policy. Owned ESLint and renderer typecheck passed.

Native focused tests cover wrong-vault rejection, request-rate and expiry/budget enforcement, exact folder/MIME/deleted-document rejection, and copy limits. Their execution is coordinated with the root native verification pass.

Every explicit remote read or append also threads its originating vault into the native boundary and validates it before consuming approval. The native session lease remains held through the exchange. A deferred-authorization regression verifies a stale-origin request retains its original vault ID and is refused. Opaque-record tests check Unicode and mixed line endings, canonical markers, a specific checksum mismatch, multiple tabs and non-text rejection.

`e2e/collaboration-workflows.spec.ts` exercises explicit polling consent, stopping with a delayed reply, folder changes without renewed consent, three-error backoff, Docs preview/loss acceptance, new-document-only export, a manually reviewed merge through the vault-bound save path, opaque Docs append/read/poll routing and stale-origin refusal. Fixture wiring is opt-in under `e2e:collaboration` and absent from production bridge behavior. All six workflows passed alongside the independent six-workspace geometry/focus audit, Capture regressions, Overleaf workflows and publication regression in the **12/12** final browser run (`artifacts/verification/drive-overleaf-final.log`).
