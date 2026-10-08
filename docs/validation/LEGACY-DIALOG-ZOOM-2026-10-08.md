# Legacy dialog zoom follow-up — 2026-10-08

## Verified preceding revision

Source: `de577efb4420d8f3d223af170a07b07eb7e9a07b`.
Results describe that revision, not the subsequent CSS/test patch below.

| GitHub worker | Result |
|---|---|
| [CI run 37361220373](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37361220373) | Functional browser job `111937022527`: 374 passed; separate mobile run: five passed. Fast contracts/lint, Rust workspace and frontend/accessibility/TUI/daemon lanes passed. Overall CI remains failed on the dependency audit. |
| [Desktop run 37361220367](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37361220367) | Windows, macOS and Linux jobs passed, including native regression tests on Linux. |
| [Localization run 37361220369](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37361220369) | Passed. |
| [Visual run 37361220375](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37361220375) | 104 passed, four failed comparisons against historical references: MCP, history, publishing and health. |

The functional job log was read through the connected GitHub tool when local
CLI access to job logs was unavailable. Its final results explicitly report 374 and five
passes. This does not establish live-account provider synchronization or
packaged mobile behavior. The four unmaintained transitive Typst dependencies
remain documented in `SUPPLY-CHAIN-2026-10-04.md`; no exception was added.

## Current image reinspection

The visual artifact's manifest contains 115 unique images from 118 sources.
This follow-up individually reinspects these four actual captures, rather than
claiming a new manual review of every unchanged image. Earlier corpus ledgers
retain their dated evidence. Paths below are relative to artifact
`visual-review` from run `37361220375`, downloaded under ignored
`artifacts/verification/github-37361220375-visual/`.

| Image | Disposition |
|---|---|
| `images/current--screenshots-mcp-panel--mcp-panel-actual.png` | Dock starts below the top bar, close button has an inset, tabs and authorization cards fit. Body scroll allows the lower recipes. Reference change follows the reviewed panel geometry. |
| `images/current--screenshots-note-history-panel--note-history-actual.png` | Top and bottom modal borders are visible, close button has an inset, comparison/restoration actions fit. Both source columns remain within their card boundaries. The retained-save map shows the fixture's sparse history. |
| `images/current--screenshots-publish-center--publish-center-actual.png` | Modal begins at y24 with both top corners visible. Header/close and export controls fit; the long profile list is intentionally scrollable. |
| `images/current--screenshots-vault-health-dashboard--test-failed-1.png` | The opening view starts at the introduction; badge clears the divider. Metric grid, maintenance summary and repair controls fit with both modal borders visible. |

These four captures support refreshing their historical references through the
designated hosted screenshot workflow after the further patch passes functional
verification. No baseline was accepted merely to turn a failing check green.

## Further source-derived findings and repairs

Several older standalone dialogs still sized themselves using raw `vw`/`vh`.
App zoom changes the available CSS layout space while those units continue to
describe the physical window. The snippet and three-way conflict cards could
therefore exceed the effective viewport. Shared rename cards also lacked a
height cap for long dry-run previews.

The patch uses the existing effective viewport properties for rename/text
prompts, frontmatter, snippets, templates, import/deep-link dialogs, knowledge
surfaces, writing targets and conflict review. Long rename content scrolls
within the bounded card. A local container query stacks the snippet catalog
when its actual card width is small; native input minimum widths no longer
force horizontal overflow. Frontmatter fields use a shrinkable grid column.
Conflict choices and merged-preview headings can wrap, and preview columns
can shrink below their ordinary minimum when the card is narrower.

The initial `e2e/legacy-dialog-zoom.spec.ts` patch added 20 cases: ten routes at each of
1440×768 and 768×900, restoring the real 200% app-zoom preference before opening.
They exercise cheatsheet scrolling, populated snippet editing, template-list
reachability, import controls, writing targets, populated frontmatter, the
embedded saved-view/tag routes, rename dry-run cancellation, and conflict
selection without applying a native write. Cards and ordinary controls must
stay within the window; cancellation must retain the no-write fixture state.
A multiline snippet editor can be taller than its scrollport, so its test
asserts real text editing and horizontal bounds rather than requiring all rows
to be visible at once. Each case attaches its final open-dialog viewport PNG
for manual inspection on the worker.

