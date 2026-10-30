use std::fs;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::error::VaultError;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::write::save_note;

static EMBED_WIKILINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"!\[\[([^\]]+?)\]\]").expect("embed wikilink regex"));
static HIGHLIGHT_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"==(.+?)==").expect("highlight regex"));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportObsidianOptions {
    pub convert_wikilinks: bool,
    pub import_attachments: bool,
    pub preserve_frontmatter: bool,
}

impl Default for ImportObsidianOptions {
    fn default() -> Self {
        Self {
            convert_wikilinks: true,
            import_attachments: true,
            preserve_frontmatter: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub notes_imported: u32,
    pub attachments_imported: u32,
    pub skipped_files: u32,
    pub errors: Vec<String>,
    pub imported_paths: Vec<String>,
}

// Own a completed or partially written attachment staging file. On Windows,
// unlinking an open file can fail, so close its handle before removing it.
struct StagedAttachment {
    path: std::path::PathBuf,
    file: Option<fs::File>,
}
impl Drop for StagedAttachment {
    fn drop(&mut self) {
        drop(self.file.take());
        let _ = fs::remove_file(&self.path);
    }
}

const OBSIDIAN_DIR: &str = ".obsidian";

const ATTACHMENT_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "pdf", "mp3", "mp4", "wav", "ogg",
    "webm", "mov", "zip", "tar", "gz",
];

pub fn detect_obsidian_vault(path: &Path) -> bool {
    path.join(OBSIDIAN_DIR).is_dir()
}

pub fn import_obsidian_vault(
    vault_id: &str,
    root: &VaultRoot,
    obsidian_path: &Path,
    options: &ImportObsidianOptions,
) -> Result<ImportResult, VaultError> {
    if !detect_obsidian_vault(obsidian_path) {
        return Err(VaultError::InvalidConfig {
            message: format!(
                "Not an Obsidian vault (missing .obsidian/ directory): {}",
                obsidian_path.display()
            ),
        });
    }

    // The destination must not live inside the source tree: WalkDir could
    // otherwise discover new _attachments files while this import creates
    // them and repeatedly import the files it just wrote.
    let source_root = obsidian_path
        .canonicalize()
        .map_err(|error| VaultError::io(obsidian_path, error))?;
    if root.root().starts_with(&source_root) {
        return Err(VaultError::InvalidConfig {
            message: "The Scriptor destination is inside the Obsidian source folder; choose a separate destination to avoid importing generated files".into(),
        });
    }

    let mut notes_imported = 0u32;
    let mut attachments_imported = 0u32;
    let mut skipped_files = 0u32;
    let mut errors = Vec::new();
    let mut imported_paths = Vec::new();

    let attachments_dir = root.resolve_relative(&RelativeVaultPath::parse("_attachments")?)?;
    if options.import_attachments {
        fs::create_dir_all(&attachments_dir)
            .map_err(|source| VaultError::io(&attachments_dir, source))?;
    }

    for entry_result in WalkDir::new(obsidian_path).follow_links(false).into_iter() {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                skipped_files += 1;
                errors.push(format!("walk error: {error}"));
                continue;
            }
        };
        let absolute = entry.path();

        if absolute.starts_with(obsidian_path.join(OBSIDIAN_DIR)) {
            continue;
        }

        let relative = match absolute.strip_prefix(obsidian_path) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let relative_str = format_path(relative);

        if entry.file_type().is_dir() {
            continue;
        }
        // WalkDir does not descend into symlinks, but its iterator still
        // includes symlinked files. Do not import outside-source file contents
        // through them (or read from a FIFO/device by treating it as a file).
        if !entry.file_type().is_file() {
            skipped_files += 1;
            if entry.file_type().is_symlink() {
                errors.push(format!("{}: symbolic links are not imported", relative_str));
            }
            continue;
        }

