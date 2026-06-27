use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::error::VaultError;
use crate::hash::content_hash;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::write::save_note;

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
    "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico",
    "pdf", "mp3", "mp4", "wav", "ogg", "webm", "mov",
    "zip", "tar", "gz",
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

    for entry in WalkDir::new(obsidian_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
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
    root: &VaultRoot,
    obsidian_root: &Path,
    relative: &Path,
    attachments_dir: &Path,
) -> Result<(), VaultError> {
    let source = obsidian_root.join(relative);
    let file_name = relative
        .file_name()
        .ok_or_else(|| VaultError::InvalidConfig {
            message: format!("Invalid attachment path: {}", relative.display()),
        })?;
    let dest = attachments_dir.join(file_name);

    fs::create_dir_all(
        dest.parent()
            .ok_or_else(|| VaultError::InvalidConfig {
                message: "Cannot determine parent directory".to_string(),
            })?,
    )
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
    let re = Regex::new(r"!\[\[([^\]]+?)\]\]").expect("embed wikilink regex");
    re.replace_all(markdown, |caps: &regex::Captures| {
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
    let re = Regex::new(r"\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]").expect("wikilink regex");
    re.replace_all(markdown, |caps: &regex::Captures| {
        let target = &caps[1];
        let display = caps.get(2).map(|m| m.as_str()).unwrap_or(target);

        if target.contains('.') && !target.contains('#') {
            let filename = target.rsplit('/').next().unwrap_or(target);
            format!("![{display}](<_{filename}>)")
        } else {
            let clean_target = target.split('#').next().unwrap_or(target);
            format!("[{display}](<_{clean_target}>)")
        }
    })
    .into_owned()
}

fn convert_highlights(markdown: &str) -> String {
    let re = Regex::new(r"==(.+?)==").expect("highlight regex");
    re.replace_all(markdown, "<mark>$1</mark>").into_owned()
}

fn convert_callouts(markdown: &str) -> String {
    let re = Regex::new(r"(?m)^> \[!(\w+)\](?:\s*(.*))?$").expect("callout regex");
    re.replace_all(markdown, |caps: &regex::Captures| {
        let callout_type = &caps[1];
        let title = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");
        let gfm_type = match callout_type.to_lowercase().as_str() {
            "note" => "NOTE",
            "tip" | "hint" => "TIP",
            "important" => "IMPORTANT",
            "warning" | "caution" => "WARNING",
            "danger" | "error" => "CAUTION",
            _ => "NOTE",
        };
        if title.is_empty() {
            format!("> [!{gfm_type}]")
        } else {
            format!("> [!{gfm_type}] {title}")
        }
    })
    .into_owned()
}

fn strip_frontmatter(markdown: &str) -> String {
    if markdown.starts_with("---") {
        if let Some(end) = markdown[3..].find("\n---") {
            let after = &markdown[end + 7..];
            return after.trim_start_matches('\n').to_string();
        }
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
        assert_eq!(convert_highlights(input), "This is <mark>highlighted</mark> text");
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
        assert_eq!(convert_wikilinks(input), "[My Note](<_My Note>)");
    }

    #[test]
    fn test_convert_wikilinks_with_alias() {
        let input = "[[My Note|Custom Label]]";
        assert_eq!(convert_wikilinks(input), "[Custom Label](<_My Note>)");
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
        assert!(result.contains("[here](<_Other Note>)"));
    }
}
