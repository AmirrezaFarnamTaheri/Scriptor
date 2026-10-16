# Scriptor UX friction audit and implementation map

Date: 2026-10-16. Scope: the desktop React/Tauri workspace, responsive shell,
Gmail, Drive/Docs, Calendar/Tasks, Overleaf, plugin discovery, and settings.
This is a review of current source and **checked-in screenshots**, not a
claim that the packaged app or live Google/Overleaf sessions were tested.

## Screenshot evidence

Reviewed `docs/assets/screenshots/workspace-light.png`,
`workspace-dark.png`, `workspace-tablet.png`, `workspace-mobile.png`,
`plugins.png`, `plugins-installed.png`, `settings.png`,
`settings-appearance.png`, `toolbar-insert.png`, and
`conflict-resolver.png`. These were compared with the actual React and CSS
components. Checked-in images are prior-state evidence, not new screenshots
from this change set.

## Confirmed problems addressed by this PR

| Surface | Friction in source/screenshots | Change |
| --- | --- | --- |
| Google connection | User had to register and paste a developer OAuth client ID before the browser sign-in button enabled | Production releases provide a public Scriptor Desktop OAuth client ID; legacy development clients remain optional |
| Gmail first use | Messages → Account → enter client ID → Connect → Messages | Messages empty state directly initiates the existing native Google OAuth flow; successful login returns to inbox |
| Google integrations | ID field and intimidating developer guidance dominated account connections | Account status and individual Connect buttons lead; advanced OAuth setup appears only for unconfigured development builds |
| Plugins | Plugin marketplace existed under Inspector → Tools → Plugins; color palettes had a top-bar path, runtime plugins did not | A top-bar Plugins control and a labeled mobile Plugins destination open the existing permission-aware plugin surface |
| Tablet vault rail | At small rail sizes the All notes/Inbox tabs and daily-note arrows stack into extra rows | Compact rail rules preserve one-row destinations with tooltips/accessible full titles |
| Appearance settings | Radius and backdrop-blur knobs pushed editor typography below the fold | Editor font size/family and line height precede a collapsed advanced visual/spacing group |
| Overleaf | Long Git-token and single-file limitations dominated the first step | Clear project/file and comparison steps, with full prerequisites in an expandable section |
| Google Docs | The legacy Docs revision transport was labeled as a generic opaque tunnel despite not being a live Docs editor | Clearly marked read-only legacy revision transport; Drive JSON remains the writable revision path |

## Product navigation recommendation

Current architecture should remain **writing-first**, with one canonical
action per destination. A future navigation consolidation could be:

- **Write:** notes, source files, preview and ordinary edit controls.
- **Find:** vault search, knowledge filters, backlinks and graph.
- **Connect:** service cards for Google, Overleaf, publishing destinations and
  future providers, showing signed-in account, scope, last successful sync,
  pending changes, errors, and an explicit disconnect option. Keep manual
  sync and review controls near the owning document.
- **Plugins:** installed, browse, permissions, updates, and safe mode in one
  dedicated surface. An inspector extension is the current implementation;
  a separate persistent panel should only be introduced if usage evidence
  shows that the inspector has become too crowded.
- **Publish:** export and reviewed sharing/deployment.
- **More:** advanced diagnostics, developer settings and less-frequent tools.

Do **not** duplicate permission models or add another parallel workspace
manager. All navigation should call the already-owned controllers.

## Further opportunities (not implemented or guaranteed here)

### Priority 1 — user journey and clarity

1. Unify remote-account presentation across Settings and document-specific
   actions: a consistent connected-account chip, service permissions,
   last-sync result, and a short recovery action.
2. Distinguish **connected**, **up-to-date**, **pending review**, **offline** and
   **needs reconnect**. An OAuth token is not evidence that a note has synced.
3. Surface one-click recoveries for expired credentials, missing Overleaf Git
   tokens, inaccessible Drive folders, and stale remote snapshots, without
   encouraging automatic overwrites.
4. Explain Gmail support limits (plain-text composition, bounded search and
   existing message operations). Do not describe it as a full Gmail clone.
5. Preserve separate Google service grants and the native authorization
   broker. No UI simplification justifies bypassing consent or storing a
   Google password.

### Priority 2 — screen and responsive refinements

1. Consolidate the crowded desktop top bar into primary writing controls,
   a single discoverable entry to optional tools and a restrained overflow
   menu. Avoid sacrificing command-palette keyboard parity.