        let extension = absolute
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension == "md" {
            match import_note(vault_id, root, obsidian_path, relative, options) {
                Ok(path) => {
                    notes_imported += 1;
                    imported_paths.push(path);
                }
                Err(VaultError::HashMismatch { expected, .. })
                    if expected == crate::write::EXPECTED_MISSING_CONTENT_HASH =>
                {
                    // The writer owns the atomic create-only check. An
                    // existing note must not be replaced by an import.
                    skipped_files += 1;
                    errors.push(format!(
                        "{}: destination note already exists; original content preserved",
                        relative_str
                    ));
                }
                Err(e) => {
                    errors.push(format!("{}: {}", relative_str, e));
                }
            }
        } else if options.import_attachments && is_attachment(&extension) {
            match import_attachment(root, obsidian_path, relative) {
                Ok(_) => {
                    attachments_imported += 1;
                }
                Err(VaultError::NoteExists(_)) => {
                    skipped_files += 1;
                    errors.push(format!(
                        "{}: destination attachment already exists; original content preserved",
                        relative_str
                    ));
                }
                Err(e) => {
                    errors.push(format!("{}: {}", relative_str, e));
                }
            }
        } else {
            skipped_files += 1;
        }
    }

    Ok(ImportResult {
        notes_imported,
        attachments_imported,
        skipped_files,
        errors,
        imported_paths,
    })
}

fn import_note(
    vault_id: &str,
    root: &VaultRoot,
    obsidian_root: &Path,
    relative: &Path,
    options: &ImportObsidianOptions,
) -> Result<String, VaultError> {
    let source_path = obsidian_root.join(relative);
    let mut markdown =
        fs::read_to_string(&source_path).map_err(|source| VaultError::io(&source_path, source))?;

    if !options.preserve_frontmatter {
        markdown = strip_frontmatter(&markdown);
    }

    if options.convert_wikilinks {
        markdown = convert_obsidian_syntax(&markdown);
    }

    let target_rel = format_path(relative);
    let target = RelativeVaultPath::parse(&target_rel)?;

    // Use the vault writer's atomic create-only CAS; checking path.exists()
    // first would race another editor or import writing the same destination.
    save_note(
        vault_id,
        root,
        &target,
        &markdown,
        Some(crate::write::EXPECTED_MISSING_CONTENT_HASH),
    )?;
    Ok(target_rel)
}

