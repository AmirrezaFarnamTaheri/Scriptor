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
