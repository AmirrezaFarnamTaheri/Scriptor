# Scriptor workspace, dock and preview audit — 2026-10-14

> Scope: PR #162 plus adjacent vault lifecycle, note creation, navigation, Markdown rendering, keyboard handling, virtualized lists, responsive layout, and supply-chain gates.
> This is a **source-grounded remediation inventory**, not a claim that every Scriptor module has passed runtime testing. See the linked GitHub Actions workflows for the current build/browser verification status.

## Defect inventory and remediation

| Severity | Area | Evidence / failure mechanism | Remediation in PR #162 |
| --- | --- | --- | --- |
| High | Viewport scroll ownership | Shell/root could grow while sidebar utilities and note tree competed for panel height | Constrain document and workspace viewport; scroll the vault dock content separately, keep its footer available |
| High | Duplicate navigation | Note tabs were shown by both the editor and primary workspace leaves | Hide already-represented note leaves; retain tools and unopened inert restored tabs |
| High | Saved workspace restoration | Leaf layout was filtered before the vault note inventory was ready | Defer hydration until native vault status is ready; preserve per-vault reference ownership |
| High | Restored active note | A saved leaf could remain inert even when editor session had already opened the exact same note, leaving writing hidden | Use the existing editor for a matching restored active note; regression test |
| High | Cross-surface note navigation | Recent notes, wikilinks, diagnostics, deep links and note-creation flows could update editor state without selecting the visible workspace | Route explicit navigation through workspace composition and reconcile later direct editor-originated changes without activating saved sessions |
| High | Side-note preview | A reused component could expose stale content/errors while switching note or vault | Key fetched result to vault ID + path; discard obsolete asynchronous results |
| High | Note integrity | New/template/typed/daily note paths risked overwriting a same-named note if saved without create-only expectations | Enforce the native `<missing>` compare-and-swap contract; allocate numbered filenames for ordinary new notes |
| Medium | Virtual note list | Shrinking a filtered list could leave the scroll offset outside its new range and render no usable rows | Clamp physical and virtual scroll positions after content-size changes |
| High | Mobile virtual note rows | CSS enforces 44px touch targets while the virtual list originally advanced only 32px per note, causing overlapping hitboxes | Measure live row height, including CSS minimum when an overscan row is offscreen; reflow on viewport/theme changes |
| Medium | Side preview live fidelity | A mounted side preview read a note only once from disk, ignoring unsaved changes in the active writer | Render the current editor draft for the same vault-owned path; reload inactive notes from disk |
| Medium | Asset-note destinations | Relative Markdown links encoded spaces but not URL delimiter characters (#, ?, %) in source filenames; generated links could target the wrong file | Encode each validated vault-relative path segment with URL component encoding and add roundtrip-oriented regression cases |
| Medium | Side preview Markdown styles | Side renderer omitted the shared `markdown-preview` class, bypassing common spacing/typography, list and table presentation | Apply the canonical Markdown class, supply source path and avoid a duplicated inner gutter |
| Low | Recent-note disambiguation | Long and duplicate titles had no full-path hint after clipping in the vault rail | Add complete path title and screen-reader label, with bidirectional text isolation |
| Blocking | Rust Clippy gate | Session validation test used field reassignment immediately after `Default`, which is denied under `-D warnings` | Initialize the test fixture through a complete struct literal without disabling the lint |
| Medium | RTL editor tabs | Arrow-key movement did not mirror visual direction for right-to-left layouts | Use the computed direction for arrow semantics and add browser coverage |
| Medium | Editable preview fidelity | Split/Preview exposed frontmatter source as prose and ordinary task brackets as plain text | Show revealable Properties; render GFM checkbox widgets while preserving extended task markers |
| Medium | Task keyboard usability | Replacing a task widget on toggle risks dropping keyboard focus or using stale offsets after edits | Reuse and update the existing widget DOM with current marker coordinates |
| Blocking | Frontend type check | TypeScript parameter properties violated `erasableSyntaxOnly` | Replace with explicit fields and constructor assignments |
| Blocking | Source-size governance | Extra navigation wiring pushed `src/App.tsx` to 1951 lines over its 1950-line ratchet | Restore compliance without increasing the ratchet |
| Blocking | Rust dependency audit | Locked `rustls 0.23.45` triggered `RUSTSEC-2026-0346`, `-0347`, `-0348`, `-0349` | Update `Cargo.lock` to registry-verified `rustls 0.23.46` checksum; CI audit must verify |

## Test/verification coverage added

- Playwright: short viewport dock scroll isolation and footer visibility; single note-tab owner; editor task/frontmatter controls; keyboard focus retained when toggling tasks; RTL tab arrows; a long filtered list re-clamped after shortening; restored active note remains visible; new-note navigation from a primary tool workspace.
- Playwright (added later in this PR): mobile vault hitbox non-overlap and responsive row reflow; previewing an active note updates on unsaved draft changes and uses standard Markdown presentation.
- Node source-contract tests: create-only writing and collision-safe numbered names; daily-note read failure does not overwrite an existing file.
- Existing coverage to re-run: workspace leaf lifecycle/guard tests, editor markup truth, preview resilience, focus/ARIA/contrast checks, mobile and 200% zoom geometry, generated screenshots.

## Audit areas sampled with existing safeguards

- Renderer HTML: the shared Markdown pipeline uses `rehype-sanitize`, then sanitizes postprocessed HTML again. The controlled capture snapshot runs in a sandboxed iframe.
- Native vault writes: the Rust save path uses an expected-content-hash compare-and-swap, including the absent-destination sentinel. New-note creation must use that sentinel unless explicitly replacing content.
- Persistence: leaf serialization restores inert references and checks availability before activation. The hydration boundary must coincide with a populated vault inventory.
- Frontend CI: repository guards include module-size ratchets, lint, contracts, browser E2E, visual screenshots, desktop compilation, Rust tests, and cargo-deny/npm audits.

## Residual risks / gates — not certified by this document

1. **Run the full latest-head CI** with `cargo --locked` and `cargo deny check`. A checksum-verified lockfile edit is not a substitute for resolving the graph on CI.
2. **Inspect rendered screenshots**, not only the existence of the workflow: vault and inspector scroll behavior at narrow/short sizes, mobile reflow, RTL, dark/light/high-contrast palettes, split panes and 200% zoom.
3. **Verify focus order and task activation with a real browser and assistive technology**. Source-level ARIA checks and Playwright improve confidence but are not an assistive-technology evaluation.
4. **Keep alternate note-entry workflows under regression.** Note factory operations call the editor hook directly; workspace composition now reconciles later active-path changes and has a browser case for creation while a tool occupies the primary pane. Verify there is no unwanted workspace activation during startup or leaf transitions.
5. **Large-app architecture remains a maintainability concern.** `src/App.tsx` is at the ratchet ceiling; future navigation integration should be extracted into dedicated controllers, rather than extending the monolithic root component.
6. **Review bots did not complete a substantive review.** CodeRabbit's repository auto-review was disabled and Qodo reported paused billing; use manual review and first-party test evidence rather than interpreting their status as approval.
7. **Repository scale and checkout efficiency need a separate measured optimization.** The source tree tracks 31,100 synthetic note fixtures across the 100/1k/5k/25k vaults. Their value for real scale testing is clear, but generator-based alternatives should be evaluated with checkout, CI and reproducibility benchmarks before removing or replacing them.
8. **Do not infer a green result from superseded runs.** Commits that change the preview and virtual-list behavior trigger fresh CI, visual and screenshot runs. Treat their latest-head state as pending until finished.

## Merge gate

Do not merge based on source inspection alone. Require a green *latest commit* check suite, passing visual evidence, no destructive note-creation regressions, and no active security advisories. A superseded or cancelled run does not satisfy these conditions.