fn import_attachment(
    root: &VaultRoot,
    obsidian_root: &Path,
    relative: &Path,
) -> Result<(), VaultError> {
    let source = obsidian_root.join(relative);
    // WalkDir's original file type is checked by the caller. Recheck at the
    // read boundary in case an outside process replaced the entry.
    let source_type = fs::symlink_metadata(&source)
        .map_err(|error| VaultError::io(&source, error))?
        .file_type();
    if !source_type.is_file() {
        return Err(VaultError::InvalidConfig {
            message: "Obsidian attachment is no longer a regular file".into(),
        });
    }
    let relative_str = format_path(relative);
    let destination_relative = RelativeVaultPath::parse(&format!("_attachments/{relative_str}"))?;
    let destination = root.resolve_relative(&destination_relative)?;
    let parent = destination
        .parent()
        .ok_or_else(|| VaultError::InvalidConfig {
            message: "Cannot determine attachment directory".into(),
        })?;
    fs::create_dir_all(parent).map_err(|error| VaultError::io(parent, error))?;

    // Validate every newly created prefix; joining a separately verified
    // _attachments directory would permit nested symlinks to escape the vault.
    let destination = root.resolve_relative(&destination_relative)?;
    let parent = destination
        .parent()
        .ok_or_else(|| VaultError::InvalidConfig {
            message: "Cannot determine attachment directory".into(),
        })?;
    // A quick duplicate check avoids copying large files on repeated imports.
    // It is not an authority: hard-link publication below is still create-only.
    match fs::symlink_metadata(&destination) {
        Ok(_) => return Err(VaultError::NoteExists(destination_relative.to_string())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(VaultError::io(&destination, error)),
    }

    // Build an entire attachment in the final directory before making it
    // visible. The existing PDF export uses the same atomic hard-link publish
    // pattern: rename or fs::copy at the final path could replace a new file.
    let staging = parent.join(format!(".scriptor-{}.tmp", uuid::Uuid::new_v4()));
    let mut source_file =
        fs::File::open(&source).map_err(|error| VaultError::io(&source, error))?;
    let staging_file = crate::fs::create_private_file(&staging)?;
    // Arm cleanup only after we exclusively own the staging path. The guard
    // also owns the handle so error-path cleanup works on Windows.
    let mut staged = StagedAttachment {
        path: staging.clone(),
        file: Some(staging_file),
    };
    std::io::copy(
        &mut source_file,
        staged.file.as_mut().expect("staging file is open"),
    )
    .map_err(|error| VaultError::io(&staging, error))?;
    staged
        .file
        .as_ref()
        .expect("staging file is open")
        .sync_all()
        .map_err(|error| VaultError::io(&staging, error))?;
    drop(staged.file.take());

    // Serialize publication against other Scriptor mutations, while keeping
    // the potentially long copy outside that lock.
    let _lock = crate::fs::lock_vault_mutation(root.root())?;
    if root.root().join(".scriptor/rename-txn.json").is_file() {
        return Err(VaultError::InvalidConfig {
            message: "Vault rename transaction is pending; retry import after recovery".into(),
        });
    }
    let publish_path = root.resolve_relative(&destination_relative)?;
    if publish_path.parent() != Some(parent) {
        return Err(VaultError::InvalidConfig {
            message: "Attachment directory changed during import; no file published".into(),
        });
    }
    fs::hard_link(&staging, &publish_path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            VaultError::NoteExists(destination_relative.to_string())
        } else {
            VaultError::io(&publish_path, error)
        }
    })?;
    // Content and publication are complete; cleanup removes only our staging
    // path. An interrupted pre-publication copy can never expose partial data.
    #[cfg(unix)]
    if let Err(error) = fs::File::open(parent).and_then(|directory| directory.sync_all()) {
        tracing::warn!(
            target: "scriptor_vault::importers::obsidian",
            %error,
            path = %publish_path.display(),
            "attachment is published but directory durability sync failed"
        );
    }
    Ok(())
}

fn convert_obsidian_syntax(markdown: &str) -> String {
    let mut result = markdown.to_string();

    result = convert_embed_wikilinks(&result);
    result = convert_highlights(&result);
    result = convert_callouts(&result);
    result = convert_wikilinks(&result);

    result
}

fn embed_target_is_attachment(target: &str) -> bool {
    let link_target = target
        .split('|')
        .next()
        .unwrap_or(target)
        .split('#')
        .next()
        .unwrap_or(target)
        .trim();
    let extension = Path::new(link_target)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase);
    extension.as_deref().is_some_and(is_attachment)
}

fn convert_embed_wikilinks(markdown: &str) -> String {
    EMBED_WIKILINK_RE
        .replace_all(markdown, |caps: &regex::Captures| {
            let target = &caps[1];
            if embed_target_is_attachment(target) {
                // Binary Obsidian embeds are copied into Scriptor's attachment
                // store but are not note transclusions. Keep the existing
                // compatibility form until the renderer has an attachment
                // resolver that can safely rewrite source-relative links.
                format!("[[{target}]]")
            } else {
                // Scriptor natively supports note transclusions, including
                // heading fragments and aliases. Preserve the authored embed
                // byte-for-byte instead of flattening it into an ordinary link.
                caps.get(0)
                    .map(|matched| matched.as_str().to_string())
                    .unwrap_or_else(|| format!("![[{target}]]"))
            }
        })
        .into_owned()
}

fn convert_wikilinks(markdown: &str) -> String {
    // Scriptor natively supports Obsidian-style wikilinks. Preserve their
    // target text verbatim so folder disambiguation and heading fragments keep
    // resolving after import.
    markdown.to_string()
}

fn convert_highlights(markdown: &str) -> String {
    HIGHLIGHT_RE
        .replace_all(markdown, "<mark>$1</mark>")
        .into_owned()
}

