# MAT-015 — expired Google credential recovery (focused slice)

**Branch:** `fix/mat015-google-expired-auth-recovery-20261101`  
**Issue:** [MAT-015 #195](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/195)  
**Scope:** Drive/Docs and Gmail credential status in Settings; no native authority or provider write changes.

## Problem and behavior

The native bridge can report `GOOGLE_AUTH_REQUIRED:` on account inspection or authorization. Previously `useGoogleIntegrationAccounts.check` treated that error as a generic disconnected account, silently dropping the native recovery explanation. An auth failure while reconnecting could retain a previously displayed account email as if it were still valid.

This change exposes `reconnect-required` separately from `disconnected` and transient `error`, retaining the native explanation while clearing the unverified account identity. Settings exposes the existing localized Reconnect action and a read-only Check connection route. Independent Drive/Gmail lanes, keychain ownership, OAuth scopes, and user consent remain unchanged.

A known email only establishes an observed credential account, **not** successful document transfer, up-to-date sync, or live-provider certification.

## Test-first and verification evidence

- Test-only commit: `b462bd824c58e301de914ff30aecae6edbc4b30f`. Regression cases specify reconnect-required state on account checks, stale identity clearance during OAuth retry, and a visible route in Settings. Behavioral RED is **not claimed** unless the hosted test-only run records it.
- Implementation: `src/hooks/useGoogleIntegrationAccounts.ts`, `src/components/GoogleIntegrationSettingsSection.tsx`.
- Focused test command: `node --test scripts/validation/google-integration-accounts.test.mjs`; source suite: `pnpm test:source`; then exact-head `pnpm lint`, `pnpm build`, CI, browser E2E, desktop/platform checks.
- Test execution, CI and installed OAuth/expired-token acceptance **pending** until linked to the actual final head.

## Acceptance still outstanding

MAT-015 also requires a single read-only Connections vocabulary across Calendar/Tasks, Overleaf, publishing and other supported providers; last successful transfer versus connected credentials; pending review; account switches, revoked scopes, offline/reconnect transitions; stale-response invalidation; keyboard/screen reader; and installed live-account evidence. This is not a capability graduation or permission expansion. Keep #195 open.
