# Renderer lifecycle and publication integrity review

Review date: 2026-10-04. Starting revision:
`15b94b13870ca7d8ece9e600c1801cbf12b5768b`.

This pass traces asynchronous renderer ownership and its native mutation calls.
It supplements the earlier visual and boilerplate reviews; it does not replace
their evidence or certify every renderer file. No tests, builds, installs,
development servers or browser workloads were run locally. New regressions must
execute on GitHub Actions workers before runtime success is claimed.

## Confirmed defects and repairs

| Finding | Trigger and consequence | Repair and regression |
|---|---|---|
| Competing export profiles bypassed the pending offline guard | Start offline PDF, then invoke Reveal export through the command palette. The original hook guarded only another offline export; the second profile could start native work and compete for busy/history/result state. | A synchronous operation gate covers all profiles and retains its submitted-work slot until completion. Refusals produce an activity notice without replacing the original export outcome. `e2e/export-integrity.spec.ts` submits the second profile through its real palette route and checks the refusal notice, command count and eventual offline success. |
| Export completion was not owned by a vault | A delayed result/error could update the hook after its vault changed; global daemon export events could also clear an unrelated interactive operation or replace its artifact/error. | Committed vault ownership and generations fence results and errors, with unmount invalidation. Interactive run commands reconcile their returned completion, without subscribing to unowned global job events. A pending export rejects a normal vault transition with an actionable message. `workspaceOperation.test.ts` covers delayed completion, return to the same owner, duplicate completion and stale callers; the real browser workflow covers transition refusal. |
| Diagram preprocessing crossed origin and preservation boundaries | An asynchronous diagram render could subsequently save into the newly active vault; repeated exports used the same asset filenames and could replace existing assets. | Renderer asset/run/cancel calls carry the originating vault identity, complemented by native validation. Generated diagrams use unique creation-only filenames. The repeated-export browser regression checks distinct paths, `requireMissing`, expected vault identity and preservation of a pre-existing user asset. |
| Export preview performed material work | The dry-run branch still rendered diagrams, could run PlantUML and wrote generated assets. The translation branch ignored dry-run and invoked translation. | Dry-run passes the captured source to native planning without materializing diagrams. Direct PDF operations reject dry-run; their preview controls are disabled. A browser regression checks raw Mermaid source remains in the preview request and no asset/PlantUML write occurs. |
| Legacy publication plans survived vault replacement | `useStarlightPublishing` held a reviewed plan without a vault identity. A delayed plan could repopulate/open Publish Center after replacement, and apply calls lacked originating-vault arguments. | The hook now requires a vault identity, clears plans on owner change, fences delayed prompts/results/errors and scopes every plan/apply/refresh call. The browser regression performs a real vault switch while planning is pending and checks the old result cannot populate the new owner's plan. |
| A consumed publication plan remained usable after refresh failed | Site mutation could succeed, but an unsuccessful replan left the previously consumed plan visible for another apply. | Clear the consumed plan immediately after a successful mutation. Report a subsequent refresh failure as a refresh failure and require a new reviewed plan. |
| Direct daemon Markdown export omitted the switch barrier | Unlike the note-export wrapper, Markdown export could dispatch before a pending renderer-requested daemon vault transition completed. | The wrapper now awaits the same barrier and passes optional expected vault identity. Native daemon adapters validate/capture origin independently; see the native lane evidence. |
| Diagram preparation hid failures | A renderer, permission, creation-only asset write or cancellation failure was caught and replaced by the original code fence. Native export could then report success despite the missing rendered diagram. | Preparation now rejects with the diagram kind, index and original actionable error. Missing PlantUML adapters also fail explicitly. Package tests cover failed writes, cancellation, stopping before subsequent renders and missing adapters. A real browser workflow rejects the asset write, checks the failed history/error, verifies no native export dispatch and preserves the authored editor draft. |
| Mermaid export rasterization tainted the browser canvas | Hosted run `37202257167` at `890ac2777f0f1ea78856f2d3bcdeb56c46ce9d1f` failed the real Mermaid export: `toDataURL` rejected because generated HTML/foreignObject labels tainted the canvas. The native fixture did not cause this renderer failure. | Export initialization now uses the root SVG-label setting, protects it from document directives and restores the previous shared configuration after rendering, including parse failure. The browser regression renders flowchart, class, state and sequence diagrams twice; checks PNG signatures, real browser decoding and nonempty colored pixels; checks exact native Markdown references and unchanged authored source; attaches the four generated PNGs; and verifies a subsequent interactive preview retains HTML labels. This repair requires a new hosted run. |
| Standalone diagram callbacks emitted unescaped destinations and invalid placeholders | Callbacks returning filenames with spaces, brackets, parentheses, apostrophes, percent signs, hashes or query punctuation produced broken Markdown. Omitting a render callback wrapped the documented placeholder comment inside an image destination. | A shared helper encodes raw file path segments while preserving directory separators. Real image metadata retains its raw path. No-renderer replacement emits actual comments and no phantom image records. Package behavioral tests cover both public paths. |
| Bibliography evidence contained an isolated separator and silently exercised fallback formatting | Both screenshot and E2E bibliography fixtures used `type` instead of required `entry_type` and omitted `source_path`. The metadata row became only ` · `, and CSL conversion failed on the missing type. | Fixtures now match the native bibliography shape. The panel joins populated metadata fields and omits an empty row. Two browser regressions check source/type metadata plus active CSL preview, and blank metadata without a separator-only row. No citation text was stripped to hide the defect. |
| Authored diagram examples were treated as executable diagrams | The unanchored triple-backtick regex matched shorter Mermaid examples inside longer Markdown code fences, ignored valid tilde diagrams and could close on inline/trailing fence text. A subsequent anchored scanner also skipped valid list-nested diagrams and stripped their opening indentation. | The export module now uses the existing CommonMark parser stack to identify real code nodes, including container-relative list/blockquote fences. Only the opening fence delimiter onward is replaced; the authored list/quote prefix stays outside that range. Renderer source comes from de-indented code-node text. Eight behavior tests cover backtick/tilde fences, longer examples, two-/four-space lists, quotes/nested quoted lists, same-line list markers, literal indented code, closing/info/CRLF/EOF rules, and shared rendering/dry-run paths. |