fn convert_callouts(markdown: &str) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < lines.len() {
        let trimmed = lines[i].trim_start();
        if let Some(rest) = trimmed.strip_prefix("> [!")
            && let Some(close) = rest.find(']')
        {
            let callout_type = &rest[..close];
            let after = rest[close + 1..].trim();
            let gfm_type = match callout_type.to_lowercase().as_str() {
                "note" => "NOTE",
                "tip" | "hint" => "TIP",
                "important" => "IMPORTANT",
                "warning" | "caution" => "WARNING",
                "danger" | "error" => "CAUTION",
                _ => "NOTE",
            };
            if after.is_empty() {
                result.push_str(&format!("> [!{gfm_type}]"));
            } else {
                result.push_str(&format!("> [!{gfm_type}] {after}"));
            }
            i += 1;
            while i < lines.len() {
                let continuation = lines[i].trim_start();
                if continuation.starts_with("> ") {
                    result.push('\n');
                    result.push_str(lines[i]);
                    i += 1;
                } else {
                    break;
                }
            }
        } else {
            result.push_str(lines[i]);
            i += 1;
        }
        if i < lines.len() {
            result.push('\n');
        }
    }

    result
}

fn strip_frontmatter(markdown: &str) -> String {
    if markdown.starts_with("---")
        && let Some(end) = markdown[3..].find("\n---")
    {
        let after = &markdown[end + 7..];
        return after.trim_start_matches('\n').to_string();
    }
    markdown.to_string()
}

