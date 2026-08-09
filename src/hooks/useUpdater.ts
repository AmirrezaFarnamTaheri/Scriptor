/**
 * useUpdater — channel-aware auto-update hook for Scriptor desktop.
 *
 * Channel semantics (derived from the installed SemVer version):
 *   lts   → stable release, no pre-release segment  e.g. 1.2.3
 *   beta  → pre-release starts with "beta"           e.g. 1.2.3-beta.1
 *   alpha → pre-release starts with "alpha"          e.g. 1.2.3-alpha.1
 *
 * Only LTS builds show the update banner.  Beta/alpha can still call
 * `checkForUpdate()` programmatically but `isLts` will be false and
 * the banner component gates on that flag.
 */

import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauriRuntime } from '../bridge/platform';

// ---------------------------------------------------------------------------
// Types that mirror the Rust-side UpdateCheckResult / PendingUpdate
// ---------------------------------------------------------------------------

export type BuildChannel = 'lts' | 'beta' | 'alpha' | 'unknown';

export interface PendingUpdate {
  currentVersion: string;
  nextVersion: string;
  releaseNotes: string | null;
  channel: BuildChannel;
}

type UpdateCheckResult =
  | { status: 'available'; currentVersion: string; nextVersion: string; releaseNotes: string | null; channel: BuildChannel }
  | { status: 'upToDate'; version: string }
  | { status: 'channelSkipped'; channel: BuildChannel; version: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to wait between automatic background checks (ms). */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** sessionStorage key — cleared on next app launch, matching user expectation. */
const DISMISS_KEY = 'scriptor.updater.dismissed';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseUpdaterResult {
  /** Whether the current install is an LTS build. */
  isLts: boolean;
  /** True while checking or installing. */
  isLoading: boolean;
  /** A pending update, or null if none. */
  pendingUpdate: PendingUpdate | null;
  /** True while the install download is in progress. */
  isInstalling: boolean;
  /** Any error from the last check or install attempt. */
  error: string | null;
  /** Manually trigger an update check. */
  checkForUpdate: () => Promise<void>;
  /** Download and install the pending update. */
  installUpdate: () => Promise<void>;
  /** Dismiss the update banner for this session. */
  dismiss: () => void;
}

export function useUpdater(): UseUpdaterResult {
  // Whether the running install is LTS is purely a function of the version
  // baked into the Tauri manifest — no async call needed to determine it.
  // We read it once from the check result the first time we call.
  const [isLts, setIsLts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkForUpdate = useCallback(async () => {
    // Guard: the updater plugin is only available in the Tauri desktop runtime.
    if (!isTauriRuntime()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<UpdateCheckResult>('updater_check');

      if (result.status === 'channelSkipped') {
        setIsLts(false);
        return;
      }

      // Both 'available' and 'upToDate' responses come from LTS builds.
      setIsLts(true);

      if (result.status === 'available') {
        setPendingUpdate({
          currentVersion: result.currentVersion,
          nextVersion: result.nextVersion,
          releaseNotes: result.releaseNotes,
          channel: result.channel,
        });
      } else {
        setPendingUpdate(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!isTauriRuntime()) return;
    setIsInstalling(true);
    setError(null);
    try {
      await invoke('updater_install');
      // The app may be killed by the updater process; if we get here it
      // means something unusual happened (e.g. no update was found).
      setIsInstalling(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsInstalling(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }, []);

  // Stable ref so the interval callback always calls the latest version of
  // checkForUpdate without capturing a stale closure.
  const checkForUpdateRef = useRef(checkForUpdate);
  useEffect(() => {
    checkForUpdateRef.current = checkForUpdate;
  }, [checkForUpdate]);

  useEffect(() => {
    checkForUpdateRef.current().catch(() => { /* errors surfaced via setError */ });
    intervalRef.current = setInterval(() => {
      checkForUpdateRef.current().catch(() => { /* same */ });
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isLts,
    isLoading,
    pendingUpdate: dismissed ? null : pendingUpdate,
    isInstalling,
    error,
    checkForUpdate,
    installUpdate,
    dismiss,
  };
}
