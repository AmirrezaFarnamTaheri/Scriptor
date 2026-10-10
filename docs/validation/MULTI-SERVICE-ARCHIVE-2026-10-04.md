# Multi-service archive audit and selective adoption

Date: 2026-10-04. This is a source audit, not a provider integration certification.
No local tests, builds, dependency installation, services, or account operations
were run for this audit. New regression cases await GitHub worker execution.

## Provenance and coverage

- Input: `rust-multi-service-sync-client.zip` in the repository root.
- SHA-256: `c27cd8672b5bea33ae03116f9e18a3eb9a62b338d2fc6bf52c16dce4200d0f94`.
- ZIP inventory supplied by the extraction pass: 133 entries, 232,256 expanded
  bytes. ZIP entries include directories; they are not 133 source files.
- Review snapshot: `artifacts/review-inputs/multi-service-sync-c27cd8672b5b/`.
- Snapshot inventory: 79 text files. The 78 non-environment files were read in
  full, including source, configuration, README and the single decision test.
  `.env.example` was inspected only for variable names; its values were excluded.
- The archive contains `.data/encryption.key`. Extraction excluded that key;
  its contents were never read, printed, imported, or staged by this audit.
- This is **WorkBridge**, a Next.js/React/TypeScript/PostgreSQL/Drizzle project,
  as its own README states. It contains no Rust implementation. It is distinct
  from the previously examined Desktop Rust boilerplate.

Coverage groups:

| Group | Files | Read scope |
| --- | ---: | --- |
| Root configuration and README | 9 | Eight complete; environment names only |
| Library implementation | 18 | Complete |
| API routes | 26 | Complete |
| Pages, components, DB schema and CSS | 25 | Complete |
| Decision test | 1 | Complete, not executed |

The 18 libraries include API/session/authentication, connections, encryption,
Drive, GitHub, Gmail, Google token retry, OAuth credentials/flow, HTTP, vault,
and all four sync modules (`adapters`, `decide`, `engine`, `links`). All seven
workspace client components were read, along with their page wrappers, root
and authenticated layouts, dashboard, login/register pages, shared UI,
sidebar, auth form and the two DB files. All 26 routes were read, including
authenticated mutations, OAuth callbacks, health and scheduled sync.

## Useful patterns and how they fit Scriptor

| Archive pattern | Assessment | Adoption decision |
| --- | --- | --- |
| Pure sync decision function separated from I/O | Useful: first-share, unchanged-side, equal-side and overlapping-edit behavior is reviewable independently | Adopt edge-case regression ideas in the existing Scriptor merge module; retain its current conservative merge |
| Local update guarded by the displayed content hash | Useful protection against edits made while network work is pending | Preserve Scriptor's source-save and reviewed mutation checks; do not substitute DB SQL for its vault coordinator |
| GitHub write includes the previously read blob SHA; Overleaf push is not forced | Useful remote revision preconditions | Retain Scriptor's reviewed Overleaf head/content checks and ordinary push; no extra GitHub management workspace is implied |
| Re-read provider content after a push | Useful acknowledgement concept, but the archive does not prove the returned version is the one just written | For Scriptor's Docs tunnel, continue verifying the canonical record and checksum rather than accepting arbitrary normalized content |
| Adapter exposes read/write/close and closes in `finally` | Useful ownership pattern | Retain native temporary checkout lifetime and the shared process boundary; do not import a second JS Git implementation |
| Scope account lookups by owner and provider | Useful isolation | Preserve Scriptor's expected-vault and folder-bound authorization checks |
| Preserve an existing refresh token when re-consent omits it | Useful credential lifecycle invariant | Relevant for future OAuth maintenance; do not import WorkBridge's shared-file encryption key design |
| Do not retry POST mail sends; bounded retry/backoff for reads | Useful mutation safety distinction | Do not introduce generic method-only retries to reviewed native writes |
| Sandboxed remote HTML and opaque attachment downloads | Useful isolation idea | Retain Scriptor's existing sanitizer/Reader/media boundaries; no Gmail product is added |
| Unlink removes the relation and leaves remote/local content intact | Useful clear lifecycle semantics | Preserve transport disconnection and local mapping ownership; remote deletion remains an explicitly reviewed operation |

Current Scriptor comparison used CodeGraph first, then scoped inspection of
the native collaboration implementation and existing test file. The inspected
product contracts describe immutable Drive revisions, checksum-protected
opaque Docs records, explicit share/merge, bounded consented polling, and
reviewed source exchange. These are stronger preservation boundaries than
WorkBridge's overwrite-based mutable text adapters.

## Archive defects and risky patterns not imported

These are source-derived findings in the supplied archive, not newly proved
defects in Scriptor and not live-provider exploitation results.

1. **Packaged encryption key.** `.gitignore` excludes `.data`, but the ZIP
   still contains the key file. An encryption-at-rest claim does not make a
   shared packaged key appropriate for another product. No secret import.
2. **Implicit content rewriting.** `sync/decide.ts` removes the initial BOM
   and converts CRLF and lone CR to LF. Both vault creation and sync call it.
   First-sync decisions also treat `trim() === ''` as empty, allowing authored
   whitespace to be replaced. These choices conflict with Scriptor's exact
   authored-source preservation. No normalization policy imported.