The export path also keeps a successful artifact/history result if an ancillary
Git refresh rejects. Translation now supplies its real artifact result to the
same export history/result owner. These are source-reviewed improvements; they
are not independently established runtime passes in this artifact.

Generated image paths also omit the authored note name: spaces, brackets and
other URL syntax in note filenames previously entered Markdown image
destinations without quoting. The UUID/index path is safe for that direct
destination and retains unique creation-only semantics. Cancellation distinguishes
preprocessing from submitted Pandoc work and completed artifacts; it cannot
send a global native cancel merely because preprocessing or Git refresh is
pending.

Publication gate refusals now produce a toast while retaining the submitted
operation and reviewed plan. The delayed-plan browser workflow submits a second
real palette command and checks that it gets feedback, creates no additional
native plan and cannot bypass the pending operation. A failed or cancelled
export may leave already created unique diagram assets unused; it does not
overwrite existing assets or mutate the authored document.

The CommonMark parser dependencies are declared directly by `@scriptor/export`,
using the already resolved parser stack owned by the preview renderer. Only the
export importer in the lockfile changes; no private cross-package source import,
renderer dependency or package cycle is introduced. A hosted frozen install must
verify that declaration and importer before the parser repair is considered a
runtime pass. Semantic diagram source normalizes line endings as the Markdown
parser does; the authored text outside each replacement range retains its bytes.

## Owner traces and findings rejected after inspection

- `ReviewFeatureWorkspaces` keys its enclosing error boundary by both feature
  and vault. `PublishingStudioPanel` therefore remounts on a vault change; its
  old `mounted` ref remains false rather than becoming the new owner's ref.
  Native plan/apply calls nevertheless now carry its vault ID, so display
  ownership cannot substitute for native mutation authorization.
- Collaboration additionally keys its component by the active note path.
  Folder/transport edits clear dependent previews/cursors; pending actions use
  a synchronous occupied ref and an epoch, while note reads verify metadata
  vault identity and writes use reviewed content hashes and the source mutation
  coordinator. No additional confirmed defect in those inspected paths was
  repaired solely on suspicion.
