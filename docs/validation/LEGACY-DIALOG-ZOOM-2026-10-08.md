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
legacy matrix now contains 48 cases, plus the two math compatibility cases.
The separate top-bar customization popup used the same mixed coordinate
systems and raw height limit. It now converts measured/viewport dimensions
into CSS coordinates and uses an effective-width/height cap. Both its normal
button and header context-menu route share this bounded placement. Three cases
check scrolling, bounds, both opening routes and Escape focus restoration.
Fresh mobile captures also exposed a second inner border inside the rounded
Writing selector. The outer strip now owns the ordinary-scale frame; the
high-zoom layout, which removes that strip frame, retains the select's own
border. Existing mode selection and responsive screenshot cases cover this
small presentation repair; fresh worker capture remains required.
The designated reference refresh subsequently passed; its 35 individually
inspected gallery images and source/verification boundaries are recorded in
[the refresh ledger](SCREENSHOT-REFRESH-2026-10-08.md).
The cancelled predecessor's failure archive identified a test-bootstrap
defect: the zoom matrix explicitly selects CodeMirror, but workspace readiness
only inspected the Monaco-only test bridge. The rendered CodeMirror document
already contained Research Plan while that bridge was absent. Readiness now
checks the actual CodeMirror document when no Monaco model exists, retaining
the selected-note, expected content and visible editor assertions. The math
cases explicitly select Monaco before using its model bridge. This diagnosis
does not turn the cancelled run into a pass; all 50 new cases still require
their corrected hosted execution.

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

The palette/theme expansion brought the suite to 36 cases; the subsequent
toolbar, tour and top-bar routes bring the final matrix to 48 cases across
1440×768, 1024×768 and 768×900. The intermediate physical width catches layouts whose
mobile media query has not activated while zoom halves the available width.
New cases assert palette card/search/last-result bounds and theme card,
header/footer, editable fields and return to the owning palette dialog.

Integrated revision `d198c76567f11a5c3e02347fbdb080bde3fe4114` passed all
108 cases in [visual run 37778682769](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37778682769)
and all three platform jobs in
[desktop run 37778682796](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37778682796).
The screenshot refresh ledger records the subsequent capture and individual
reinspection of all 11 changed gallery images. The corrected 48 zoom cases and
two math cases still require their functional execution at
`0df092864d88b58f8dc8461e8ef26cd6998bff5b`.

At that corrected revision, [CI run 37780842196](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37780842196)
passed fast contracts/lint and frontend/accessibility/TUI/daemon smoke.
[Desktop run 37780842202](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37780842202)
passed all three platform jobs, and localization passed. The audit reported no
known JavaScript vulnerabilities; the same four Rust maintenance advisories
remain fatal. The final browser result and subsequent repairs are recorded below.

[Visual run 37780842141, attempt 1](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37780842141/attempts/1)
reported 107 passes and one workspace-startup failure before the Plugins route:
`ERR_NO_BUFFER_SPACE`, followed by an absent workspace main landmark. Artifact
`11552936590` contains the manually inspected blank failure image. No Plugins
panel or comparison diff was reached. A fresh hosted attempt was requested
without source changes, automatic test retries, baseline updates or looser
assertions. Its result must be recorded separately; attempt 1 remains a failure.

The same-source [visual attempt 2](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37780842141/attempts/2)
passed all 108 cases without a source, baseline or threshold change. The Rust
workspace job in CI run `37780842196` also passed. Attempt 1's workspace-startup
failure remains recorded above; the fresh attempt establishes a separate
successful comparison, rather than retroactively changing the failed result.

## Functional matrix findings and further repairs

Browser job `113324514914` in run `37780842196` reported **416 passed, eight
failed**, with **five mobile browser cases passed**. Both Mermaid math assertions
passed; their captures expose defects those assertions missed. Forty of the
48 legacy zoom cases passed. No full-matrix or math visual pass is claimed.
The downloaded failure/attachment archive is artifact `11554205253`.

- Three Saved views failures used the obsolete exact accessible name
  `Save current view`; all three snapshots show the correct selected Views
  route and `Save current…`. The test now verifies that selected tab and uses
  the actual label without removing geometry or reachability assertions.
- Three Tools failures resolved an enabled first menu item that lacked focus.
  Position and bounds had passed. Initial focus now happens in the layout
  effect while body/trigger owns focus; the following frame only repositions.
  The exact competing focus owner was not captured by the old trace. The first
  and last focus assertions remain, with an active-element diagnostic.
- The narrow top-bar reset button had an intersection ratio of 0.994738 after
  scrolling. Its failure PNG was individually inspected: its lower border
  touched the popup edge. Popup children no longer shrink, and the reset action
  retains trailing clearance. The full-intersection assertion remains intact.