2. Present global status as one short summary; move per-service technical
   badges and diagnostics into contextual disclosure.
3. Add two-stage empty states: a helpful primary action followed by optional
   learn-more links, not multi-paragraph documentation.
4. Review 320/375/768/1024/1440 widths, right-to-left layouts and 200% app
   zoom with actual rendered screenshots before editing golden snapshots.
5. Make long plugin permission lists scannable with clear `Review access`,
   `Enabled`, `Disabled` and `Reconnect` states, and preserve per-vault
   permission review.

### Priority 3 — architecture and reliability

1. Create a common read-only provider status contract (account ID, service,
   capability, freshness, last error) consumed by settings and overlays; keep
   write contracts provider-specific.
2. Add live-provider credential-expiry, account-switch and service-denial
   verification to the release checklist; browser mocks alone are not enough.
3. Avoid background conflict resolution without an explicit revision
   comparison and user approval.
4. Treat legacy opaque Google Docs revision records separately from Google
   Docs text-copy conversions. Neither is transparent bidirectional live
   document editing.
5. For Overleaf, document that exchange is currently for individual
   supported LaTeX/BibTeX source files and requires eligible Git access;
   project-wide sync remains out of scope.

## Acceptance and limitations

Source tests check packaged-client preference, legacy fallback, and absence of
invented credentials. Playwright specifications cover direct Gmail sign-in,
desktop and mobile Plugins navigation, appearance disclosure, and Overleaf
progressive help. Full branch CI/visual checks, native packaging and live
account tests are separate gates; list them by outcome rather than describing
them as passed in advance. The public production OAuth client ID must be
registered and configured before these desktop builds can ship.

## Extended product-wide visual and language review

This continuation also inspected all **nine checked-in September 24 contact
sheets** at `e2e/visual-review/2026-09-24/contact-sheets/sheet-01.png`
through `sheet-09.png`, which index **129 numbered visual states**. They
include desktop and responsive snapshots, dark/high-contrast and RTL surfaces,
dialogs, recovery flows, settings, plugin permissions, and advanced tools.
Screenshots document the earlier implementation; they do **not** establish
new live screenshots or a complete end-to-end test pass for the current PR.
The repository currently contains more than 150 frontend TSX components,
including shared shells and smaller widgets; this is an inventory-based review,
not a claim every reachable component state was manually exercised.