Saved views and tags are tested through their supported Knowledge workbench
routes. This is not standalone legacy-panel coverage. The CSS findings are
source-derived risks until the new cases execute; they are not retroactively
presented as additional defects observed in the four images above.

## Verification boundary

The continued source sweep also found the shared `ToolbarPopover` mixing
physical bounding rectangles with CSS positioning and scroll dimensions under
fallback app zoom. Its trigger and viewport coordinates now use the body zoom
factor; native WebView zoom retains the ordinary coordinate path. Three Tools
menu cases cover 200% restored zoom, adjacency, viewport bounds, first/last
keyboard focus, scrolling and Escape focus restoration. These are additional
hosted regressions, pending fresh execution; no local runtime was started.
The standalone toolbar customizer also retained raw viewport sizing and a
physical-width breakpoint. Its card now uses the effective viewport, its rows
reflow at the card's container width, and the header/actions retain their
height while the list scrolls. Three additional cases check the close/apply
controls, the last width field, horizontal containment and cancellation.
The onboarding specialization had higher-specificity raw viewport sizing and
an unwrapped final action group. Its card now uses the effective viewport and
scrolls as a whole when needed; final actions wrap. Three cases advance every
tour step, inspect all five final controls and finish the tour. The expanded
legacy matrix now contains 45 cases, plus the two math compatibility cases.

The fresh audit at `dffacb08390e18b7f2eb172737c66c01556351d2` also detected
one low-severity npm advisory through Mermaid's older transitive KaTeX copy,
in addition to the four existing Rust maintenance findings. The
[upstream advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7) describes
inherited prototype properties bypassing renderer trust restrictions and names
0.18.2 as the fixed release. The renderer's direct dependency was already
locked at 0.18.7; the added override aligns vulnerable transitive copies with
that same integrity-pinned package, without a local installation. The targeted
lockfile edit reuses its existing package/dependency entries and removes the
now-unused vulnerable copy and its exclusive commander dependency. Frozen
installation succeeded on the
[hosted audit worker](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37775428356)
at `324647959c269ee213f9d8a0bd8084a2099a4d7b`, and its JavaScript audit
reported no known vulnerabilities. The combined gate remains failed because
of the four documented Rust maintenance advisories.
Two real Mermaid flowchart/sequence math-label browser cases supplement the
existing diagram export/preview regression. The patch does not claim evidence
of an exploitable prototype-pollution path in Scriptor.

A further specialist sweep found the command palette and theme customizer
still using raw viewport heights and physical-width breakpoints. The palette
now caps its actual card, leaves header/search context fixed and lets the list
shrink and scroll. The theme builder caps its card against the effective
viewport, keeps its header/footer outside the body scroller, and uses named
container queries to reflow its sidebar and color inputs. Contrast and preview
rows can wrap at the available width.

The owning Color palettes/module-manager dialog retained the same raw height
cap, which could place its separate creation row above the window before the
theme builder opened. Its ordinary and narrow card caps now use the effective
viewport too; the new theme route asserts that parent card and creation control
remain reachable before opening its child dialog.

The suite now contains 36 cases: all twelve routes at 1440×768, 1024×768 and
768×900. The intermediate physical width specifically catches layouts whose
mobile media query has not activated while zoom halves the available width.
New cases assert palette card/search/last-result bounds and theme card,
header/footer, editable fields and return to the owning palette dialog.

The further CSS/test patch awaits GitHub worker execution and review of its
new screenshots. No local installation, application, browser, build, lint or
test run was used. Read-only source/Git inspection and downloaded-image review
were performed locally. Unrelated user-owned schema, configuration and review
input changes are excluded from this patch.
