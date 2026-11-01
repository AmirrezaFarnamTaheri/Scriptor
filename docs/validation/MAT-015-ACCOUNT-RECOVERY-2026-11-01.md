# MAT-015 — expired Google credential recovery (focused slice)

**Branch:** `fix/mat015-google-expired-auth-recovery-20261101`  
**Issue:** [MAT-015 #195](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/195)  
**Scope:** Drive/Docs, Gmail and Calendar/Tasks credential status in Settings; no native authority or provider write changes.

## Problem and behavior

The native bridge can report `GOOGLE_AUTH_REQUIRED:` on account inspection, authorization or refresh. Previously `useGoogleIntegrationAccounts.check` treated that error as a generic disconnected account, silently dropping the native recovery explanation. An auth failure while reconnecting could retain a previously displayed account email as if it were still valid. The Calendar/Tasks refresh also treated expired credentials as ordinary disconnection, and a failed OAuth reconnect could leave a stale account or cached remote items visible.

This change exposes `reconnect-required` separately from `disconnected` and transient `error`, retaining the native explanation while clearing unverified account identity and Calendar/Tasks remote caches. The native `GOOGLE_AUTH_REQUIRED:` prefix is also emitted for **missing** local credentials; the source classifier explicitly recognizes that fixed native not-connected message so first-time setup still says Disconnected rather than falsely asking users to reconnect. Settings exposes the existing localized Reconnect action and a read-only Check connection route for the account lanes. Independent Drive/Gmail/Calendar credential lanes, keychain ownership, OAuth scopes, and user consent remain unchanged.

A known email only establishes an observed credential account, **not** successful document transfer, up-to-date sync, or live-provider certification.

## Test-first and verification evidence

- Test-only commit: `b462bd824c58e301de914ff30aecae6edbc4b30f`. Regression cases specify reconnect-required state on account checks, stale identity clearance during OAuth retry, and a visible route in Settings. Behavioral RED is **not claimed** unless the hosted test-only run records it.
- Additional pure `googleAuthErrors.test.ts` and hook/Calendar missing-account tests distinguish a first-time disconnected account from expired/invalid credentials. Native error messages have no separate subtype yet, so exact native fixtures are intentional; a structured subtype remains future hardening.
- Added test-first Calendar cases in `scripts/validation/google-calendar-discovery-lifecycle.test.mjs` for credential expiry during refresh/OAuth and the Settings recovery route.
- Added deterministic browser workflows in `e2e/google-ecosystem-workflows.spec.ts` that simulate expired native Drive and Calendar credential results using the existing browser-only fixture, verify Settings and Task workspace present the localized reconnect explanation, and check no provider writes are attempted. This is fixture-based UI evidence, **not** live OAuth certification.
- `src/components/TaskPanel.tsx` now uses the existing translated Reconnect action label for `reconnect-required` instead of looking up a nonexistent `integrations.google.status.reconnect-required` key. A source assertion guards this rendering branch in `scripts/validation/google-calendar-discovery-lifecycle.test.mjs`.
- [Previously green head `e979d3f`](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41313811631) passed CI, browser E2E, Rust, contracts/lint, supply chain, frontend and container checks; visual, screenshot and localization runs passed separately. **These are prior-head results, not proof for the changes below.**
- Test-first `753217e` adds three cross-consumer auth-expiry cases: refresh rejection, OAuth rejection and truly missing credentials. `76f6570` adds a pending-task-response race regression. Both were committed before their respective implementations; **hosted failing-first evidence is not claimed unless the test-only run finished before cancellation**.
- Calendar hook now broadcasts read-only `reconnect-required`/`disconnected` account changes with an existing user-facing reason to all mounted consumers, invalidates their cached tasks/events, and suppresses immediate event-triggered credential retry loops (the existing periodic refresh schedule is unchanged). Native authority and OAuth consent remain unchanged.
- Credential rejection increments lifecycle and mutation generations so an in-flight provider task reply cannot repopulate a cache after native auth expires. This prevents UI ownership confusion; any already submitted provider mutation still requires review through native authority, not an automatic retry.
- Implementation: `src/hooks/useGoogleIntegrationAccounts.ts`, `src/hooks/useGoogleCalendarSync.ts`, `src/components/GoogleIntegrationSettingsSection.tsx`.
- Focused test command: `node --test scripts/validation/google-integration-accounts.test.mjs`; source suite: `pnpm test:source`; then exact-head `pnpm lint`, `pnpm build`, CI, browser E2E, desktop/platform checks.
- Latest-head hook/Playwright/CI and installed OAuth/expired-token acceptance **pending** until run results are linked to the final head; earlier green CI does not cover these cross-consumer changes.

## Acceptance still outstanding

MAT-015 also requires a single read-only Connections dashboard across Google, Overleaf, publishing and other supported providers; last successful transfer versus connected credentials; pending review; account switches, revoked scopes, offline/reconnect transitions; stale-response invalidation; keyboard/screen reader; and installed live-account evidence. This is not a capability graduation or permission expansion. Keep #195 open.