| Area / indexed screenshot states | Evidence-backed UX issue or risk | Current PR response / further gate |
| --- | --- | --- |
| Workspace, top bar and 320–200%-zoom views (025–030, 080–084, 120–128) | Compact layouts repeat a global command row despite bottom Command navigation; desktop chrome is dense | Removed duplicate mobile command search and localized mobile navigation; re-capture actual screens at 320, 375, 768, 1024 and 200% zoom |
| First-run guidance and help (016, 060–063, 088) | Seven explanatory steps interrupt entry into writing; help copy includes unnecessary technical terms | Three optional steps with Escape/Close/Skip; readable settings/help entry points; verify focus and exit paths |
| Empty editor, note tabs and editor recovery (004, 049–053, 082–084) | "Open another vault" appears even when a vault is already available; recovery labels need action-first copy | Empty editor now offers Find a note; toolbar/editor behavior and save/conflict protection remain unchanged |
| Note search, sidebar and inbox (065, 075, 114, 120–121) | Similar discovery actions are distributed among sidebar, command search, knowledge tools and templates | "Explore notes" is the consistent exploratory destination; searching keeps the original command and keyboard routes |
| Inspector, preview and status dock (007, 013, 023–024, 045–048, 067, 118–119) | Healthy state filled with eight mostly-zero tiles and could inaccurately report Good while other health checks fail | Healthy metrics collapse on demand; health badge now considers links, assets, titles, frontmatter, citations, slow exports and index freshness |
| Knowledge workbench, saved views, tags and repair (009, 070–074) | "Workbench", "triage", and "graph-assisted curation" are opaque starting points | Main destination is "Explore notes"; saved searches and repair actions use shorter, task-based labels. Preserve DQL as an advanced query format |
| Graph and layout controls (006, 058–059) | A three-note graph occupied a tiny region of a large blank stage | Sparse SVG graph views now frame the nodes to fill more of the stage while preserving node coordinates and link geometry; validate visual/keyboard behavior |
| Canvas, notes and drawing tools (001, 033–035, 111, 115) | Blank canvas first-open guidance and many formatting controls can compete for attention | Existing focused editor presets retained; targeted canvas placement guidance and zoom parity remain opportunities requiring fresh screenshots |
| Task list, planner and Kanban (023, 068–069, 113) | Board/task state and provider sync are easy to conflate | Simplified sync explanation but preserved review/approval boundary; test transitions across Notes, Calendar and task cards before further redesign |
| Reader and annotations (095–098) | Narrow reader and annotation controls consume much of the viewport | Scope identified; maintain annotation save/recovery guarantees. Responsive reader detail still needs fresh verification |
| Plugins, catalog, consent and installed modules (017–019, 032, 076–077) | Permission notices and long plugin lists obscure the action needed to start | Search installed and available plugins; no inert Enable button before consent; per-vault approval remains required |
| MCP permissions and sharing (010–012, 078–079) | Terms such as "authorization scope", "runtime", and "recipes" may conceal read/write consequences | Clearer permission-mode descriptions in all shipped locales; no relaxation of write-approval rules |
| Publishing, export and print preview (020, 092–093) | "dry run", "artifact" and "eligibility" phrasing competes with primary actions | Reworded export checks and eligibility guidance; real export output/preview validation remains a separate release gate |
| Gmail, Drive/Docs, Calendar/Tasks, Overleaf (057, 106 and workflow tests) | Account setup, privacy explanations and provider limitations could obscure Connect | Shared public Desktop OAuth identity for properly configured releases; shorter connection steps, optional privacy details and explicit legacy-Docs read-only limits |
| Git changes, conflict resolution and rename previews (003, 005, 044, 053–056, 099–100) | Destructive or remote operations require especially clear compare/review steps | Keep explicit diff, conflict, stale revision and approval flows. Avoid changes that would imply unreviewed overwrite |
| Appearance/theme builder (021–022, 042, 101–102, 105, 115) | Repeated adjectives and overly technical controls make an ordinary theme change look complex | "Create a color theme", "Preview", "Start from a theme" and shorter field names; keep existing contrast validation |
| Shortcut configuration and sidebar customization (008, 108, 116) | Tables are dense, but full labels and keyboard affordances are necessary | Preserved shortcut and customization functionality. Consider hiding rare settings behind a disclosure rather than removing them |
| Vault health, maintenance, backups and repairs (024, 101, 103, 107, 118–119) | Technical snapshot language makes a health check hard to interpret | "No problems found in the latest check"; the Good state now includes all current summary checks. Repair stays deliberate and reviewable |
| Portal, capture, templates and bibliography (031, 090–091, 094, 110, 114) | Multiple ways to create content can look like separate products | Preserve the existing task-specific destinations and favor a direct create/find action first |
| Support and writing-target tracking (112, 129) | Optional utilities should not interrupt writing | Kept out of mandatory onboarding; review their existing opt-in and shortcut discoverability before adding more chrome |

### Plain-language acceptance criteria

User-visible headings should describe an action or result, not an internal
component, transport, state machine or architectural subsystem. Prefer
**Explore notes**, **Check export settings**, **Find broken links**, and
**Save and use theme** over "Workbench", "artifact", "canonical", "runtime
surface", or stacked promotional adjectives. Keep established proper names
such as Git, MCP, Google OAuth, and Markdown where accuracy matters; place
their implementation details in optional Help/Advanced content. Always say
which vault/account is affected and whether an action reads, stages, changes,
sends, or deletes data. "Connected" must not imply "synced" or "saved".

The source-level `scripts/validation/plain-language-ui.test.mjs` enforces
consistency of prominent labels across English, German, and Persian, checks
translation placeholders, and detects selected regressions into internal-only
copy. It does not measure real-world language comprehension or replace
accessibility, screen-reader, browser, or provider testing.

### Verification boundaries

- New tests cover three-step onboarding, the mobile Command path, empty-note
  search, English/German/Persian mobile labels, the Drive information disclosure,
  plugin catalog search, concise health details, complete health scoring, and
  readable framing for sparse graph layouts.
- Review code-generated UI strings as well as locale dictionaries; a translated
  dictionary is not a guarantee that every third-party, backend, error, and
  legacy tool string is localized.
- Before merge, review current **branch-head** source tests, TypeScript,
  ESLint, browser UX, accessibility, visual snapshots, release smoke, and
  non-mocked Google/Overleaf flows. A successful earlier commit does not prove
  the current commit passes.
