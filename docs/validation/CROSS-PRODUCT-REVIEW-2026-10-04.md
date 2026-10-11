# Cross-product final review — 2026-10-04

Starting revision: `15b94b13870ca7d8ece9e600c1801cbf12b5768b` on PR #151.
This pass follows the original Gemini/Visual review dispositions, supplied audit
protocols and boilerplate/archive assessments. It challenges earlier conclusions
against current source and hosted evidence. It does not certify every possible
runtime state or authorize a release.

## Follow-up checkpoint — 2026-10-05

At `45f521f944459f5c47eb85a43f10516dba7a8f03`, all three
[desktop workers](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37232299730)
passed again. The [CI run](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37232299661)
passed Rust workspace formatting/check/Clippy/tests and frontend/accessibility/TUI/daemon
smoke. Its functional browser lane reported 364 passes and five failures, followed
by five mobile passes. These failures remain failed evidence until the repairs
below execute on a new worker. The fast lane passed the focused diagram/reader
regressions but failed lint on missing error cause and hook ref/effect usage.
The four dependency maintenance advisories remain unsuppressed.

Failure PNGs and contexts revealed a bibliography dialog wider than the zoomed
viewport and an initially focused Maintenance summary scrolling the health body
enough to halve its divider inset. Bibliography now uses explicit effective
viewport bounds. Health initially focuses a persistent introduction element,
retaining the shared focus trap and original clearance limits. The same element
survives empty-to-healthy/issue diagnostics, preserving focus without reclaiming
it after the user moves to Close. Four delayed-response regressions cover those
transitions. Research tests use real app
keyboard zoom and restored 200% zoom, with complete panel/close bounds. The Git
control size was sampled during its 180ms entrance transform; its original size
requirement now waits for finite ancestor animations to finish.

The Mermaid canvas-taint failure recurred despite an earlier passing run. Preview
initialization could overwrite export settings during asynchronous rendering.
Both clients now use one renderer-owned configuration/render queue with restoration
in `finally`, rejection recovery, and a narrow public SVG interface. Seven mocked
coordinator tests and two rasterization tests join the hosted focused step; the
real four-diagram PNG/preview regression remains unchanged. The hook lint repair
stores owner-bound display state and stable operation gates without resetting
pending operations during vault changes. Caught preparation errors retain their cause.
These new repairs are source-reviewed, with hosted results pending.

The [visual run](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37232299727)
again reported 104 passes and four historical reference differences. Focused
reinspection of six current images confirms the annotation dialog/mobile modes
are opaque and the MCP, History, Publish and Health surfaces retain their intended
geometry at ordinary zoom. This is a six-image reinspection following the complete
115-image review, not a second claim of reviewing all 115 images at this revision.
No committed reference images have been refreshed. Current image dispositions and
the five failure-image findings are recorded in
[the follow-up ledger](VISUAL-FOLLOWUP-2026-10-05.md).

## Confirmed corrections

