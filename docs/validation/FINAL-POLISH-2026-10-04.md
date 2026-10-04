# Final polish checkpoint — 2026-10-04

Starting revision: `19ff396a27d0c7e289ed82ca3d0b942f23f17c19`.
This is an ongoing evidence ledger, not exhaustive certification or release approval.

## Implemented corrections

| Boundary | Correction | Regression evidence |
|---|---|---|
| IPC recovery | Stop scanning exactly at the recovered magic marker; preserve body and following frames | `resync_preserves_the_recovered_body_and_following_frame`; failure observed before repair; earlier isolated IPC run passed 24 cases |
| Drive revisions | Reject multiple remote records for an immutable revision identity | `immutable_revision_identity_rejects_ambiguous_existing_records`; current compiled execution pending hosted workers |
| Deployment diagnostics | Redact the supplied Cloudflare token in process error strings | `deployment_timeout_diagnostics_do_not_expose_api_credentials`; current compiled execution pending hosted workers |
| Unix cancellation | Escalate the process group even after its leader exits; retain leader identity until escalation | `timeout_stops_term_ignoring_descendant_after_leader_exits`; Unix runtime proof pending Linux worker |
| Release downloads | Strip credentials on cross-origin redirects, require HTTPS, stream integrity checks, stage temporary output and atomically promote | Release transport tests added to hosted source/automation job; current execution pending |
| Interface preferences | Connect body/display font tokens to the selected UI font; preserve the code font | Font preference regression added; corrected the test's stale command-palette accessible name; current execution pending |
| Planner | Replace undefined muted color token with maintained theme token | Source review; current worker quality gate pending |
| Mobile history | Serialize selection, clear restore selection while loading, discard closed-dialog results and errors | React review and delayed-response regression added; current execution pending |
| MCP diagnostics | Bound retained diagnostic records and redact before truncating retained text | Existing unfinished audit regressions reviewed and completed; current worker execution pending |
| Review tests | Scope editor/tab owners explicitly, recognize embedded asset region, retain Persian Help checks and persisted planner time checks | Updated existing behavioral suites; current execution pending |

## Coverage and limits

Inventory at the starting revision found 33,066 tracked files: 31,134 synthetic
test-fixture files and 1,932 other files. Inventory is not semantic inspection.
Both supplied audit protocols were read completely. Native inspection coverage
and remaining modules are recorded in `FINAL-NATIVE-2026-10-04.md`; original
scratchpad recovery is recorded in `VISUAL-SCRATCHPAD-REVIEW-2026-10-02.md`.
Historical review documents retain their original dates and capability claims.

New browser audits cover eight workspaces, light/dark appearance, 1440px LTR and
320px RTL states. They attach rule violations and affected targets to the worker
report. These are browser fixture checks, not live-provider, packaged-device,
screen-reader or whole-product WCAG certification.

The earlier broad local browser attempt reported 292 passes and 18 failures;
several were obsolete selectors and others were browser resource failures. Its
results do not certify the current changes. The later local attempt was stopped
at the user's request. Trace inspection identified a Publishing case navigation
failure (`ERR_INSUFFICIENT_RESOURCES`), not an established contrast defect, and a
font-test selector failure. Neither is counted as a pass.

## Worker-only verification

The user prohibits full tests/builds on their computer. All such verification is
delegated to GitHub Actions. CI, desktop and visual workflows now run for draft
PR updates; desktop Linux runs native library regressions. Supply-chain audits,
source checks, Rust checks/tests, frontend build, browser tests and visual
comparison retain their existing failure enforcement and evidence artifacts.
The PR remains a draft until current-head results and remaining review work are
resolved. No live service operation or release publication is authorized here.

The previous localization worker failed because it demanded translations of
recovered forensic reports. Localization now excludes provenance evidence under
`docs/validation/`, while maintaining checks for active product documentation.

## Supplied ZIP

`rust-multi-service-sync-client.zip` was validated and unpacked under ignored
`artifacts/review-inputs/multi-service-sync-c27cd8672b5b/`.
SHA-256: `c27cd8672b5bea33ae03116f9e18a3eb9a62b338d2fc6bf52c16dce4200d0f94`.
It contains 133 entries and 232,256 expanded bytes, and is a Next.js/TypeScript
application despite its filename. Traversal, rooted paths, duplicate destinations,
symlinks and size limits were checked before extraction. Its packaged encryption
key was excluded and is not adopted. Archive adoption findings are maintained
separately in `MULTI-SERVICE-ARCHIVE-2026-10-04.md`.

The archive audit read 78 files completely and reviewed `.env.example` variable
names without exposing values. Four sync regressions adopt its useful conflict
scenarios while requiring preservation of BOM, CRLF, Unicode, media references,
whitespace-only authored content and overlapping formatting edits. Its sync
engine, dependencies and credential implementation were not imported.

Unrelated user schema changes, original review inputs, `.gortex/`, and the ZIP
remain outside the implementation commit.
