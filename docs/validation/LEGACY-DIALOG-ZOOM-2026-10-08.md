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

The functional job log was read through the connected GitHub tool after the
local CLI credential expired. Its final results explicitly report 374 and five
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

`e2e/legacy-dialog-zoom.spec.ts` adds 20 cases: ten supported routes at each of
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

The further CSS/test patch awaits GitHub worker execution and review of its
new screenshots. No local installation, application, browser, build, lint or
test run was used. Read-only source/Git inspection and downloaded-image review
were performed locally. Unrelated user-owned schema, configuration and review
input changes are excluded from this patch.