- The narrow conflict route stalled in layout settling after Git opened and
  before Resolve was clicked. The inspected PNG additionally exposed a real
  Git title/status/action overlap. Git rows now reflow from actual list width
  and measure natural content; the same row stride drives total height,
  offsets, visible range and scroll anchoring. Tests check every visible row's
  action containment and title/action separation before opening conflict review.

The old settling trace does not identify which internal promise stalled.
Readiness now ignores paused/idle/finished animation promises, waits for running
finite animations, and bounds fonts, visible images, animations and paint-frame
stages with specific errors. Two behavioral cases verify a paused animation
does not block readiness and a running animation really completes first. These
changes do not assert an unproven paused-animation cause for the recorded stall.

The further repairs require fresh GitHub runtime checks and image inspection.

## Individual attachment review and false-green findings

The report metadata in artifact `11554205253` was decoded without executing
downloaded code. It contains 50 cases and 51 PNG attachments: 48 legacy zoom
cases, an additional late conflict capture, and two math cases. All 51 images
were individually inspected. The grouped ledger below records every route;
each legacy row covers its separate 1440×768, 1024×768 and 768×900 images.

| Route | Individual-image disposition |
|---|---|
| Top-bar customization | Wide/intermediate controls fit; narrow reset lower edge is clipped. The heading scrolling out after reaching the final control is intentional body scrolling. |
| Product tour | All three final-step cards and actions fit. |
| Toolbar customizer | All three headers, fields and footer controls fit. |
| Tools | All three menus fit; their failed initial-focus checks remain defects. |
| Command palette | All three card/search/result scroll areas fit. |
| Theme builder | All three parent/child cards and final controls fit. |
| Markdown cheatsheet | All three close controls fit with intentionally scrolled body content. |
| Snippet catalog | All three editors and actions fit; multiline body content scrolls. |
| Choose template | All three titles, close controls and option lists fit. |
| Import Obsidian vault | All three import cards and controls fit. |
| Writing targets | All three cards and history controls fit. |
| Frontmatter | All three populated fields and actions fit. |
| Saved views | All three selected Views tabs and actual `Save current…` buttons fit; obsolete test label caused failures. |
| Browse tags | Wide/intermediate shells fit; narrow detail pane squeezes prose into a thin column despite the old passing bounds assertion. |
| Rename preview | All three dry-run cards and cancellation controls fit. |
| Conflict review | Wide/intermediate conflict controls fit. Narrow failure image exposes Git row overlap; its later conflict attachment does not turn the failed case into a pass. |
| Mermaid flowchart math | Diagram is collapsed; inspector additionally reports a worker-error Markdown fallback. Old visibility/MathML-text assertions falsely passed. |
| Mermaid sequence math | Diagram is collapsed into tiny marks despite old passing assertions. |

The global `svg` icon rule forced diagrams and nested mathematical glyphs to
17×17px. It now targets `svg.lucide` only, preserving renderer geometry rather
than compensating at one preview surface. Math cases require meaningful SVG
width/height, readable expected labels and a visible formula, and reject a
visible degraded inspector. The patched KaTeX dependency remains in place.
The SVG consumer sweep checked Canvas, force graph, graph swatches, vocabulary
history and the semantic projection. Their own geometry remains scoped. The
existing populated semantic appearance case now requires readable projection
dimensions and its intended aspect ratio in light/dark and narrow RTL views;
its width-only rule previously inherited the same 17px global height.

The inspector fallback has a separate import-graph defect: the browser exports
of `decode-named-character-reference` and `hast-util-from-html-isomorphic`
access `document` and `DOMParser` during module initialization. Their pinned
export maps point both `worker` and `default` to the DOM-independent entry.
The worker resolver now resolves those two exact imports from each actual
importer using Node's default export conditions, without hoisted dependency
paths, broad condition overrides or any change to the production main bundle.
It uses fresh worker plugin instances for builds and the shared plugin pipeline
for development, as specified by [Vite's worker options](https://vite.dev/config/worker-options).
Dev's equivalent Markdown utilities use the DOM-independent entry too. The
flowchart and sequence cases now explicitly open the inspector, await its
current heading and completed state, and require a healthy render plus readable
geometry/math in both inspector and editable main Preview. Hosted compilation
and runtime evidence remain required; no successful worker import is claimed
from source inspection alone.

Tag browsing now uses a named container shared by its embedded and standalone
wrappers. It stacks navigation/details at the actual available width, bounds
the tag scroller and allows action/header wrapping. Its cases now assert a
readable detail width, select the fixture's real tag, and check populated note
and insert/rename controls; an explicit bridge fixture supplies that tag's
note result. These source repairs and stronger assertions await hosted proof.

No local installation, application, browser, build, lint or
test run was used. Read-only source/Git inspection and downloaded-image review
were performed locally. Unrelated user-owned schema, configuration and review
input changes are excluded from this patch.
