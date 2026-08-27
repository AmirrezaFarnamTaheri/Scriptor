# Visual review notes

The visual gallery of reviewed Windows baselines is the home for every screenshot this document discusses. The README's screenshot section, `docs/assets/screenshots/README.md`, and the checked-in PNGs under `docs/assets/screenshots/` are canonical; this page records the **reviewer narrative and discipline**, not a duplicate image dump.

## What the visual suite asserts

- Lazy-panel loading, topbar overflow, compact layouts, modal focus, and console/network cleanliness are asserted by the Playwright source suite and must be rerun from the frozen release candidate.
- Dark mode and the 1024 / 768 / 375px breakpoints are part of the matrix; the README's workspace pair and the responsive captures document the reviewed baselines.
- The reader, tasks, and kanban flows are exercised by the functional Playwright regression suite and captured as runtime evidence when their experimental surfaces are enabled.
- Recovery fallbacks, keyboard popovers, plugin management, and indexing readiness have specific captures linked from the gallery.

## Review discipline

- Any baseline change requires visual diff inspection and an explicit review note in the change packet.
- Stale snapshots are replaced only after a reviewer inspects the diff; visual failures are never hidden by raising the global tolerance.
- The Playwright source suite and the checked-in PNGs must agree; checked-in PNGs are documentation artifacts and are not release evidence by themselves. The exact commit, browser, viewport, and `pnpm test:visual` result remain authoritative.

## Cross-references

- README screenshot section — user-facing tour of the workspace, write, knowledge, visualize, automate, and operate/publish surfaces.
- `docs/assets/screenshots/README.md` — every checked-in PNG, its size, and the docs that reference it.
- `docs/RELEASE-CHECKLIST.md` — release-time visual gate items.
- `docs/VERIFICATION.md` — visual verification evidence trail.