3. **Drive and Docs write races.** Their adapter `write` methods contain no
   remote version/ETag/revision precondition. A remote edit between `read` and
   `write` can be overwritten. GitHub's SHA and Overleaf's non-forced push
   provide a different level of protection. No mutable Drive/Docs adapter import.
4. **Lock scope does not establish a vault-file transaction.** The Postgres
   advisory lock protects one link. Multiple links for one local file can run
   under different locks. The local hash CAS helps reject a stale local write,
   but a remote push, local update, bookkeeping and activity insertion are
   separate operations. Failures can leave partial progress; callers should
   not interpret an error as proof that no side changed. No claim of atomic
   cross-provider synchronization adopted.
5. **Read-back is not a verified acknowledgement.** `pushRemote` writes then
   reads and `markSynced` records the returned hash without verifying identity
   or expected content. Another writer may advance the remote between those
   operations. For rich Docs, the stored local base and normalized remote can
   also differ. Scriptor keeps opaque, immutable identities/checksums instead.
6. **Remote content bypasses local input limits.** `vault.ts` limits user
   writes to 2 MiB, but `engine.ts`'s `setLocal` updates the DB directly;
   upstream readers use unbounded `text`/`arrayBuffer`. NUL-only binary checks
   do not validate UTF-8. No unbounded provider buffering imported.
7. **Filesystem symlink boundaries are incomplete.** `overleaf.ts` validates
   lexical project paths, then reads/writes checked-out paths with normal FS
   calls. There is no explicit symlink/reparse-point check before traversal.
   A lexical path check alone does not confine remotely supplied checkout
   links. Scriptor's blob-based reviewed exchange remains the model.
8. **Refresh/credential lifecycle races.** Token refresh has no per-account
   single-flight guard; concurrent callers mutate token state separately.
   Replacing a user's OAuth client credentials does not bind already stored
   refresh tokens to the original client. Do not import this lifecycle whole.
9. **OAuth browser binding is incomplete for sign-in.** `finishOAuth` checks
   the originating session only when the state row has a non-null `userId`.
   Sign-in states deliberately use null and there is no separate browser nonce
   comparison in the reviewed code. PKCE/state consumption alone is not proof
   that the browser finishing a sign-in started it. No auth implementation import.
10. **Deployment trust and error handling need review.** Origin/base URL
    helpers trust forwarded host/protocol headers without an explicit trusted
    proxy rule. Login throttling is per-process, keyed partly by a forwarded
    IP and does not prune inactive entries. Upstream response text can enter
    user-visible errors; generic logging can expose exception context. These
    require deployment-specific fixes before hosting WorkBridge itself.
11. **UI request identity is not preserved consistently.** Vault file opens,
    mail details, account changes and provider pagination have no request
    generation or cancellation guard. A slower prior request can replace the
    latest selection. Vault save also permits editing during asynchronous work
    and may replace text after a sync reload. No client component import.
12. **Archive UI does not meet Scriptor's composition requirements.** Fixed
    sidebar width, horizontal table scrolling, unnamed controls, modal focus
    management gaps, and duplicated client/server text-extension lists would
    reintroduce the kinds of visual/accessibility issues identified in the
    original review. Styling and layout are not adopted.
13. **Method-only retry is insufficient for writes.** The HTTP helper retries
    PUT/DELETE based on the method alone. GitHub file updates include a blob
    SHA and may have succeeded before a transport error, making a replay stale.
    Retries need operation-specific acknowledgement/idempotency handling.
14. **Link creation is not transactionally unique.** Duplicate detection is a
    read before insert; the schema has indexes but no target-identity unique
    constraint. Concurrent creates can produce duplicate links, and remote
    creation happens before link insertion, leaving orphaned remote objects
    if later operations fail. This is not a substitute for immutable identity
    rejection and reviewed recovery.

The archive's single test covers pure merge decisions. It does not prove
provider authorization, DB transactions, CAS interleavings, limits, cleanup,
HTML isolation or UI race behavior. It was read, not executed.

## Concrete adoption in this change

Added four focused tests to `src/lib/collaboration.test.ts`, using Scriptor's
existing implementation and test framework:

- First shares retain whitespace-only authored content and report a conflict
  when another non-empty side differs.
- Equal/unchanged-side merges preserve BOM, CRLF, combining characters,
  Persian text, emoji, indentation and media references exactly.
- Independent insertions preserve both additions and CRLF.
- Overlapping format-only edits keep local, base and remote text for review
  instead of silently canonicalizing the source.

Existing tests already cover ordinary first shares, disjoint edits,
overlapping content, equal revisions and scoped durable ancestors. The native
`opaque_docs_records_preserve_markdown_bytes_and_reject_edits_and_multiple_tabs`
test already checks exact encoded record recovery, corruption, extra blocks
and unsupported document structures. Those established cases were not copied
or replaced with the archive's lossy normalization expectations.

Execution of new tests and broad verification is reserved for GitHub workers
under the user's explicit instruction. No test-pass or live-account claim is
made by this report. No WorkBridge dependencies, auth server, Gmail/GitHub
management product, database schema or credential material were imported.
