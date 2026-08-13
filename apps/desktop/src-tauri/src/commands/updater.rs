//! Auto-update commands.
//!
//! Channel semantics:
//!  - `lts`   → version has no pre-release segment  (e.g. `1.2.3`)
//!  - `beta`  → pre-release starts with `beta`       (e.g. `1.2.3-beta.1`)
//!  - `alpha` → pre-release starts with `alpha`      (e.g. `1.2.3-alpha.1`)
//!
//! Only `lts` builds surface update notifications to the end-user.
//! Beta / alpha builds can still call `updater_check` programmatically but the
//! frontend will ignore the result unless the user explicitly opts in.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

// ---------------------------------------------------------------------------
// Types exposed to the front-end
// ---------------------------------------------------------------------------

/// Which release channel this install belongs to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BuildChannel {
    Lts,
    Beta,
    Alpha,
    /// Unrecognised pre-release segment (treat as alpha for safety).
    Unknown,
}

/// Lightweight summary of a pending update.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub current_version: String,
    pub next_version: String,
    pub release_notes: Option<String>,
    pub channel: BuildChannel,
}

/// Result payload returned to the JS side.
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheckResult {
    /// An update is available.
    Available(PendingUpdate),
    /// Already on the latest version.
    UpToDate { version: String },
    /// Not a supported update channel (alpha/beta).
    ChannelSkipped {
        channel: BuildChannel,
        version: String,
    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Derive the channel from a SemVer version string.
///
/// ```ignore
/// assert_eq!(channel_from_version("1.2.3"),         BuildChannel::Lts);
/// assert_eq!(channel_from_version("1.2.3-beta.1"),  BuildChannel::Beta);
/// assert_eq!(channel_from_version("1.2.3-alpha.3"), BuildChannel::Alpha);
/// ```
/// See the `#[cfg(test)]` block at the bottom of this file for runnable tests.
fn channel_from_version(version: &str) -> BuildChannel {
    // SemVer pre-release is everything after the first `-`
    match version.split_once('-') {
        None => BuildChannel::Lts,
        Some((_, pre)) if pre.starts_with("beta") => BuildChannel::Beta,
        Some((_, pre)) if pre.starts_with("alpha") => BuildChannel::Alpha,
        Some(_) => BuildChannel::Unknown,
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Check whether a newer version is available on the update server.
///
/// - Always fetches the manifest; network is required.
/// - Returns `ChannelSkipped` if this build is alpha/beta, so the frontend
///   knows it can skip the banner without treating it as an error.
/// - Returns `Available` only when `next_version > current_version`.
#[tauri::command]
pub async fn updater_check(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current = app.package_info().version.to_string();
    let channel = channel_from_version(&current);

    if channel != BuildChannel::Lts {
        return Ok(UpdateCheckResult::ChannelSkipped {
            channel,
            version: current,
        });
    }

    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(UpdateCheckResult::Available(PendingUpdate {
            current_version: current,
            next_version: update.version.clone(),
            release_notes: update.body.clone(),
            channel,
        })),
        None => Ok(UpdateCheckResult::UpToDate { version: current }),
    }
}

/// Download and install the pending update.
///
/// Tauri will relaunch the app after installation on Windows/Linux.
/// On macOS the user is directed to the release page.
///
/// **Important**: this command deliberately has no return value beyond `Ok`.
/// The app process may be killed by the updater mid-call; the frontend should
/// show a "installing…" state and not await further results.
#[tauri::command]
pub async fn updater_install(app: AppHandle) -> Result<(), String> {
    let current = app.package_info().version.to_string();
    if channel_from_version(&current) != BuildChannel::Lts {
        return Err("Auto-install is only supported on LTS builds.".into());
    }

    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Unit tests (pure, no Tauri runtime)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lts_has_no_prerelease() {
        assert_eq!(channel_from_version("1.2.3"), BuildChannel::Lts);
        assert_eq!(channel_from_version("0.1.0"), BuildChannel::Lts);
        assert_eq!(channel_from_version("10.0.0"), BuildChannel::Lts);
    }

    #[test]
    fn beta_prefix_recognised() {
        assert_eq!(channel_from_version("1.2.3-beta.1"), BuildChannel::Beta);
        assert_eq!(channel_from_version("2.0.0-beta.42"), BuildChannel::Beta);
    }

    #[test]
    fn alpha_prefix_recognised() {
        assert_eq!(channel_from_version("1.0.0-alpha.1"), BuildChannel::Alpha);
        assert_eq!(channel_from_version("0.9.0-alpha.99"), BuildChannel::Alpha);
    }

    #[test]
    fn unknown_prerelease_is_safe() {
        assert_eq!(channel_from_version("1.0.0-rc.1"), BuildChannel::Unknown);
        assert_eq!(channel_from_version("1.0.0-nightly"), BuildChannel::Unknown);
    }
}
