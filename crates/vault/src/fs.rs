use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::Duration;

use fs4::fs_std::FileExt;

use crate::error::VaultError;

/// An exclusive, cross-process transaction lock for metadata files stored in a
/// vault. Keep this guard alive across a complete read-modify-write sequence;
/// the file is released automatically when the guard is dropped, including on
/// an error path or process exit.
pub struct VaultUpdateLock {
    _file: fs::File,
}

/// Locks a stable sidecar next to `target` without ever locking the target
/// itself (which is atomically replaced by writers). The sidecar intentionally
/// persists after release so that a new writer locks the same inode rather
/// than racing to recreate a deleted lock file.
pub fn lock_vault_update(target: &Path) -> Result<VaultUpdateLock, VaultError> {
    let parent = target
        .parent()
        .ok_or_else(|| VaultError::InvalidRelativePath(target.display().to_string()))?;
    fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;

    let name = target
        .file_name()
        .ok_or_else(|| VaultError::InvalidRelativePath(target.display().to_string()))?;
    let lock_path = parent.join(format!(".scriptor-{}.lock", name.to_string_lossy()));
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&lock_path)
        .map_err(|source| VaultError::io(&lock_path, source))?;
    file.lock_exclusive()
        .map_err(|source| VaultError::io(&lock_path, source))?;

    Ok(VaultUpdateLock { _file: file })
}

/// Write `bytes` to `path` atomically: temp file in the target directory, fsync, rename.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
    let parent = path
        .parent()
        .ok_or_else(|| VaultError::InvalidRelativePath(path.display().to_string()))?;

    let temp_name = format!(".scriptor-{}.tmp", uuid::Uuid::new_v4());
    let temp_path = parent.join(temp_name);

    let write_result = (|| -> Result<(), VaultError> {
        let mut file =
            fs::File::create(&temp_path).map_err(|source| VaultError::io(&temp_path, source))?;
        // `File::create` yields 0644 (minus umask), so replacing a note the user
        // had chmod'ed to 0600 would silently make it world-readable. Carry the
        // destination's own mode over to the replacement before it is exposed.
        inherit_destination_mode(path, &file)?;
        file.write_all(bytes)
            .map_err(|source| VaultError::io(&temp_path, source))?;
        file.sync_all()
            .map_err(|source| VaultError::io(&temp_path, source))?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    if let Err(source) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(VaultError::io(path, source));
    }

    sync_parent_directory(parent)?;
    Ok(())
}

/// Copies the destination file's permission bits onto the freshly created temp
/// file. A destination that does not exist yet keeps the platform default.
#[cfg(unix)]
fn inherit_destination_mode(destination: &Path, temp: &fs::File) -> Result<(), VaultError> {
    use std::os::unix::fs::PermissionsExt;

    let Ok(metadata) = fs::metadata(destination) else {
        return Ok(());
    };
    if !metadata.is_file() {
        return Ok(());
    }

    let mode = metadata.permissions().mode() & 0o7777;
    temp.set_permissions(fs::Permissions::from_mode(mode))
        .map_err(|source| VaultError::io(destination, source))
}

#[cfg(not(unix))]
fn inherit_destination_mode(_destination: &Path, _temp: &fs::File) -> Result<(), VaultError> {
    // Windows ACLs are inherited from the containing directory; there is no
    // portable mode to copy through std::fs.
    Ok(())
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) -> Result<(), VaultError> {
    let directory = fs::File::open(parent).map_err(|source| VaultError::io(parent, source))?;
    directory
        .sync_all()
        .map_err(|source| VaultError::io(parent, source))
}

#[cfg(not(unix))]
fn sync_parent_directory(_parent: &Path) -> Result<(), VaultError> {
    // Windows does not provide portable directory fsync semantics through std::fs.
    Ok(())
}

// ── Conflict sidecar (W1-3) ───────────────────────────────────────────────────