fn format_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            std::path::Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn is_attachment(extension: &str) -> bool {
    ATTACHMENT_EXTENSIONS.contains(&extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_attachment_staging_cleanup_closes_handle_before_removal() {
        use std::io::Write;

        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(".scriptor-partial.tmp");
        let file = crate::fs::create_private_file(&path).unwrap();
        let mut staged = StagedAttachment {
            path: path.clone(),
            file: Some(file),
        };
        staged
            .file
            .as_mut()
            .unwrap()
            .write_all(b"incomplete asset")
            .unwrap();
        drop(staged);
        assert!(
            !path.exists(),
            "staging must be removed even after an incomplete write"
        );
    }

    #[cfg(unix)]
    #[test]
    fn import_does_not_follow_source_attachment_symlinks() {
        use std::os::unix::fs::symlink;

        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        let external = tempfile::tempdir().unwrap();
        let outside_image = external.path().join("private.png");
        fs::write(&outside_image, b"outside-vault-data").unwrap();
        symlink(&outside_image, source.path().join("linked.png")).unwrap();

        let target = tempfile::tempdir().unwrap();
        let root = VaultRoot::open(target.path()).unwrap();
        let result = import_obsidian_vault(
            "test-vault",
            &root,
            source.path(),
            &ImportObsidianOptions::default(),
        )
        .unwrap();

        assert_eq!(result.attachments_imported, 0);
        assert_eq!(result.skipped_files, 1);
        assert!(
            !target.path().join("_attachments/linked.png").exists(),
            "an import must not copy an external file through a source symlink"
        );
    }

    #[cfg(unix)]
    #[test]
    fn import_does_not_escape_through_nested_attachment_destination_symlink() {
        use std::os::unix::fs::symlink;

        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        fs::create_dir_all(source.path().join("assets")).unwrap();
        fs::write(source.path().join("assets/photo.png"), b"picture").unwrap();

        let target = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(target.path().join("_attachments")).unwrap();
        symlink(outside.path(), target.path().join("_attachments/assets")).unwrap();
        let root = VaultRoot::open(target.path()).unwrap();
        let result = import_obsidian_vault(
            "test-vault",
            &root,
            source.path(),
            &ImportObsidianOptions::default(),
        )
        .unwrap();

        assert_eq!(result.attachments_imported, 0);
        assert!(
            !outside.path().join("photo.png").exists(),
            "importing a nested attachment must not write through a symlink outside the target vault"
        );
        assert!(
            result
                .errors
                .iter()
                .any(|message| message.contains("assets/photo.png")),
            "the rejected attachment must appear in the import error details"
        );
    }

    #[test]
    fn importer_rejects_its_own_source_as_destination_without_side_effects() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        let root = VaultRoot::open(source.path()).unwrap();

        let error = import_obsidian_vault(
            "test-vault",
            &root,
            source.path(),
            &ImportObsidianOptions::default(),
        )
        .expect_err("source and destination must not overlap");
        assert!(error.to_string().contains("inside the Obsidian source"));
        assert!(
            !source.path().join("_attachments").exists(),
            "refuse the import before creating destination files"
        );
    }

    #[test]
    fn importer_rejects_target_nested_in_source_before_writing() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        let target_path = source.path().join("scriptor-target");
        fs::create_dir_all(&target_path).unwrap();
        let root = VaultRoot::open(&target_path).unwrap();

        let error = import_obsidian_vault(
            "test-vault",
            &root,
            source.path(),
            &ImportObsidianOptions::default(),
        )
        .expect_err("destination within source must be rejected");
        assert!(error.to_string().contains("inside the Obsidian source"));
        assert!(!target_path.join("_attachments").exists());
    }

    #[test]
    fn repeated_attachment_import_preserves_edits_and_leaves_no_staging_file() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        fs::create_dir_all(source.path().join("assets")).unwrap();
        fs::write(source.path().join("assets/diagram.png"), b"original import").unwrap();

        let destination = tempfile::tempdir().unwrap();
        let root = VaultRoot::open(destination.path()).unwrap();
        let options = ImportObsidianOptions::default();

        let first = import_obsidian_vault("test-vault", &root, source.path(), &options).unwrap();
        assert_eq!(first.attachments_imported, 1);
        assert!(first.errors.is_empty());

        let imported = destination.path().join("_attachments/assets/diagram.png");
        fs::write(&imported, b"local edits after import").unwrap();
        let second = import_obsidian_vault("test-vault", &root, source.path(), &options).unwrap();

        assert_eq!(second.attachments_imported, 0);
        assert_eq!(second.skipped_files, 1);
        assert_eq!(
            fs::read(&imported).unwrap(),
            b"local edits after import",
            "a repeated import cannot replace an edited attachment"
        );
        assert!(
            second.errors.iter().any(|error| {
                error.contains("assets/diagram.png") && error.contains("already exists")
            }),
            "an attachment collision must be visible in the import report: {:?}",
            second.errors
        );
        for entry in fs::read_dir(imported.parent().unwrap()).unwrap() {
            let entry = entry.unwrap();
            assert!(
                !entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".scriptor-"),
                "completed or rejected imports must clean temporary attachment files"
            );
        }
    }

    #[test]
    fn test_detect_obsidian_vault() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(!detect_obsidian_vault(tmp.path()));
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        assert!(detect_obsidian_vault(tmp.path()));
    }

    #[test]
    fn test_convert_embed_wikilinks() {
        let input = "![[My Note]]";
        assert_eq!(convert_embed_wikilinks(input), "![[My Note]]");
    }

    #[test]
    fn test_convert_embed_wikilinks_with_heading() {
        let input = "![[My Note#Section]]";
        assert_eq!(convert_embed_wikilinks(input), "![[My Note#Section]]");
    }

    #[test]
    fn test_convert_embed_wikilinks_with_heading_and_alias() {
        let input = "![[folder/My Note#Section|Readable label]]";
        assert_eq!(
            convert_embed_wikilinks(input),
            "![[folder/My Note#Section|Readable label]]"
        );
    }

    #[test]
    fn test_convert_highlights() {
        let input = "This is ==highlighted== text";
        assert_eq!(
            convert_highlights(input),
            "This is <mark>highlighted</mark> text"
        );
    }

    #[test]
    fn test_convert_callouts() {
        let input = "> [!note] Important info";
        assert_eq!(convert_callouts(input), "> [!NOTE] Important info");
    }

    #[test]
    fn test_convert_callouts_danger() {
        let input = "> [!danger]\n> Be careful";
        assert_eq!(convert_callouts(input), "> [!CAUTION]\n> Be careful");
    }

    #[test]
    fn test_convert_wikilinks_simple() {
        let input = "[[My Note]]";
        assert_eq!(convert_wikilinks(input), "[[My Note]]");
    }

    #[test]
    fn test_convert_wikilinks_with_alias() {
        let input = "[[My Note|Custom Label]]";
        assert_eq!(convert_wikilinks(input), "[[My Note|Custom Label]]");
    }

    #[test]
    fn test_strip_frontmatter() {
        let input = "---\ntitle: Test\ntags: [a, b]\n---\n\nBody";
        assert_eq!(strip_frontmatter(input), "Body");
    }

    #[test]
    fn test_strip_frontmatter_none() {
        let input = "No frontmatter here";
        assert_eq!(strip_frontmatter(input), "No frontmatter here");
    }

    #[test]
    fn test_is_attachment() {
        assert!(is_attachment("png"));
        assert!(is_attachment("pdf"));
        assert!(!is_attachment("md"));
        assert!(!is_attachment("rs"));
    }

    #[test]
    fn test_convert_obsidian_syntax_full() {
        let input = "See ==important== note.\n\n> [!tip] Quick tip\n\nLink to [[Other Note|here]]";
        let result = convert_obsidian_syntax(input);
        assert!(result.contains("<mark>important</mark>"));
        assert!(result.contains("> [!TIP] Quick tip"));
        assert!(result.contains("[[Other Note|here]]"));
    }

    #[test]
    fn test_convert_multiple_highlights() {
        let input = "==first== and ==second== and ==third==";
        let result = convert_highlights(input);
        assert_eq!(
            result,
            "<mark>first</mark> and <mark>second</mark> and <mark>third</mark>"
        );
    }

    #[test]
    fn test_convert_callouts_warning() {
        let input = "> [!warning] Proceed with caution";
        assert_eq!(convert_callouts(input), "> [!WARNING] Proceed with caution");
    }

    #[test]
    fn test_convert_callouts_important() {
        let input = "> [!important]\n> Critical section";
        assert_eq!(
            convert_callouts(input),
            "> [!IMPORTANT]\n> Critical section"
        );
    }

    #[test]
    fn test_convert_callouts_unknown_type_defaults_to_note() {
        let input = "> [!custom] Some info";
        assert_eq!(convert_callouts(input), "> [!NOTE] Some info");
    }

    #[test]
    fn test_convert_embed_wikilinks_multiple() {
        let input = "Start ![[Note A]] middle ![[Note B#Section]] end";
        let result = convert_embed_wikilinks(input);
        assert_eq!(result, input);
    }

    #[test]
    fn test_convert_wikilinks_file_extension_as_image() {
        let input = "![[diagram.png]]";
        let result = convert_wikilinks(&convert_embed_wikilinks(input));
        assert_eq!(result, "[[diagram.png]]");
    }

    #[test]
    fn test_attachment_embed_alias_keeps_compatibility_target() {
        let input = "![[assets/diagram.png|640]]";
        assert_eq!(convert_embed_wikilinks(input), "[[assets/diagram.png|640]]");
    }

    #[test]
    fn test_frontmatter_preserved_by_default() {
        let input = "---\ntitle: My Note\ntags: [test]\n---\n\nBody content";
        let result = convert_obsidian_syntax(input);
        assert!(result.starts_with("---\ntitle: My Note\ntags: [test]\n---\n\nBody content"));
    }

    #[test]
    fn test_strip_frontmatter_with_extra_newlines() {
        let input = "---\ntitle: Test\n---\n\n\nBody after blanks";
        let result = strip_frontmatter(input);
        assert_eq!(result, "Body after blanks");
    }

    #[test]
    fn test_convert_callouts_no_title() {
        let input = "> [!note]";
        assert_eq!(convert_callouts(input), "> [!NOTE]");
    }

    #[test]
    fn test_convert_callouts_malformed_without_close_bracket() {
        // No closing `]`: the line must pass through verbatim instead of panicking.
        assert_eq!(convert_callouts("> [!"), "> [!");
        assert_eq!(convert_callouts("> [!é"), "> [!é");
        assert_eq!(
            convert_callouts("before\n> [!\nafter"),
            "before\n> [!\nafter"
        );
    }

    #[test]
    fn import_preserves_existing_local_note_and_reports_collision() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        fs::create_dir_all(source.path().join("notes")).unwrap();
        fs::write(
            source.path().join("notes/shared.md"),
            "# Incoming replacement\n",
        )
        .unwrap();
        fs::write(
            source.path().join("notes/new.md"),
            "# Fresh imported note\n",
        )
        .unwrap();

        let target = tempfile::tempdir().unwrap();
        fs::create_dir_all(target.path().join("notes")).unwrap();
        fs::write(
            target.path().join("notes/shared.md"),
            "# Local work to preserve\n",
        )
        .unwrap();
        let root = VaultRoot::open(target.path()).unwrap();

        let result = import_obsidian_vault(
            "test-vault",
            &root,
            source.path(),
            &ImportObsidianOptions::default(),
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(target.path().join("notes/shared.md")).unwrap(),
            "# Local work to preserve\n",
            "an Obsidian import must never overwrite a note already in the destination vault"
        );
        assert_eq!(
            fs::read_to_string(target.path().join("notes/new.md")).unwrap(),
            // The existing Obsidian callout converter normalizes the terminal newline.
            // The collision safety contract is about preserving local notes.
            "# Fresh imported note"
        );
        assert_eq!(result.notes_imported, 1, "only the new note was imported");
        assert_eq!(
            result.skipped_files, 1,
            "the collided note is counted as skipped"
        );
        assert_eq!(result.imported_paths, vec!["notes/new.md"]);
        assert!(
            result
                .errors
                .iter()
                .any(|message| message.contains("notes/shared.md")
                    && message.contains("already exists")),
            "the import report must explain which existing note was preserved: {:?}",
            result.errors
        );
    }

    #[test]
    fn repeated_obsidian_import_does_not_replace_prior_imported_note() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir_all(source.path().join(".obsidian")).unwrap();
        fs::write(source.path().join("daily.md"), "# Original import\n").unwrap();

        let target = tempfile::tempdir().unwrap();
        let root = VaultRoot::open(target.path()).unwrap();
        let options = ImportObsidianOptions::default();
        let first = import_obsidian_vault("test-vault", &root, source.path(), &options).unwrap();
        assert_eq!(first.notes_imported, 1);
        fs::write(
            target.path().join("daily.md"),
            "# Edited locally after import\n",
        )
        .unwrap();

        let second = import_obsidian_vault("test-vault", &root, source.path(), &options).unwrap();
        assert_eq!(
            second.notes_imported, 0,
            "repeat imports must not reapply existing notes"
        );
        assert_eq!(second.skipped_files, 1);
        assert_eq!(
            fs::read_to_string(target.path().join("daily.md")).unwrap(),
            "# Edited locally after import\n",
            "repeat import must preserve subsequent user edits"
        );
    }

    #[test]
    fn test_import_note_with_malformed_callout() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        fs::write(tmp.path().join("broken.md"), "> [!\n\n> [!é\n\nBody").unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let options = ImportObsidianOptions::default();
        let result = import_obsidian_vault("test-vault", &root, tmp.path(), &options).unwrap();
        assert_eq!(result.notes_imported, 1);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_note_embed_round_trip_preserves_heading_alias_and_folder_target() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        fs::create_dir_all(tmp.path().join("notes/folder")).unwrap();
        fs::write(
            tmp.path().join("notes/topic.md"),
            "Embed ![[folder/Other Note#Section|Readable label]]\nLink [[folder/Other Note#Section|Jump]]",
        )
        .unwrap();
        fs::write(
            tmp.path().join("notes/folder/Other Note.md"),
            "# Other Note\n\n## Section\n\nBody",
        )
        .unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let result = import_obsidian_vault(
            "test-vault",
            &root,
            tmp.path(),
            &ImportObsidianOptions::default(),
        )
        .unwrap();

        assert_eq!(result.notes_imported, 2);
        assert!(result.errors.is_empty());
        let imported = fs::read_to_string(vault_tmp.path().join("notes/topic.md")).unwrap();
        assert!(imported.contains("![[folder/Other Note#Section|Readable label]]"));
        assert!(imported.contains("[[folder/Other Note#Section|Jump]]"));
    }

    #[test]
    fn test_nested_attachment_paths_do_not_collide() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        fs::create_dir_all(tmp.path().join("assets/a")).unwrap();
        fs::create_dir_all(tmp.path().join("assets/b")).unwrap();
        fs::write(tmp.path().join("assets/a/image.png"), [1u8, 2, 3]).unwrap();
        fs::write(tmp.path().join("assets/b/image.png"), [4u8, 5, 6]).unwrap();
        fs::write(tmp.path().join("note.md"), "# Attachments").unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let result = import_obsidian_vault(
            "test-vault",
            &root,
            tmp.path(),
            &ImportObsidianOptions::default(),
        )
        .unwrap();

        assert_eq!(result.attachments_imported, 2);
        assert!(result.errors.is_empty());
        assert_eq!(
            fs::read(vault_tmp.path().join("_attachments/assets/a/image.png")).unwrap(),
            vec![1u8, 2, 3]
        );
        assert_eq!(
            fs::read(vault_tmp.path().join("_attachments/assets/b/image.png")).unwrap(),
            vec![4u8, 5, 6]
        );
    }

    #[test]
    fn test_empty_vault_import() {
        let tmp = tempfile::tempdir().unwrap();
        let obsidian_dir = tmp.path().join(".obsidian");
        fs::create_dir(&obsidian_dir).unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let options = ImportObsidianOptions::default();
        let result = import_obsidian_vault("test-vault", &root, tmp.path(), &options).unwrap();
        assert_eq!(result.notes_imported, 0);
        assert_eq!(result.attachments_imported, 0);
        assert_eq!(result.skipped_files, 0);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_binary_files_skipped_or_imported() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        fs::write(tmp.path().join("image.png"), [0x89, 0x50, 0x4E, 0x47]).unwrap();
        fs::write(tmp.path().join("readme.md"), "# Hello").unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let options = ImportObsidianOptions::default();
        let result = import_obsidian_vault("test-vault", &root, tmp.path(), &options).unwrap();
        assert_eq!(result.notes_imported, 1);
        assert_eq!(result.attachments_imported, 1);
    }

    #[test]
    fn test_binary_files_skipped_when_import_disabled() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        fs::write(tmp.path().join("doc.pdf"), b"%PDF-1.4").unwrap();
        fs::write(tmp.path().join("note.md"), "content").unwrap();

        let vault_tmp = tempfile::tempdir().unwrap();
        let root = crate::path::VaultRoot::open(vault_tmp.path()).unwrap();
        let options = ImportObsidianOptions {
            import_attachments: false,
            ..Default::default()
        };
        let result = import_obsidian_vault("test-vault", &root, tmp.path(), &options).unwrap();
        assert_eq!(result.notes_imported, 1);
        assert_eq!(result.attachments_imported, 0);
        assert_eq!(result.skipped_files, 1);
    }

    #[test]
    fn test_convert_callouts_multiline_continuation() {
        let input = "> [!warning] Title\n> Line 1\n> Line 2\n> Line 3";
        let result = convert_callouts(input);
        assert!(result.contains("> [!WARNING] Title"));
        assert!(result.contains("> Line 1"));
        assert!(result.contains("> Line 2"));
        assert!(result.contains("> Line 3"));
    }

    #[test]
    fn test_frontmatter_with_complex_yaml() {
        let input = "---\ntitle: Test\nauthors:\n  - Alice\n  - Bob\ntags: [rust, wasm]\ndate: 2024-01-15\n---\n\nBody here";
        let result = strip_frontmatter(input);
        assert_eq!(result, "Body here");
    }

    #[test]
    fn test_wikilink_to_file_with_extension() {
        let input = "[[report.pdf]]";
        let result = convert_wikilinks(input);
        assert!(result.contains("[[report.pdf]]"));
    }
}
