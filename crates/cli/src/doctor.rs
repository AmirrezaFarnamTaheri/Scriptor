//! Environment readiness probes behind `scriptor doctor`.
//!
//! Each probe is independent and failure-tolerant: a probe that cannot run
//! reports `ok = false` with a human-readable detail instead of aborting the
//! command, so a single broken tool never hides the rest of the diagnostics.

use std::path::Path;

use serde::Serialize;

/// Result of a single environment probe.
#[derive(Debug, Serialize)]
pub(crate) struct DoctorCheck {
    /// Stable identifier for the probe (grepable, no spaces).
    pub(crate) name: &'static str,
    /// Whether the probe passed.
    pub(crate) ok: bool,
    /// Whether a failure should fail the overall report.
    pub(crate) required: bool,
    /// Human-readable outcome detail.
    pub(crate) detail: String,
}

/// Aggregated readiness report.
#[derive(Debug, Serialize)]
pub(crate) struct DoctorReport {
    /// False when any required probe failed.
    pub(crate) healthy: bool,
    pub(crate) checks: Vec<DoctorCheck>,
}

fn check(name: &'static str, required: bool, outcome: Result<String, String>) -> DoctorCheck {
    match outcome {
        Ok(detail) => DoctorCheck {
            name,
            ok: true,
            required,
            detail,
        },
        Err(detail) => DoctorCheck {
            name,
            ok: false,
            required,
            detail,
        },
    }
}

fn probe_daemon_endpoint() -> Result<String, String> {
    match scriptor_daemon::read_endpoint() {
        Ok(endpoint) => Ok(format!("endpoint resolved: {endpoint:?}")),
        Err(error) => Err(format!("daemon endpoint unavailable: {error}")),
    }
}

fn probe_pandoc() -> Result<String, String> {
    match scriptor_export_runner::discover_pandoc() {
        Ok(discovery) => Ok(format!("pandoc discovery: {discovery:?}")),
        Err(error) => Err(format!("pandoc not discoverable: {error}")),
    }
}

fn probe_vault(path: Option<&Path>) -> Result<String, String> {
    let Some(path) = path else {
        return Ok("skipped: no vault path supplied".to_string());
    };
    let session =
        scriptor_vault::open_vault(path).map_err(|error| format!("vault not openable: {error}"))?;
    let root = session.root.root().to_path_buf();
    let probe = root.join(".scriptor-doctor-write-probe");
    std::fs::write(&probe, b"probe")
        .map_err(|error| format!("vault root not writable ({}): {error}", root.display()))?;
    let _ = std::fs::remove_file(&probe);
    Ok(format!("vault writable: {}", root.display()))
}

/// Run every probe and aggregate the results.
pub(crate) fn run(path: Option<&Path>) -> DoctorReport {
    let checks = vec![
        check("daemon_endpoint", false, probe_daemon_endpoint()),
        check("pandoc", false, probe_pandoc()),
        check("vault_writable", true, probe_vault(path)),
    ];
    let healthy = checks.iter().all(|entry| entry.ok || !entry.required);
    DoctorReport { healthy, checks }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_probe_is_skipped_without_a_path() {
        // Arrange / Act
        let outcome = probe_vault(None);

        // Assert
        assert!(outcome.expect("skip is not a failure").contains("skipped"));
    }

    #[test]
    fn report_stays_healthy_when_only_optional_probes_fail() {
        // Arrange
        let checks = [
            check("optional", false, Err("nope".to_string())),
            check("required", true, Ok("fine".to_string())),
        ];

        // Act
        let healthy = checks.iter().all(|entry| entry.ok || !entry.required);

        // Assert
        assert!(healthy);
    }

    #[test]
    fn report_is_unhealthy_when_a_required_probe_fails() {
        let checks = [check("required", true, Err("broken".to_string()))];
        assert!(!checks.iter().all(|entry| entry.ok || !entry.required));
    }

    #[test]
    fn vault_probe_reports_failure_for_a_missing_vault() {
        let outcome = probe_vault(Some(Path::new("/definitely/not/a/vault/path")));
        assert!(outcome.is_err());
    }
}
