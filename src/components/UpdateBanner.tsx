/**
 * UpdateBanner — shown at the bottom of the main window when an LTS update is
 * available.  Hidden entirely on beta/alpha builds.
 *
 * Renders nothing until `isLts && pendingUpdate !== null`.
 */

import React, { useState } from 'react';
import type { UseUpdaterResult } from '../hooks/useUpdater';

export interface UpdateBannerProps {
  updater: UseUpdaterResult;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ updater }) => {
  const { isLts, pendingUpdate, isInstalling, error, installUpdate, dismiss } = updater;
  const [showNotes, setShowNotes] = useState(false);

  // Only LTS builds surface the banner.
  if (!isLts || pendingUpdate === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="update-banner"
      data-testid="update-banner"
    >
      <div className="update-banner__content">
        <span className="update-banner__title">
          ✦ Scriptor {pendingUpdate.nextVersion} is available
        </span>
        <span className="update-banner__sub">
          You have {pendingUpdate.currentVersion}.
          {pendingUpdate.releaseNotes && (
            <button
              type="button"
              className="update-banner__notes-toggle"
              onClick={() => setShowNotes((p) => !p)}
            >
              {showNotes ? 'Hide notes' : "What\u2019s new?"}
            </button>
          )}
        </span>

        {showNotes && pendingUpdate.releaseNotes && (
          <pre className="update-banner__notes">
            {pendingUpdate.releaseNotes}
          </pre>
        )}

        {error && (
          <span className="update-banner__error" role="alert">
            {error}
          </span>
        )}
      </div>

      <div className="update-banner__actions">
        <button
          type="button"
          className="update-banner__btn update-banner__btn--install"
          disabled={isInstalling}
          onClick={() => void installUpdate()}
        >
          {isInstalling ? 'Installing…' : 'Install & restart'}
        </button>
        <button
          type="button"
          className="update-banner__btn update-banner__btn--dismiss"
          disabled={isInstalling}
          onClick={dismiss}
          aria-label="Dismiss update notification"
        >
          Later
        </button>
      </div>
    </div>
  );
};