| Boundary | Defect and correction | Proof being retained |
|---|---|---|
| Export lifecycle | Competing profiles could overlap and old-vault completions could populate current state. Use one synchronous operation slot, generation-bound completion, origin-bound native commands and a pending-transition refusal. | Operation-gate unit cases and delayed real-workflow E2E cases; hosted execution required for this checkpoint. |
| Publication lifecycle | The ordinary Publish Center retained reviewed plans across vault changes. Clear ownership-bound plans and pass originating identity through native plan/apply. Publishing Studio is remounted by its vault key and now also binds native commands. | Delayed-plan E2E and native authorization/source contracts. |
| Export preprocessing | A dry run could execute diagram processing or write assets; repeated diagram exports reused paths. Skip preprocessing during preview and create unique, missing-only generated assets. | Worker cases for absent dry-run writes and repeated diagram creation. |
| Diagram source parsing | Shorter diagram examples inside longer code fences were treated as executable diagrams, while tilde fences were missed. Track enclosing fences and validate line anchors, markers, closing lengths and source boundaries. | Backtick/tilde, nested example, CRLF, empty and unterminated fence cases through both replacement APIs. |
| Export outcomes | An unrelated completion event or a failed Git refresh could overwrite the interactive export outcome. Keep interactive completion authoritative and report auxiliary refresh failure separately. | Existing export suite plus focused delayed-profile regression. |
| Headless export identity | Desktop code generated a UUID unrelated to the daemon's returned job, causing polling to reject the actual job. Return and poll the real daemon identity with an originating-vault check. | Headless source contract and current worker native verification. |
| Private recovery | Source preimages and repair recovery could expose private content through default Unix modes; Python mailboxes had the same confidentiality problem. Create exclusive private files and directories at creation time. | Unix source, repair, runtime and filesystem regressions. Existing user directories are not chmod'ed. |
| Vault lock confinement | Linked lock storage could redirect mutation/update side effects outside the vault. Reject observed linked metadata storage and lock sidecars. | Linked-storage preservation regressions; this is not a claim of universal filesystem race prevention. |
| Resource copies | Rename fallback could merge into an existing destination and cleanup could delete unrelated content. Refuse preexisting destinations, create files/directories exclusively, clean only owned partials and recheck source state before removal. | Destination/data preservation and copy-failure regressions. |
| Resource approval and bounds | Hidden files were copied despite exclusion from the reviewed hash, and manifest reads were not bounded. Align hash/copy inclusion rules and enforce shared file, byte, entry and depth limits, with bounded manifest reads. | Hidden-content drift, oversized hidden-file and copy cleanup regressions. |
| Drive/Docs identity | A partial search could be mistaken for a unique or absent immutable identity. Request and reject pagination/incomplete-search indicators for the uniqueness probe. | Both revision transports' response-contract tests. Live account tests remain separate. |
| Reader paths | Unix accepted URL-shaped strings as local names while other platforms refused them. Reject URL, drive, backslash and control-shaped relative paths consistently. | The hosted Linux failure and expanded reader path cases. |
| Backup recovery test | A test expected the obsolete `promoting` marker after rollback had begun. Preserve the correct `rollback-in-progress` contract and prove a subsequent recovery retry restores original content and sweeps the journal. | Failing Linux worker assertion; expanded restart regression. No backup product behavior was weakened. |
| Pane reflow | Asset/diagram/capture grids relied on viewport width despite narrow desktop leaves. Reflow according to their available container width. | Three focused worker container regressions and hosted image review. |
| Input presentation | Repair-path and Quick capture inputs retained browser-default square styling and undersized geometry. Apply maintained theme, typography, focus and touch geometry. | Inspected hosted images, health regressions and strengthened visual checks. |
| User-reported spacing | The note tab had uneven vertical alignment and close-button inset/group spacing; the health badge touched the header divider. Balance tab control alignment and logical gaps, and add content-start separation. | User screenshot crops, hosted health image and focused geometry cases across width, direction and zoom. Fresh post-repair screenshots are required. |
| Activity localization | First-party activity labels remained English in German/Persian workspaces. Use locale-aware feature copy while preserving stable routing and English search aliases. | Both supported locales' activity and palette workflow regressions. |
| History composition | Comparison/restore controls were accidentally placed in the narrow history rail, with overlapping headings and wasted main-column space. Give revision selection, comparison and vocabulary analysis explicit grid ownership and pane-sized stacking. | Settled hosted images 44/45 and focused history-layout checks. |
| Secondary control consistency | Collection, saved-view, research-board, Git-preview and toolbar-customizer actions retained browser-default styling. Use existing themed controls, compact collection rows and separated preset/confirmation actions. Replace text close glyphs with SVG icons and follow theme checkbox/radio accents. | Per-image ledger and the focused screenshot-polish regression suite. |
| Repeated defects in other surfaces | Portal Pin inherited the stacked text-field layout, its row actions were unthemed, Support/module controls touched header dividers, and the planner's date input and template close glyph were inconsistent. Add a scoped associated checkbox row, theme those controls and separate first content from headers. | Geometry/style assertions in the corresponding named visual cases; snippet evidence now uses real fixture newlines instead of literal escape text. |
| Magnified header ownership | At 125% zoom, shrinking header sections let the logo collide with history controls and the vault selector intrude into mode navigation. Preserve section ownership and use available container width to select compact navigation. | LTR/RTL sibling-overlap cases at 125%, 150% and 200%; fresh image review required. |
| Similar cases beyond captured dialogs | Four remaining text close glyphs in outline, text-prompt, link-rewrite and external-link dialogs repeated the font-metric alignment risk. Footer media rules also missed the available width under intermediate magnification. Use the same SVG icon system and container-sized footer space allocation. | Existing dialog workflows plus magnified footer-content containment; source inventory found no remaining text close glyph in application components. |
| Palette and conflict geometry | The palette search outline clipped at its top edge; conflict source previews touched their borders, bulk actions touched, and the close control sat above the title. Add measured input/header clearance, padded source and shared title/action alignment. | LTR/RTL focus-clearance and conflict geometry regressions. |
| Narrow vault rail | Long note prefixes overlapped identifying suffixes, localized navigation was cramped, and the date icon collapsed. Explicitly shrink/truncate prefixes, stack navigation at the rail width and preserve SVG geometry. | Large-vault LTR/RTL labels and German narrow-rail regressions. |
| Screenshot readiness | Supplemental PDF evidence captured only Loading, and vault loading could disappear during settling. Wait for actual rendered PDF content and hold/release the E2E opening phase through its entire screenshot. | Corrected named visual cases; fixture-only control does not change product loading behavior. |
| Health fixture | Default browser fixtures returned `undefined` for recovery receipts, producing a visible “Invalid recovery history” error. Return the native empty-array contract explicitly. | Un-intercepted health fixture regression; strict product response validation remains. |
| Visual contracts | Several tests selected the old outer owner, obsolete PDF/Help copy or an obsolete compact-chip radius. Assert the current owner and meaningful geometry/content. | Existing screenshot and visual-review cases. Intentional baseline changes require inspected fresh images. |