- Overleaf reads/saves use explicit vault identity, reviewed local/remote
  fingerprints, a synchronous pending ref and generation checks. Its pending
  action prevents ordinary vault replacement. Closing an already submitted
  operation explicitly describes the possibility of later native completion.
- Fresh runtime execution has a synchronous execution lock, an unmount
  generation fence, a leaf close guard and a pending-vault-switch guard.
  Persistent session behavior belongs to `useRuntimeKernel` and the native
  session boundary; that full implementation was not semantically audited by
  this renderer lane.

## Coverage and verification limits

Semantically inspected in full: `useWorkspaceExport`, `useStarlightPublishing`,
`WorkspaceOperationGate`, the export bridge wrappers, `CollaborationPanel`,
`PublishingStudioPanel`, `OverleafPanel`, `RuntimeConsolePanel`, and
`ReviewFeatureWorkspaces`. Publication/daemon bridge functions, Publish Center,
export event subscriptions, and `useVaultWorkspace` were inspected only for the
named paths above. Source editor, polling, persistent runtime and mutation
coordinator implementations were traced through interfaces/owner calls rather
than read exhaustively in this lane.

The two diagram export modules, BibliographyPanel and its preview/fallback
formatters were additionally source-reviewed for the findings above. The
changed regions in SavedViewsPanel, SmartCollectionsPanel, CanvasPanel,
RenameNoteDialog and editor/CustomizableToolbar were reviewed for React and
TypeScript correctness: themed control classes and aria-hidden SVG replacements
retain the existing handlers and types. The held-vault bootstrap listener is
one-shot and confined to the E2E fixture. The screenshot-polish-regressions
selectors were checked against their actual panel names, toolbar structure and
the direct right-click rename route in VirtualNoteList. Long-label checks use
the prefix/identity DOM used by the virtualized rows. Existing controller logic
in those components was not exhaustively re-audited as part of that diff review.

The authored regressions are three operation-gate tests, fifteen diagram package
behavior tests, four export/publication browser workflows in
`e2e/export-integrity.spec.ts` and two bibliography browser workflows in
`e2e/bibliography-metadata.spec.ts`. Hosted browser run `37202257167` executed
at `890ac2777f0f1ea78856f2d3bcdeb56c46ce9d1f`: the delayed-plan transition,
rejected asset write and populated bibliography workflows passed. The offline
workflow reached success but its final assertion matched both latest output and
history; the blank-metadata workflow's title assertion matched both citation and
literature-note controls. Their repaired assertions target the actual owners and
retain both artifact/title behavior checks. The bibliography failure snapshot
includes the complete title and active CSL preview after formatting settles; no
citation text or fixture metadata was removed to make the assertion pass.

The same run exposed the real tainted-canvas failure described above. Its log and
selected failure contexts/images were inspected from
`artifacts/verification/github-37202257167-browser.log` and
`artifacts/verification/github-37202257167-browser-evidence/`. Archive byte ranges
were unsupported; only the selected contexts and PNGs were extracted, without
opening videos or executing the application locally. All three repairs and the
expanded PNG/preview assertions are source-reviewed and pending a new hosted
run. Diff whitespace inspection passed; this is not compiler or runtime evidence.
Packaged WebView, live providers, devices and screen readers are outside this
lane's verification claims.

Mermaid's installed type declarations and resolved source were checked against
the pinned upstream configuration implementation: the root `htmlLabels` setting
takes precedence over diagram-specific values, and secure keys cannot be changed
by document directives. See the [configuration schema](https://mermaid.js.org/config/schema-docs/config.html#htmllabels)
and [the matching upstream implementation](https://github.com/mermaid-js/mermaid/blob/mermaid%4012.0.0/packages/mermaid/src/config.ts).
The initial correction did not change the preview renderer. The subsequent
`45f521f94` browser run reproduced the tainted canvas: preview initialization
could race the export's asynchronous render. Both clients now coordinate
initialization, rendering and restoration through one renderer-owned queue.
The regression covers overlap in both directions, multiple exports, render/import/
initialization failures and run-only preview test doubles. Hosted execution of
this later correction remains pending; the earlier single passing browser run
does not establish that the race was resolved.
