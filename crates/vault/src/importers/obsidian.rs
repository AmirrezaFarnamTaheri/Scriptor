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
                Err(e) => {
                    errors.push(format!("{}: {}", relative_str, e));
                }
            }
        } else if options.import_attachments && is_attachment(&extension) {
            match import_attachment(root, obsidian_path, relative, &attachments_dir) {
                Ok(_) => {
                    attachments_imported += 1;
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

    save_note(vault_id, root, &target, &markdown, None)?;
    Ok(target_rel)
}

fn import_attachment(
    _root: &VaultRoot,
    obsidian_root: &Path,
    relative: &Path,
    attachments_dir: &Path,
) -> Result<(), VaultError> {
    let source = obsidian_root.join(relative);
    let relative_str = format_path(relative);
    let safe_relative = RelativeVaultPath::parse(&relative_str)?;
    let dest = attachments_dir.join(
        safe_relative
            .as_str()
            .replace('/', std::path::MAIN_SEPARATOR_STR),
    );
    if dest.exists() {
        return Err(VaultError::NoteExists(format!(
            "_attachments/{}",
            safe_relative.as_str()
        )));
    }

    fs::create_dir_all(dest.parent().ok_or_else(|| VaultError::InvalidConfig {
        message: "Cannot determine parent directory".to_string(),
    })?)
    .map_err(|source_err| VaultError::io(dest.parent().unwrap(), source_err))?;

    fs::copy(&source, &dest).map_err(|source_err| VaultError::io(&source, source_err))?;
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

fn convert_embed_wikilinks(markdown: &str) -> String {
    EMBED_WIKILINK_RE
        .replace_all(markdown, |caps: &regex::Captures| {
            let target = &caps[1];
            if let Some((name, _heading)) = target.split_once('#') {
                format!("[[{name}]]")
            } else {
                format!("[[{target}]]")
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
    fn test_detect_obsidian_vault() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(!detect_obsidian_vault(tmp.path()));
        fs::create_dir(tmp.path().join(".obsidian")).unwrap();
        assert!(detect_obsidian_vault(tmp.path()));
    }

    #[test]
    fn test_convert_embed_wikilinks() {
        let input = "![[My Note]]";
        assert_eq!(convert_embed_wikilinks(input), "[[My Note]]");
    }

    #[test]
    fn test_convert_embed_wikilinks_with_heading() {
        let input = "![[My Note#Section]]";
        assert_eq!(convert_embed_wikilinks(input), "[[My Note]]");
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
        assert_eq!(result, "Start [[Note A]] middle [[Note B]] end");
    }

    #[test]
    fn test_convert_wikilinks_file_extension_as_image() {
        let input = "![[diagram.png]]";
        let result = convert_wikilinks(&convert_embed_wikilinks(input));
        assert!(result.contains("[[diagram.png]]"));
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