## Hosted evidence at the starting revision

These results apply to the revision above, before the new corrections. They are
not passes for the later working tree.

| Worker | Result |
|---|---|
| [CI 37192060606](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37192060606) | Browser E2E: 327 passed. Mobile browser: 5 passed. Frontend build, accessibility smoke, axe audit, TUI and daemon smoke passed. Fast validation failed on a literal emoji in a sync fixture; preserve that fixture with a Unicode escape. Rust formatting failed; current repairs receive scoped formatting. The overall workflow failed. |
| [Desktop 37192060598](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37192060598) | Windows and macOS compilation passed. Linux native execution: 128 passed, 2 failed, exposing reader-path parity and the obsolete rollback expectation addressed above. |
| [Visual 37192060596](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37192060596) | 94 passed, 14 failed. Downloaded actual/expected/diff/context artifacts were inspected. Failures include stale selectors, intentional reference drift and the broken recovery fixture; no automatic baseline approval. |
| [Localization 37192060601](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37192060601) | Passed, including the ten newly authored architecture translations. |

Downloaded evidence is under ignored `artifacts/verification/github-<run-id>*`.
Parent inspection records all 46 assigned images 19–64 in
[its per-image ledger](VISUAL-IMAGE-LEDGER-PARENT-2026-10-04.md), in addition to the
earlier MCP actual, Vault health failure and 320px touch checks. The visual lane
records the remaining assigned images 1–18 and 65–108. The 108 unique images are
tracked against their original artifact paths/hashes; transient failure captures
are distinguished from settled product defects.

## Coverage and remaining proof

