# Complete review reread and remaining acceptance gaps

The initial reports were reread on 2026-10-01 against the continuing implementation. Their original assertions are evidence to investigate, rather than a specification of existing behavior. The user subsequently accepted all proposed additions. Earlier assessment rows calling additions optional or design-only therefore describe the original baseline, not the current delivery scope.

## Source coverage

| Source | UTF-8 bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `Gemini-Review.md` | 63,038 | 767 | `a5def86a81b0a957d0911e4f9868b005e22d3ac9942f71741a667fc9e9ff5186` |
| `Visual Review.txt` | 380,911 | 2,989 | `7544d39f352628715e399e48fef213de69a832774520db5a734081368f35e7fc` |

The [reread inventory](review-reread-inventory.json) retains all 231 severity-marked visual entries, including polish, repetition, uncertainty and later withdrawals. The visual transcript also contains tooling, crop requests and reviewer deliberation. Its final crop queue is not fresh validation. Entries such as normal editor whitespace, partially visible scroll rows, the heart icon and deliberate theme differences must retain their withdrawal or uncertainty; they do not justify indiscriminate UI changes.

Gemini coverage includes all seven responses: Drive architecture alternatives (lines 3–123), plugin landings (124–191), extension/MCP boundaries (192–355), integration landings (356–509), data/health/media/history/diagram landings (510–614), subsystem criticisms (615–709), and concurrency/mobile/parser/packaging/export/log criticisms (710–767). Drive translation, revision logs and a Git relay are alternative architectures; implementing all accepted product capabilities does not require three competing synchronization authorities.

## Acceptance gaps exposed by the reread

This table lists remaining requirements and verification limits; it is not a completion claim. Existing fixed-defect dispositions remain in [the original assessment](REPORT-REVIEW.md). The working implementation and tests must close each applicable gap before it can be marked complete.

| Topic | Implemented evidence | Remaining acceptance |
|---|---|---|
| Drive collaboration | Explicit OAuth transport, immutable revisions, conservative first-share ancestry, durable per-vault/folder/note ancestor cache, reviewed merge with editor save coordination | Bounded polling lifecycle and cancellation, durable provider document mapping, loss-aware optional Google Docs bridge, authenticated account verification |
| Extension architecture | Validated declarative workspaces and gated capabilities | Manager registration/composition, persisted workspace docking and navigation, unified manifest compatibility; retain existing typed MCP/compute boundaries |
| Planner | Week grid, reviewed task/event mapping and revision checks | Integrated native sync, cancellation/conflict exercises and daily-note composition |
| Reference desk | Metadata/abstract browsing, reviewed Zotero import and bibliography usage | Full paper-to-note insertion/drag workflow and authenticated provider verification |
| Capture reviewer | Explicit fetch, editable extracted content/metadata, destination selection, highlight references | Original-source preview with confinement and sandboxing; native fetch deadline/DNS review |
| Semantic inspector | Measured PCA projections, provenance, provider/model controls and opt-in reindexing | Integrated browser/native verification; never infer semantic clusters from fabricated coordinates |
| Publishing studio | Eligibility review, preview, plan/apply, brokered build and explicitly configured deployment/domain controls | Immutable build/deployment staging, race/cancellation/privacy review, authenticated deployment verification |
| Runtime console | Authorized fresh-process execution with bounded output | Persistent owned sessions/kernels, interrupt/cancel and lifecycle, reviewed environments and plot assets |
| Database studio | Filter builder, table/list/gallery, guarded metadata edits, persisted validated views | Coordinator propagation and integrated verification; formulas/aggregates must remain bounded and explicit |
| Vault Doctor | Existing health dashboard, diagnostics and orphan triage | Reviewed missing-note creation, tag-case normalization and recoverable unused-asset pruning cards |
| Asset deck / reader | Indexed inventory/usage, PDF/EPUB reader, highlights linked to notes; origin-vault annotation writes; bounded raster/audio blob previews and cleanup | Packaged media/seek behavior, failed-flush behavior during broader workspace transitions |
| Analytics / time machine | Revision slider/diff/restore, real retained-history heatmap, distinct-word comparison | Vocabulary evolution graph and explicit metric definition; distinct-word ratio is not a validated readability measure |
| Diagram studio | Explicit rendering, errors, zoom and note navigation | Pan, Graphviz coverage, synchronized safe preview and native rendering verification |
| Mobile | Offline in-process kernel and signed Android ARM64 debug package | Device lifecycle/permissions/storage tests, iOS and release packaging; desktop daemon assumptions cannot be reintroduced |
| Export | Real PDF produced through the brokered Pandoc/Typst profile | In-process Rust Typst backend suitable for mobile/sandboxed hosts; an external compiler artifact does not satisfy this proposal |
| Existing visual defects | Focused remediation browser tests and historical captures | Fresh broad captures including German/Persian guide bodies, long rail identities, high contrast, scaled UI, dock/scroll clearance and all actionable polish entries |
| Cross-cutting claims | Focused source/native checks recorded separately | Final whole-product verification, documentation/claims update, dependency audit and complete uncommitted diff review |

## Boilerplate reinvestigation

All 321 files (314 Rust files; 8,732,734 bytes) were read completely for structural and boundary screening. The [new per-file evidence](../architecture/rust-boilerplate-reinvestigation.json) records hashes, sizes, import roots, function counts, test counts and boundary signals. Screening found tests in 134 files, `unsafe` markers in 20 and license markers in eight. These counts are neither vulnerability findings nor a license clearance. The collection has no common Cargo manifest and cannot be evaluated as one buildable application.

Targeted review was expanded beyond the original persistence, refresh, Drive/Docs, supervision and Markdown sources to authentication contract tests/provider handling, snapshots, media serving, credentials configuration and streaming highlighting. The [assessment](../architecture/RUST-BOILERPLATE-ASSESSMENT.md) records useful patterns and rejected assumptions. Source credentials, browser-cookie access, unrelated cloud commands, external services and telemetry were not adopted.

A concrete adaptation from the auth contract tests now distinguishes top-level `invalid_grant`/`invalid_client` from malformed, nested, temporary, throttled and server failures. It preserves the existing refresh lock and its in-lock keychain recheck, bounds token response reads, validates token strings/lifetimes and suppresses raw OAuth response text in authentication errors. The regression failed under the previous status-only policy before the correction; all 24 Google Calendar command unit tests passed afterward. This is local behavior verification, not a live OAuth test.

The snapshot principle has now been adapted to receipt-verified temporary deployment staging. Its deletion of invalid existing destinations remains unsuitable for user vault content. The streaming highlighter explicitly acknowledges quadratic output rebuilding despite incremental parsing; it is not evidence of a ready performance fix. The media excerpt offers byte-range and sandbox rules; Scriptor's reader protocol serves bundled viewer assets, while new media previews use bounded native reads and local blobs rather than an equivalent local-file streaming server.