/// Write `conflict_content` (text containing `<<<<<<<` markers) as a
/// **sidecar file** named `<stem>.conflicted.md` alongside `original_path`.
///
/// # Derivation rules
/// | original | sidecar |
/// |---|---|
/// | `notes/foo.md` | `notes/foo.conflicted.md` |
/// | `archive/index.md` | `archive/index.conflicted.md` |
/// | `bare` (no extension) | `bare.conflicted.md` |
///
/// The sidecar is written atomically (temp-file + rename) via
/// [`atomic_write`]. If the sidecar already exists it is **overwritten**
/// (the user resolved and deleted it, then a new conflict was introduced).
///
/// # Errors
/// Returns [`VaultError`] when:
/// - `original_path` has no parent directory.
/// - `original_path` contains a `..` component.
/// - The underlying `atomic_write` fails.
pub fn write_conflicted_sidecar(
    original_path: &Path,
    conflict_content: &str,
) -> Result<std::path::PathBuf, VaultError> {
    // Safety: reject path traversal.
    if original_path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(VaultError::InvalidRelativePath(
            original_path.display().to_string(),
        ));
    }

    let parent = original_path
        .parent()
        .ok_or_else(|| VaultError::InvalidRelativePath(original_path.display().to_string()))?;

    // Build sidecar name: strip last extension, append ".conflicted.md".
    let stem = original_path
        .file_stem()
        .unwrap_or(original_path.as_os_str());
    let sidecar_name = format!("{}.conflicted.md", stem.to_string_lossy());
    let sidecar_path = parent.join(&sidecar_name);

    atomic_write(&sidecar_path, conflict_content.as_bytes())?;
    Ok(sidecar_path)
}

/// Suffix used for transient in-progress temp files created during atomic writes.
pub const ATOMIC_TEMP_SUFFIX: &str = ".tmp";
/// Prefix shared by both in-progress and failed-write temp files.
const TEMP_PREFIX: &str = ".scriptor-";