- Production Google sign-in still requires a real publisher-registered Google
  Desktop OAuth app and `SCRIPTOR_GOOGLE_OAUTH_CLIENT_ID`. The synthetic
  E2E client identity cannot authorize a public release.
- Preserve vault boundaries, remote conflict review, plugin consent, desktop
  credential storage, and explicitly approved writes. Faster UX must not
  silently broaden permissions.



## Additional plain-language and progressive-disclosure pass — 2026-10-17

A further repository inventory found **171 files under `src/components`**, 95
under `src/hooks`, 172 under `src/lib`, 65 under `src/styles`, and 35
checked-in PNG/JPEG/WebP screenshots under `docs/assets/screenshots`.
These counts include source-adjacent files and do not imply that every
component is a unique route or was interactively tested. The source and checked-in
screenshots provide breadth; current visual behavior must still be proven by
the branch-head browser and screenshot workflows.

| Area | Plain-language change | Important behavior intentionally retained |
| --- | --- | --- |
| Settings (General, Appearance, Integrations, Workspace) | Replace "workspace chrome", "vault configuration" and "desktop runtime" in everyday guidance with controls, settings and saved-state language | App preferences save immediately; vault settings still require an explicit Save |
| Empty editor and recovery | Describe picking a folder of notes and switching editor rather than abstract editor rendering | Opening/saving files and fallback editors behave as before |
| Note history and advanced analysis | "Browse saved versions", concise daily activity guidance; optional word-history graph is collapsed | Previous revisions, comparisons and deliberate restore confirmations remain |
| Sharing and sync | Found copies, Preview changes, Apply these changes; plan IDs and fingerprints moved to Technical details | Native authorization, expiry, inventory checks, per-operation warnings and reviewed writes remain |
| Google Drive/Docs | One clear read-only note for older Google Docs revisions, removed duplicated accessibility note | New revisions still use the supported Drive transport; no live Docs editing is implied |
| Google Planner/Tasks | "Review changes before syncing"; explain device-local times and separate Calendar/Tasks behavior | Existing account, event ownership, conflict and approval rules stay intact |
| Export & Publish | Describe file format, save location and offline PDF availability | Existing export profiles, preview, cancellation and actual compilation remain |
| Health checks and repairs | "Fix note issues", "Preview fix", user-readable file paths | Review checkbox, expected-vault identity, source-change checks and recovery receipts remain |
| Board and knowledge collections | Show the Create board action before advanced Markdown properties; explain collections as saved groups of notes | Board format, DQL search syntax and data storage are unchanged |
| Plugins, modules and permissions | Catalog search and direct navigation reduce discoverability burden | Plugin grants remain per vault; no enabled toggle without required consent |
| German and Persian support | Match common English wording and keep feature/action labels localized | Same route identifiers, keyboard navigation, and right-to-left support |

**Language acceptance rules:** Primary actions describe the result, not the
implementation. Error messages say what happened and the next safe action.
Technical identifiers, hashes, advanced metadata, and provider limitations
remain discoverable, but should not dominate first use. Do not hide a safety
warning, make an irreversible operation automatic, describe "connected" as
"synced", or promise a full Gmail/Docs/Overleaf client where only partial
features exist.

The existing `scripts/validation/plain-language-ui.test.mjs` now also
checks the revised settings, sync, history, repair, collection and board labels.
Browser tests still own focus, accessibility and interaction behavior; a
static text contract does not prove a screen is easy to use.

**Still to verify on the current head:** full source tests, all Playwright
flows, visual snapshots, RTL at 320–375 pixels and 200% zoom, live provider
authentication, and the publisher-owned Google OAuth configuration. A review of
stored screenshots is not a fresh interactive audit or a measured usability test.

## Deeper cross-module review and implementation — October 17 follow-up

In addition to the screen inventory above, source paths inspected individually
include `src/components/{AppTopBar,EditorWorkspace,StatusDockPanel,InspectorRail}`
and the implementations for Git, graph, canvas, tasks, planner, databases,
smart collections, saved views, source files, bibliography, snippets, capture,
assets, note history, backup, import, plugins, permissions, MCP, diagnostics,
settings, publishing and inline error handling. Component names are abbreviated
here; the actual canonical paths live under `src/components` and the
`app/`, `editor/`, `plugins/`, and `shell/` subdirectories.
This is a cross-module **source audit**, not proof that all internal states and
hundreds of combinations have been interactively exercised.

