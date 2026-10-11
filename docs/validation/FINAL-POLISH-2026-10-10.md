# Final workflow polish and evidence review

This review inspected every paired image in the hosted workflow report for
`4f41ecd93a00ec1e7783eee29a956580bb25a958`: 74 states and 148 images.
The report is available from [the hosted workflow run](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37926636321).
Images were inspected individually, including narrow, RTL, dark, cancellation,
pending, conflict and failure states. Historical captures are diagnostic
evidence; they do not establish acceptance of a subsequent commit.

The replacement report for `7676ea60510b26d65efcc92de298bb5393b31a73`
was also reviewed individually: all 148 images in all 74 states. Media, runtime,
compiler results, and successful Overleaf close controls are now captured at
their asserted anchors. This review identified insufficient error-text contrast
in Gmail and shortcut storage failure. The current suite adds light/dark Gmail
contrast states, bringing its defined coverage to 76 states and 152 images.

## Coverage

| Surface | States | Images | Review result |
|---|---:|---:|---|
| Drive, Docs, Calendar and Tasks | 22 | 44 | Review and authorization boundaries visible; some detail captures contained blank space or omitted the selected control |
| Gmail | 16 | 32 | Literal content and retained drafts visible; English message direction, false citation diagnostics and failed-list empty copy needed repair |
| Assets | 3 | 6 | Invalid media recovery visible; valid media previews were omitted by panel-level capture framing |
| Overleaf | 3 | 6 | Missing panel padding and scrolling close control needed repair |
| Runtime | 7 | 14 | Pending/failure handling visible; live output, variables and plot captures needed corrected framing |
| Semantic inspector | 5 | 10 | Measured projection and result filtering visible; default button styling needed repair |
| Source files | 9 | 18 | Saved sources, disk conflict and discard decisions visible; compiler-result captures needed corrected framing |
| Workspace leaves | 4 | 8 | Retained drafts and inert restoration visible; restoration actions used default button styling |
| Workspace shortcuts | 5 | 10 | Names, sizes, pinning, overflow, ordering and storage failure visible |
| **Total** | **74** | **148** | **Complete diagnostic image inspection** |

## Repairs and regression protection

- Gmail content uses its own text direction. Recipient fields retain LTR;
  message and compose bodies choose direction from their content. Browser
  assertions cover English and Persian bodies inside an RTL interface.
- Frontend inline citation extraction rejects email addresses, URL handles and
  escaped at signs, matching the native indexer's token boundary. Behavioral
  checks retain real inline citations following punctuation.
- Citation boundaries inspect complete Unicode code points, including letters
  represented by surrogate pairs. The behavioral regression includes both
  mathematical script and Deseret letters next to literal at signs.
- Gmail and shortcut-storage errors use theme ink for readable text and a red
  inline-start severity marker. Hosted axe checks evaluate rendered alerts;
  Gmail covers both light and dark appearance.
- A Gmail provider failure no longer claims an empty search result. Recovery
  still produces the authoritative empty state after a successful search.
- Overleaf has a padded scrolling body with a persistent close header. Narrow
  stale-share and successful-share checks require the close control to remain
  wholly inside the viewport.
- Each screenshot state names its asserted content anchor. Viewport captures
  scroll local panel containers, and detail captures show that anchor rather
  than returning to the panel introduction. Editor loading must finish before
  capture; full anchor containment remains required.
- Semantic, planner-review and restored-workspace actions use themed controls.
  Timed event title and time lines fit their compact timeline blocks.
- Tools-menu opening waits for visible descendants before assigning initial
  focus. The bounded animation-frame retry stops after success, user focus
  movement or closing; the keyboard tests still require actual initial focus,
  End navigation, visible bounds and Escape restoration.
- Initial menu focus also waits until the activating key dispatch and its
  microtasks finish. A synchronous focus success can otherwise be undone by an
  editor's final trigger-focus restoration. The existing failing dispatch-order
  regression is now included in both full browser and workflow-state lanes.
- The planner lifecycle harness implements the layout effect used by the
  component. Its stale-account and post-unmount mutation assertions remain.

## Verification disposition

Commit `78549788dac8a8ffc06e5af408df3258f7556cf2` passed hosted Windows visual
regression, desktop compilation, documentation localization, Rust checks and
frontend/accessibility/TUI/daemon smoke. Its workflow suite passed 130 of 134:
three Tools-focus failures and an exact Gmail empty-state locator missing its
terminal period. Focus diagnostics showed both early attempts occurring while
the target descendant was hidden. The source suite passed 602 of 605; all three
failures were the missing layout-effect method in the planner harness.

Commit `7676ea60510b26d65efcc92de298bb5393b31a73` passed all 134 hosted
workflow cases, all 108 visual cases, all 605 source cases, zero-warning lint,
Rust checks, frontend/accessibility/TUI/daemon smoke, documentation localization,
and desktop compilation on Windows, macOS and Linux. The workflow report's
148 images were individually inspected. Its full browser lane was still running
at this evidence checkpoint. The contrast and supplementary-Unicode repairs
require their own subsequent hosted result; final status is recorded in PR checks.
No local
application, dependency install, executable test, build, lint, typecheck or
formatter was run. Passing fixture checks cannot establish live Google OAuth,
shared-drive membership, Overleaf account access or packaged-device behavior.
The four upstream maintenance advisories documented in
[the supply-chain assessment](SUPPLY-CHAIN-2026-10-04.md) remain unsuppressed and
block release. Provider and device acceptance remain separate evidence gates.

At `d3198f0d1eec07b5473e839e471be2fe649aa87f`, workflow review passed all
136 cases and visual review passed all 108. Source (605/605), zero-warning lint,
Rust, frontend/accessibility/TUI/daemon, three desktop targets and localization
passed. The report contains 76 complete pairs: 126 images match the preceding
individually reviewed report, and all 26 changed/added captures were inspected.
The full browser lane passed 462 of 463 plus all five mobile cases; its one
dispatch-order focus failure prompted the deferred-focus repair above.
That repair requires its own hosted result before acceptance.

The original reports and recovered scratchpad lineage remain indexed in
[the complete reread](REVIEW-REREAD-2026-10-01.md) and
[the scratchpad review](VISUAL-SCRATCHPAD-REVIEW-2026-10-02.md).
The complete Rust collection screening and supported Overleaf adaptation are
documented in [the boilerplate assessment](../architecture/RUST-BOILERPLATE-ASSESSMENT.md)
and [the Overleaf assessment](OVERLEAF_BOILERPLATE_ASSESSMENT.md).