/// Garbage-collect stale atomic-write temp files under `root` older than `max_age`.
///
/// Atomic writes create `.scriptor-<uuid>.tmp` files *in the target's own
/// directory*, so this walks the whole tree: a crash while saving
/// `notes/2026/x.md` used to leave a temp file that a root-only sweep never
/// reclaimed. Hidden directories (including the internal `.scriptor` tree) are
/// pruned, matching the scan walker.
///
/// In-progress files are normally renamed away on success; this sweeps orphans
/// only after `max_age` to avoid clobbering a concurrent write.
///
/// Errors reading individual entries are swallowed (best-effort); only a failure to
/// read the root directory itself is surfaced.
pub fn cleanup_stale_temp_files(root: &Path, max_age: Duration) -> Result<usize, VaultError> {
    let now = std::time::SystemTime::now();
    let mut removed = 0usize;

    // Surface an unreadable root as an error; per-entry failures below stay
    // best-effort.
    fs::read_dir(root).map_err(|source| VaultError::io(root, source))?;

    let walker = walkdir::WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            if !entry.file_type().is_dir() {
                return true;
            }
            !entry.file_name().to_string_lossy().starts_with('.')
        });

    for entry in walker.flatten() {
        let file_name_os = entry.file_name().to_owned();
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
        let path = entry.path().to_path_buf();

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

        if fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::process::Command;
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
    fn atomic_write_replaces_content_without_leaving_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("note.md");
        fs::write(&target, b"old").unwrap();

        atomic_write(&target, b"new").unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"new");
        let leftovers = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().starts_with(TEMP_PREFIX))
            .count();
        assert_eq!(leftovers, 0);
    }

    const UPDATE_LOCK_TARGET_ENV: &str = "SCRIPTOR_VAULT_UPDATE_LOCK_TARGET";
    const UPDATE_LOCK_READY_ENV: &str = "SCRIPTOR_VAULT_UPDATE_LOCK_READY";

    #[test]
    fn update_lock_child_holds_the_lock() {
        let (Ok(target), Ok(ready)) = (
            std::env::var(UPDATE_LOCK_TARGET_ENV),
            std::env::var(UPDATE_LOCK_READY_ENV),
        ) else {
            return;
        };
        let _guard = lock_vault_update(Path::new(&target)).expect("child lock");
        fs::write(ready, "ready").expect("signal lock acquired");
        std::thread::sleep(Duration::from_millis(300));
    }

    #[test]
    fn update_lock_serializes_across_processes() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("state.json");
        let ready = dir.path().join("ready");
        // PROCESS_BROKER_EXCEPTION(vault-test-lock-child): test-only child process verifies OS advisory locking.
        let mut child = Command::new(std::env::current_exe().expect("test executable"))
            .args(["--exact", "fs::tests::update_lock_child_holds_the_lock"])
            .env(UPDATE_LOCK_TARGET_ENV, &target)
            .env(UPDATE_LOCK_READY_ENV, &ready)
            .spawn()
            .expect("start lock holder");

        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while !ready.exists() && std::time::Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(ready.exists(), "child did not acquire the update lock");

        let start = std::time::Instant::now();
        let _guard = lock_vault_update(&target).expect("parent lock");
        assert!(
            start.elapsed() >= Duration::from_millis(150),
            "parent must wait for the child process to release the update lock"
        );
        assert!(child.wait().expect("wait for lock holder").success());
    }

    #[test]
    fn cleanup_removes_only_stale_scriptor_temps() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        write_temp(root, ".scriptor-deadbeef.tmp", 60 * 60 * 48);
        write_temp(root, ".scriptor-failed-cafe.tmp", 60 * 60 * 48);
        write_temp(root, ".scriptor-fresh.tmp", 5);
        write_temp(root, "note.md", 60 * 60 * 48);
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
    fn cleanup_sweeps_nested_directories() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let nested = root.join("notes/2026");
        fs::create_dir_all(&nested).unwrap();

        write_temp(root, ".scriptor-root.tmp", 60 * 60 * 48);
        write_temp(&nested, ".scriptor-nested.tmp", 60 * 60 * 48);
        write_temp(&nested, ".scriptor-fresh.tmp", 5);
        write_temp(&nested, "x.md", 60 * 60 * 48);

        // Internal + hidden directories are pruned, like the scan walker.
        let internal = root.join(".scriptor/rename-txn");
        fs::create_dir_all(&internal).unwrap();
        write_temp(&internal, ".scriptor-internal.tmp", 60 * 60 * 48);

        let removed = cleanup_stale_temp_files(root, Duration::from_secs(60 * 60 * 24)).unwrap();
        assert_eq!(removed, 2);
        assert!(!root.join(".scriptor-root.tmp").exists());
        assert!(!nested.join(".scriptor-nested.tmp").exists());
        assert!(nested.join(".scriptor-fresh.tmp").exists());
        assert!(nested.join("x.md").exists());
        assert!(internal.join(".scriptor-internal.tmp").exists());
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_preserves_restrictive_destination_mode() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("private.md");
        fs::write(&target, b"secret").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600)).unwrap();

        atomic_write(&target, b"still secret").unwrap();

        let mode = fs::metadata(&target).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "expected 0600, found {mode:o}");
        assert_eq!(fs::read(&target).unwrap(), b"still secret");
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_preserves_executable_destination_mode() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("hook.sh");
        fs::write(&target, b"#!/bin/sh\n").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o750)).unwrap();

        atomic_write(&target, b"#!/bin/sh\necho hi\n").unwrap();

        let mode = fs::metadata(&target).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o750, "expected 0750, found {mode:o}");
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_to_new_path_uses_platform_default() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("fresh.md");
        atomic_write(&target, b"new").unwrap();

        let mode = fs::metadata(&target).unwrap().permissions().mode() & 0o777;
        // Whatever the umask yields, it must at least be owner-readable and not
        // something we invented.
        assert_ne!(mode & 0o400, 0);
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

    // ── write_conflicted_sidecar (W1-3) ──────────────────────────────────────

    #[test]
    fn conflicted_sidecar_written_alongside_original() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("notes").join("foo.md");
        std::fs::create_dir_all(original.parent().unwrap()).unwrap();
        std::fs::write(&original, "clean content").unwrap();

        let markers =
            "<<<<<<< ours\nour line\n||||||| base\nbase\n=======\ntheir line\n>>>>>>> theirs\n";
        let sidecar = write_conflicted_sidecar(&original, markers).unwrap();

        assert_eq!(sidecar, dir.path().join("notes").join("foo.conflicted.md"));
        assert_eq!(std::fs::read_to_string(&sidecar).unwrap(), markers);
        // Original must be untouched.
        assert_eq!(std::fs::read_to_string(&original).unwrap(), "clean content");
    }

    #[test]
    fn conflicted_sidecar_rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let evil = dir.path().join("..").join("escape.md");
        let result = write_conflicted_sidecar(&evil, "content");
        assert!(result.is_err(), "expected Err for path containing ..");
    }
}