### Additional implemented fixes

| Journey | Root cause in existing UI | Improvement in this PR | Guardrail |
| --- | --- | --- | --- |
| Recover a note changed by another program | "Keep editing" silently set `saveOverwriteRef`; next save would overwrite external edits, while "Reload" discarded unsaved work immediately | Shared `ExternalChangeActions` clearly distinguishes disk and local versions and requires an explicit confirm for either destructive choice in both editor banner and diagnostics | Same editor persistence logic retained; E2E verifies Cancel and both confirmed actions |
| Resolve Git conflicts | "Ours", "Theirs" and "Ancestor" obscured which content would survive | "Current file", "Incoming file", "Earlier version", result preview and explicit bulk choices | Unresolved hunks still block applying; no automatic choice or force merge |
| Create/rename snippets | Auto-generated names depended on array length and could duplicate when entries were deleted; selected snippets were identified by mutable names, so clearing a field interrupted editing | Find an unused default name, case-insensitive duplicate checks, staged editable rename field, status and confirmation before closing unsaved changes | Validation at save; Native catalog contract unchanged; new helper and UI regressions |
| Restore or delete backups | Small adjacent generic buttons immediately invoked risky operations without identifying the chosen backup | Confirmations state selected name and consequences; accessible button names include the affected backup | Existing vault transaction, verified manifest, lifecycle and expected-scope guards remain authoritative |
| Import an Obsidian vault | Browsing for a folder required another explicit validation click | Selecting a folder starts read-only detection; stale validation replies are discarded when the source changes | Import still requires explicit submission; source vault is never modified |
| Find an existing file or asset | "Derived link index" and "inventory processing limit" appeared before the actual file list; zero results conflated no files and no matches | Clear file search and empty states; usage-count mechanics behind an optional help section | Unused-only filter still unavailable with partial index data |
| Create a collection from a search | Unexplained DQL and "saved presets" sounded like configuration rather than note search | "Rule for matching notes", example and "Save groups to this vault" | Search syntax and query semantics unchanged |
| Capture a web article | "Capture reviewer" and "source snapshot" led with implementation jargon | "Save a web article" and "Original page text" | Sandboxed offline HTML preview, review and deliberate save retained |
| Read templates and statistics | Cheat sheets, database totals and developer performance panels exposed terms intended for maintainers | "Diagram examples", "Totals for loaded notes", "Performance checks" | Underlying calculations and export commands untouched |
| Search within the daemon | "Daemon search" and "search hits" use process terminology instead of a task | "Search indexed notes", "Found N notes..." | Daemon command still invokes the same bounded read-only search |

### Cross-surface opportunities still open

* **Account and sync clarity.** Build a shared *read-only* status summary for
  Google, Overleaf and publication connections (account, last successful sync,
  pending changes, needs sign-in) without conflating authorization and syncing.
  Do not merge write authorities or automatically import remote revisions.
* **Dense technical panels.** MCP inventory, Git diagnostics, advanced file
  properties and backup system data should reveal technical details on demand,
  preserving command and scope transparency for power users.
* **Responsive continuity.** Visual evidence supports friction in top-bar and
  narrow inspector sizing, but a validated redesign requires fresh *current-PR*
  screenshots at 320/375/768/1024/1440 pixels, both appearances, 200% zoom,
  RTL and keyboard focus. Do not simply replace older images with assumed results.
* **Editor and reader continuity.** Verify early-exit, dirty file protection,
  selection focus and recovered notes across editor modes, reader annotations,
  Canvas, plan boards, bibliography and source editor.
* **Provider reality.** Live Google OAuth testing and Overleaf Git login must
  use registered application credentials and supported external accounts.
  Mock-driven CI cannot demonstrate production sign-in.

### Merge acceptance gates (current-HEAD only)

- Source and TypeScript tests, compilation, desktop smoke and workflow results
  must pass on **this head**, not on a superseded commit.
- Browser tests must verify the newly visible confirm actions and their Cancel
  paths, vault-scoped permissions, search and selected backups, not just text
  existence.
- Re-captured screenshot results should be inspected for clipping, overflow,
  text contrasts and reachable actions under zoom/RTL.
- Production builds require the publisher-owned Google Desktop OAuth client
  variable. Placeholder test identities cannot authorize users.
- No statement of "full live Google Docs editing", "full Gmail client" or
  entire Overleaf project synchronization is appropriate until those product
  capabilities actually exist.