Native, renderer and visual lane reports record the files traced, confirmed
issues, rejected hypotheses and exclusions. The parent reviewed cross-layer
ownership, source-repair recovery, hosted failures, release transport and final
integration. Release transport inspection checked HTTPS/redirect credential
handling, bounded metadata reads, streamed verification and preservation of a
previous binary on failure.

- [Native boundary review](CROSS-PRODUCT-NATIVE-2026-10-04.md)
- [Renderer lifecycle review](CROSS-PRODUCT-RENDERER-2026-10-04.md)
- [Parent image ledger](VISUAL-IMAGE-LEDGER-PARENT-2026-10-04.md)
- [Visual source review](CROSS-PRODUCT-VISUAL-2026-10-04.md)
- [Remaining 62-image ledger](VISUAL-IMAGE-LEDGER-AGENT-2026-10-04.md)

Original scratchpad coverage remains in `VISUAL-SCRATCHPAD-REVIEW-2026-10-02.md`.
The Desktop Rust boilerplate and supplied multi-service ZIP remain covered by
their separate assessments. No packaged archive credentials or weaker sync
engine are imported. Original inputs and the unrelated generated-schema edit
remain outside implementation commits.

All full tests/builds run on GitHub workers. Locally this pass performs source
inspection, edits, scoped read-only formatting, Git diff review and downloaded
artifact inspection. It does not launch a browser, app server, build or test suite.

The four maintenance advisories assessed in `SUPPLY-CHAIN-2026-10-04.md` remain
unsuppressed and continue to fail the dependency gate; a compatible published
migration was not established. Release/container smoke stays gated. Live Google,
Overleaf and deployment-provider round trips, packaged mobile/device execution,
screen-reader behavior and broad platform performance measurements still need
their own evidence. These limitations are retained in capability maturity.

## Current checkpoint verification

At `7f2539bd08bf44249a6a3a45a2adbd8b1bec8800`, the
[desktop workers](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37206096369)
again passed Windows, Linux and macOS. The
[CI workers](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37206096340)
passed frontend/accessibility/TUI/daemon checks and the Rust workspace lane,
including the descendant-timeout regression. The source regression lane
exposed an obsolete expectation that draft PRs skip visual review; its contract
now requires draft coverage while retaining read-only baseline protections.
The separate dependency gate continues to report the four maintenance advisories.
The browser lane finished with 366 of 368 functional cases passing and five
mobile passes. All diagram-export and bibliography regressions passed. The
two failures were a Git locator that omitted the visible selection count and
a real 200% History modal overflow: the shared shell and backdrop ignored the
effective viewport dimensions already supplied by the zoom hook. The Git
selector now requires its positive count. Shared modal dimensions now consume
those viewport variables, and History additionally asserts complete panel and
heading bounds before exercising the unchanged restoration controls. These
follow-up corrections require fresh hosted evidence.

The [post-fix visual run](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37206096374)
passed 104 cases; its four failures are historical MCP, Publish, Health and
History reference-image differences. Fresh captures confirm the shared divider
insets, visible skeleton, readable EPUB section, complete print heading and
footer identity. Its 115-image sweep additionally found two translucent surfaces:
mobile sticky editor modes and the reader annotation dialog. Both receive opaque
themed bases and pixel-alpha regression assertions. Those last two changes
still require hosted recapture; no reference images have yet been refreshed.
The complete sweep is recorded in the
[70-image ledger](VISUAL-IMAGE-LEDGER-POSTFIX-2026-10-04.md) and
[45-image peer ledger](VISUAL-IMAGE-LEDGER-POSTFIX-PEER-2026-10-04.md).
The subsequent shared-style audit found the same translucent token usage in
sticky Canvas table headings and output dock headers. Both now retain their
theme tint over an opaque base; existing Canvas/footer workflows check the
rendered background alpha. This source-pattern correction is not presented as
an additional defect independently observed in the 115-image corpus.

