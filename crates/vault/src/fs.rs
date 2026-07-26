use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::Duration;

use crate::error::VaultError;

/// Write `bytes` to `path` atomically: temp file in the target directory, fsync, rename.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
    let parent = path
        .parent()
        .ok_or_else(|| VaultError::InvalidRelativePath(path.display().to_string()))?;

    let temp_name = format!(".scriptor-{}.tmp", uuid::Uuid::new_v4());
    let temp_path = parent.join(temp_name);

    {
        let mut file = fs::File::create(&temp_path).map_err(|source| VaultError::io(&temp_path, source))?;
        file.write_all(bytes)
            .map_err(|source| VaultError::io(&temp_path, source))?;
        file.sync_all()
            .map_err(|source| VaultError::io(&temp_path, source))?;
    }

    if let Err(source) = fs::rename(&temp_path, path) {
        let recovery = parent.join(format!(".scriptor-failed-{}.tmp", uuid::Uuid::new_v4()));
        let _ = fs::rename(&temp_path, &recovery);
        return Err(VaultError::io(path, source));
    }

    if let Some(parent) = path.parent()
        && let Ok(file) = fs::OpenOptions::new().read(true).open(parent) {
            let _ = file.sync_all();
        }

    Ok(())
}

/// Suffix used for transient in-progress temp files created during atomic writes.
pub const ATOMIC_TEMP_SUFFIX: &str = ".tmp";
/// Prefix shared by both in-progress and failed-write temp files.
const TEMP_PREFIX: &str = ".scriptor-";

/// Garbage-collect stale atomic-write temp files under `root` older than `max_age`.
///
/// Atomic writes create `.scriptor-<uuid>.tmp` files (in-progress) and, on rename
/// failure, `.scriptor-failed-<uuid>.tmp` recovery files. In-progress files are
/// normally renamed away on success, but a crash can leave them orphaned; failed
/// recovery files are never reclaimed on their own. This sweeps both kinds, but only
/// removes entries older than `max_age` to avoid clobbering a concurrent write.
///
/// Errors reading individual entries are swallowed (best-effort); only a failure to
/// read the directory itself is surfaced.
pub fn cleanup_stale_temp_files(root: &Path, max_age: Duration) -> Result<usize, VaultError> {
    let now = std::time::SystemTime::now();
    let mut removed = 0usize;

    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(source) => return Err(VaultError::io(root, source)),
    };

    for entry in entries.flatten() {
        let file_name_os = entry.file_name();
        let file_name = match file_name_os.to_str() {
            Some(name) => name,
            None => continue,
        };

        // Only touch our own temp files, never user content.
        if !file_name.starts_with(TEMP_PREFIX) || !file_name.ends_with(ATOMIC_TEMP_SUFFIX) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !metadata.is_file() {
            continue;
        }

        // Skip files that are still being written: require they be older than max_age.
        let modified = match metadata.modified() {
            Ok(time) => time,
            Err(_) => continue,
        };
        let age = match now.duration_since(modified) {
            Ok(age) => age,
            // Clock skew: treat as too fresh to touch.
            Err(_) => continue,
        };
        if age < max_age {
            continue;
        }

        // Failed-write recovery files (.scriptor-failed-<uuid>.tmp) and stale
        // in-progress files (.scriptor-<uuid>.tmp) are both safe to remove once
        // older than `max_age` — a concurrent writer still in flight would have
        // a fresh mtime and is skipped by the age check above.
        if fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::SystemTime;

    fn write_temp(dir: &Path, name: &str, age_secs: u64) {
        let path = dir.join(name);
        fs::File::create(&path)
            .unwrap()
            .write_all(b"stale")
            .unwrap();
        // Backdate the mtime so the file appears `age_secs` old.
        let backdated = SystemTime::now() - Duration::from_secs(age_secs);
        let _ = filetime::set_file_mtime(&path, filetime::FileTime::from_system_time(backdated));
    }

    #[test]
    fn cleanup_removes_only_stale_scriptor_temps() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        // Stale in-progress temp — should be removed.
        write_temp(root, ".scriptor-deadbeef.tmp", 60 * 60 * 48); // 2 days
        // Stale failed-recovery temp — should be removed.
        write_temp(root, ".scriptor-failed-cafe.tmp", 60 * 60 * 48);
        // Fresh in-progress temp (mimics a concurrent write) — must be kept.
        write_temp(root, ".scriptor-fresh.tmp", 5);
        // Unrelated user file — must be kept.
        write_temp(root, "note.md", 60 * 60 * 48);
        // Unrelated dotfile with .tmp suffix but wrong prefix — must be kept.
        write_temp(root, ".other.tmp", 60 * 60 * 48);

        let removed = cleanup_stale_temp_files(root, Duration::from_secs(60 * 60 * 24)).unwrap();
        assert_eq!(removed, 2);
        assert!(!root.join(".scriptor-deadbeef.tmp").exists());
        assert!(!root.join(".scriptor-failed-cafe.tmp").exists());
        assert!(root.join(".scriptor-fresh.tmp").exists());
        assert!(root.join("note.md").exists());
        assert!(root.join(".other.tmp").exists());
    }

    #[test]
    fn cleanup_missing_directory_is_an_error() {
        let bogus = Path::new("/does/not/exist/scriptor-test-cleanup");
        assert!(cleanup_stale_temp_files(bogus, Duration::from_secs(0)).is_err());
    }

    #[test]
    fn cleanup_empty_directory_removes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let removed = cleanup_stale_temp_files(dir.path(), Duration::from_secs(0)).unwrap();
        assert_eq!(removed, 0);
    }
}
