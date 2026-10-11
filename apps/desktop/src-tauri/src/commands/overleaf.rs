//! Explicit, reviewed single-source-file synchronization through Overleaf's supported Git bridge.
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};
use scriptor_system_bridge::process::{ProcessSpec, run_process};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::Path, time::Duration};

const LIMIT: usize = 2 * 1024 * 1024;
#[derive(Clone, Debug, Serialize)]
pub struct OverleafSnapshot {
    head: String,
    content: Option<String>,
    content_hash: Option<String>,
}
fn validate(project: &str, path: &str) -> Result<(), String> {
    if !(6..=64).contains(&project.len())
        || !project
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("Invalid Overleaf Cloud project ID".into());
    }
    if path.len() > 1024
        || path.contains(['\\', ':', '%'])
        || path.chars().any(char::is_control)
        || path
            .split('/')
            .any(|p| p.is_empty() || p.starts_with('.') || p.ends_with(['.', ' ']))
        || !matches!(
            path.rsplit('.')
                .next()
                .unwrap_or("")
                .to_ascii_lowercase()
                .as_str(),
            "tex" | "ltx" | "bib"
        )
    {
        return Err("Overleaf sync requires a literal relative TeX or BibTeX file path".into());
    }
    Ok(())
}
fn hash(content: &str) -> String {
    Sha256::digest(content.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
fn git(root: &Path, args: &[&str], network: bool) -> Result<String, String> {
    let mut spec = ProcessSpec::new("git")
        .args([
            "-c",
            "core.hooksPath=disabled-scriptor-hooks",
            "-c",
            "core.autocrlf=false",
            "-c",
            "protocol.file.allow=never",
            "-c",
            "protocol.ext.allow=never",
            "-c",
            "http.followRedirects=false",
        ])
        .args(args.iter().copied())
        .current_dir(root)
        .timeout(Duration::from_secs(60))
        .max_output_bytes(LIMIT + 8192);
    if !network {
        // Remote attributes cannot call user-defined smudge/clean filters.
        spec = spec
            .env(
                "GIT_CONFIG_GLOBAL",
                if cfg!(windows) { "NUL" } else { "/dev/null" },
            )
            .env(
                "GIT_CONFIG_SYSTEM",
                if cfg!(windows) { "NUL" } else { "/dev/null" },
            );
    }
    let receipt = run_process(spec).map_err(|_| "Overleaf Git operation failed or exceeded its deadline. Configure the official Git token in your OS credential manager and confirm project Git access.".to_string())?;
    if receipt.exit_code != 0 || receipt.stdout_truncated || receipt.stderr_truncated {
        return Err("Overleaf Git operation was refused or exceeded its output limit. Check saved Git credentials, premium access and remote changes; no force push is attempted.".into());
    }
    Ok(receipt.stdout)
}
fn checkout(project: &str) -> Result<tempfile::TempDir, String> {
    let temp = tempfile::tempdir().map_err(|_| "Cannot create isolated Overleaf snapshot")?;
    let url = format!("https://git@git.overleaf.com/{project}");
    git(
        temp.path(),
        &[
            "clone",
            "--depth",
            "1",
            "--no-checkout",
            "--single-branch",
            "--",
            &url,
            "project",
        ],
        true,
    )?;
    git(&temp.path().join("project"), &["read-tree", "HEAD"], false)?;
    Ok(temp)
}
fn snapshot(root: &Path, path: &str) -> Result<OverleafSnapshot, String> {
    let head = git(root, &["rev-parse", "--verify", "HEAD"], false)?
        .trim()
        .to_string();
    if !head.bytes().all(|b| b.is_ascii_hexdigit()) || !matches!(head.len(), 40 | 64) {
        return Err("Invalid Overleaf remote revision".into());
    }
    let literal = format!(":(literal){path}");
    let tree = git(root, &["ls-tree", "-r", "HEAD", "--", &literal], false)?;
    if tree.trim().is_empty() {
        return Ok(OverleafSnapshot {
            head,
            content: None,
            content_hash: None,
        });
    }
    if tree.lines().count() != 1
        || !tree.starts_with("100644 blob ") && !tree.starts_with("100755 blob ")
    {
        return Err(
            "Overleaf source must be one regular file, without symbolic links or submodules".into(),
        );
    }
    let blob = format!("HEAD:{path}");
    let size: usize = git(root, &["cat-file", "-s", &blob], false)?
        .trim()
        .parse()
        .map_err(|_| "Invalid remote file size")?;
    if size > LIMIT {
        return Err("Overleaf source exceeds 2 MiB".into());
    }
    let object_id = tree
        .split_whitespace()
        .nth(2)
        .ok_or("Invalid remote source object")?;
    let content = git(root, &["cat-file", "blob", object_id], false)?;
    if content.len() > LIMIT || content.contains('\0') {
        return Err("Overleaf source exceeds 2 MiB or contains binary data".into());
    }
    // The process broker decodes output. Verify raw blob identity to reject
    // invalid UTF-8 replacement and preserve attributes-independent EOL.
    let mut checked =
        tempfile::NamedTempFile::new().map_err(|_| "Cannot verify remote source bytes")?;
    checked
        .write_all(content.as_bytes())
        .map_err(|_| "Cannot verify remote source bytes")?;
    let checked_path = checked
        .path()
        .to_str()
        .ok_or("Cannot encode temporary source path")?;
    if git(
        root,
        &["hash-object", "--no-filters", "--", checked_path],
        false,
    )?
    .trim()
        != object_id
    {
        return Err("Overleaf source must contain unchanged UTF-8 bytes".into());
    }
    Ok(OverleafSnapshot {
        head,
        content_hash: Some(hash(&content)),
        content: Some(content),
    })
}
fn push(
    root: &Path,
    path: &str,
    content: &str,
    expected_head: &str,
    expected_hash: Option<&str>,
) -> Result<OverleafSnapshot, String> {
    let before = snapshot(root, path)?;
    if before.head != expected_head || before.content_hash.as_deref() != expected_hash {
        return Err("Overleaf changed since review. Fetch a new preview before sharing; no files were pushed.".into());
    }
    if before.content.as_deref() == Some(content) {
        return Ok(before);
    }
    stage_reviewed_source(root, path, content)?;
    // Non-fast-forward rejection also protects advances after the fresh checkout.
    git(root, &["push", "origin", "HEAD"], true)?;
    snapshot(root, path)
}
fn stage_reviewed_source(root: &Path, path: &str, content: &str) -> Result<(), String> {
    // A no-checkout clone has no initialized index. Preserve the complete
    // remote tree before replacing the one reviewed source entry.
    git(root, &["read-tree", "HEAD"], false)?;
    let target = root.join(path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot stage source directory")?;
    }
    fs::write(&target, content).map_err(|_| "Cannot stage source")?;
    let literal = format!(":(literal){path}");
    let previous = git(root, &["ls-tree", "HEAD", "--", &literal], false)?;
    let mode = if previous.starts_with("100755 blob ") {
        "100755"
    } else {
        "100644"
    };
    // Stage exact bytes rather than Git's attribute-driven clean/EOL filters.
    let target_name = target.to_str().ok_or("Cannot encode staged source path")?;
    let object = git(
        root,
        &["hash-object", "-w", "--no-filters", "--", target_name],
        false,
    )?;
    git(
        root,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            mode,
            object.trim(),
            path,
        ],
        false,
    )?;
    git(
        root,
        &[
            "-c",
            "user.name=Scriptor",
            "-c",
            "user.email=scriptor@localhost",
            "-c",
            "commit.gpgSign=false",
            "commit",
            "-m",
            "Update reviewed source from Scriptor",
        ],
        false,
    )?;
    Ok(())
}
#[tauri::command]
pub async fn overleaf_read(
    state: tauri::State<'_, AppState>,
    project_id: String,
    path: String,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<OverleafSnapshot, String> {
    validate(&project_id, &path)?;
    {
        let session = active_session(&state)?;
        if session.descriptor.id != expected_vault_id {
            return Err("Vault changed; reopen Overleaf sync".into());
        }
        require_sensitive_operation(
            &state,
            &authorization_token,
            SensitiveOperation::GitPull,
            Some(&format!("overleaf:read:{project_id}:{path}")),
            Some(&expected_vault_id),
        )?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let temp = checkout(&project_id)?;
        snapshot(&temp.path().join("project"), &path)
    })
    .await
    .map_err(|_| "Overleaf snapshot worker failed")?
}
#[tauri::command]
// Flat Tauri wire arguments include broker context and both remote CAS values.
#[allow(clippy::too_many_arguments)]
pub async fn overleaf_push(
    state: tauri::State<'_, AppState>,
    project_id: String,
    path: String,
    content: String,
    expected_head: String,
    expected_remote_hash: Option<String>,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<OverleafSnapshot, String> {
    validate(&project_id, &path)?;
    if content.len() > LIMIT
        || content.contains('\0')
        || !matches!(expected_head.len(), 40 | 64)
        || !expected_head.bytes().all(|b| b.is_ascii_hexdigit())
        || expected_remote_hash
            .as_ref()
            .is_some_and(|h| h.len() != 64 || !h.bytes().all(|b| b.is_ascii_hexdigit()))
    {
        return Err("Invalid reviewed Overleaf source or revision".into());
    }
    {
        let session = active_session(&state)?;
        if session.descriptor.id != expected_vault_id {
            return Err("Vault changed; reopen Overleaf sync".into());
        }
        require_sensitive_operation(
            &state,
            &authorization_token,
            SensitiveOperation::GitPush,
            Some(&format!(
                "overleaf:push:{project_id}:{path}:{expected_head}"
            )),
            Some(&expected_vault_id),
        )?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let temp = checkout(&project_id)?;
        push(
            &temp.path().join("project"),
            &path,
            &content,
            &expected_head,
            expected_remote_hash.as_deref(),
        )
    })
    .await
    .map_err(|_| "Overleaf sharing worker failed")?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_credentials_paths_and_non_source_files() {
        assert!(validate("abcdef123456", "chapters/main.tex").is_ok());
        for project in ["https://evil.test", "token@host", "abc", "abcdef?x"] {
            assert!(validate(project, "main.tex").is_err());
        }
        for path in [
            "../main.tex",
            ".git/config",
            "a\\b.tex",
            "main.md",
            "a//b.tex",
        ] {
            assert!(validate("abcdef123456", path).is_err());
        }
    }
    #[test]
    fn snapshot_preserves_utf8_line_endings_and_rejects_stale_review_without_mutation() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        git(root, &["init"], false).unwrap();
        let text = "\\section{سلام}\r\nLiteral Markdown **kept**\r\n";
        fs::write(root.join("main.tex"), text).unwrap();
        git(root, &["add", "--", "main.tex"], false).unwrap();
        git(
            root,
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@localhost",
                "-c",
                "commit.gpgSign=false",
                "commit",
                "-m",
                "fixture",
            ],
            false,
        )
        .unwrap();
        let remote = snapshot(root, "main.tex").unwrap();
        assert_eq!(remote.content.as_deref(), Some(text));
        assert_eq!(remote.content_hash.as_deref(), Some(hash(text).as_str()));
        let error = push(
            root,
            "main.tex",
            "replacement",
            &"0".repeat(40),
            remote.content_hash.as_deref(),
        )
        .unwrap_err();
        assert!(error.contains("changed since review"));
        assert_eq!(fs::read_to_string(root.join("main.tex")).unwrap(), text);
        let absent = snapshot(root, "other.bib").unwrap();
        assert_eq!(absent.content, None);
        assert_eq!(absent.content_hash, None);
        // Remote attributes must not normalize an already committed CRLF blob.
        fs::write(root.join(".gitattributes"), "*.tex text eol=lf\n").unwrap();
        fs::write(root.join("invalid.tex"), [0xff, 0xfe, b'x']).unwrap();
        git(root, &["add", "--", ".gitattributes", "invalid.tex"], false).unwrap();
        git(
            root,
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@localhost",
                "-c",
                "commit.gpgSign=false",
                "commit",
                "-m",
                "attributes and invalid source",
            ],
            false,
        )
        .unwrap();
        assert_eq!(
            snapshot(root, "main.tex").unwrap().content.as_deref(),
            Some(text)
        );
        assert!(
            snapshot(root, "invalid.tex")
                .unwrap_err()
                .contains("unchanged UTF-8 bytes")
        );
        let reviewed_crlf = "Reviewed byte-preserved source\r\n";
        stage_reviewed_source(root, "main.tex", reviewed_crlf).unwrap();
        assert_eq!(
            snapshot(root, "main.tex").unwrap().content.as_deref(),
            Some(reviewed_crlf)
        );
    }
    #[test]
    fn selective_commit_initializes_empty_index_and_preserves_unselected_project_files() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        git(root, &["init"], false).unwrap();
        fs::write(root.join("main.tex"), "old selected source").unwrap();
        fs::write(root.join("references.bib"), "unchanged bibliography").unwrap();
        git(root, &["add", "--", "main.tex", "references.bib"], false).unwrap();
        git(
            root,
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@localhost",
                "-c",
                "commit.gpgSign=false",
                "commit",
                "-m",
                "fixture",
            ],
            false,
        )
        .unwrap();
        let sibling_before = git(root, &["rev-parse", "HEAD:references.bib"], false).unwrap();
        // Model --no-checkout: an empty index and absent unselected worktree file.
        git(root, &["read-tree", "--empty"], false).unwrap();
        fs::remove_file(root.join("references.bib")).unwrap();
        stage_reviewed_source(root, "main.tex", "reviewed selected source").unwrap();
        assert_eq!(
            git(root, &["rev-parse", "HEAD:references.bib"], false).unwrap(),
            sibling_before
        );
        assert_eq!(
            git(root, &["show", "HEAD:main.tex"], false).unwrap(),
            "reviewed selected source"
        );
        assert!(!root.join("references.bib").exists());
        assert_eq!(
            git(
                root,
                &["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
                false
            )
            .unwrap()
            .trim(),
            "main.tex"
        );
    }
}