At `890ac2777f0f1ea78856f2d3bcdeb56c46ce9d1f`, the
[desktop workers](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37202257178)
passed on Windows, Linux and macOS, including the Linux native regressions.
The [CI frontend lane](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37202257167)
passed frontend, accessibility, TUI and daemon smoke checks. The browser lane
reported 354 passes and ten failures; the separate five mobile checks passed.
The dependency audit still fails on the documented four
maintenance advisories; that gate has not been suppressed.

The [fresh visual worker](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37202257159)
reported 104 passes and four failures: two baseline differences, an ambiguous
history-word-count locator, and a real Support divider-clearance regression.
All 110 unique PNGs received a second individual review, recorded in the
[74-image fresh ledger](VISUAL-IMAGE-LEDGER-FRESH-2026-10-04.md) and
[36-image peer ledger](VISUAL-IMAGE-LEDGER-FRESH-REVIEWER-2026-10-04.md), with no
missing or duplicated manifest positions. Fresh tab/health
images confirm the intended spacing; Support and History still began flush
under their dividers and the desktop footer still cropped its vault identity.
The shared body contract now supplies the inset, rather than depending on an
unused Support stylesheet or a lower-priority History rule. The progress grid
now yields space to the complete status group. New geometry tests cover these
recurrences in LTR and RTL. Touch-tab leading/closing insets also differed by
two pixels; their padding is corrected while retaining the same geometry limits.
The browser failures also exposed ambiguous bibliography/result locators and
test setup that required a desktop rail at mobile sizes or attempted a Git
commit without a message. Those tests now select their intended owners and
perform the real prerequisite actions. No baseline has been automatically accepted.

The fresh sweep found transparent inspector tabs over scrolling text, template
dialog text bleed, and a loading screenshot whose skeleton styles were never
imported. The sticky/tab and dialog backgrounds now have opaque themed bases,
and the skeleton imports its styles and supplies a visible static background
even when shimmer animation is disabled. Print evidence aligns the first page
header rather than centering a page taller than the viewport. EPUB chrome now
shows a validated one-based spine section, with its exact CFI retained for
navigation and annotations; the deprecated flat location event no longer
replaces that position with an empty string. Three protocol tests and a real
EPUB surface assertion accompany that change. These new repairs still need
hosted rendering evidence.

Hosted diagram tests passed 14 of 15 cases: CommonMark preserved CRLF inside
renderer source, violating the existing LF-source contract. Renderer source is
now normalized while authored offsets and surrounding Markdown remain intact.
The Rust workspace also found a surviving Unix descendant after timeout. The
[timeout review](TIMEOUT-REVIEW-2026-10-04.md) records the unchanged regression and
the explicit process-group operand delimiters. These follow-up corrections
still require fresh hosted results before being called verified.

The browser export failure was a real rendering defect: Mermaid HTML labels
inserted SVG `foreignObject` content that tainted the rasterization canvas.
Export now secures SVG labels for its render and restores the shared preview
configuration in `finally`. The regression exercises four diagram types,
an attempted label override, decoded PNG bytes, unique asset paths, preserved
source and subsequent interactive preview. Its hosted rerun remains pending.

Hosted checks at `dc1cbc0fb` exposed two checkpoint integration errors: the
exclusive-copy helper needed the `std::io::Read` trait import, and the new
parser-dependent diagram tests ran before the frozen dependency installation.
Both are corrected; diagram tests now run through a logged post-install step.
Those failed/cancelled runs are retained as failure evidence, not runtime passes.

The hosted fast unit step explicitly includes the fifteen diagram-preparation and parsing
regressions in `packages/export/src/diagram-render.test.ts`, so they cannot be
silently omitted by a source-library-only test list. The functional browser
configuration discovers the new screenshot-polish geometry spec alongside the
new export, reflow, tab/health, locale and history cases. Existing named visual
captures retain the corresponding repaired surfaces for manual image review.
