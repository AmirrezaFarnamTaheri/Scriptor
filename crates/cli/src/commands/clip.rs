//! `scriptor clip <url>` — W3-6.
//!
//! Invokes the `scriptor-capture` pipeline (W3-4) to fetch, sanitize, extract,
//! and convert a URL to Markdown, then writes through `vault/src/fs.rs` (I-1).
//!
//! Permission gate: the CLI is always a trusted process, so `SensitiveOperation::WebClip`
//! is enforced at documentation level; the full F-4 runtime gate will be wired
//! once `crates/vault/src/permissions.rs` ships its `WebClip` variant.

use std::path::PathBuf;

use scriptor_capture::{CaptureOptions, capture_url};
use scriptor_vault::{RelativeVaultPath, open_vault, save_note};

use crate::commands::CommandResult;

pub(crate) fn run_clip(
    url: String,
    vault_path: PathBuf,
    folder: String,
    filename_template: String,
    dry_run: bool,
) -> CommandResult {
    eprintln!("clip: fetching {url}…");

    let opts = CaptureOptions::default();
    let result = capture_url(&url, opts)?;

    eprintln!(
        "clip: extracted \"{}\" ({} words)",
        result.title, result.word_count
    );

    // Build the note filename.
    let filename = resolve_filename(&filename_template, &result.title);

    // Build the vault-relative path.
    let note_rel_path = format!("{}/{}", folder.trim_end_matches('/'), filename);

    if dry_run {
        println!("---");
        println!("url: {}", result.url);
        println!("title: {}", result.title);
        if let Some(ref site) = result.site_name {
            println!("site: {site}");
        }
        if let Some(ref date) = result.published_at {
            println!("published_at: {date}");
        }
        println!("output: {note_rel_path}");
        println!("---\n");
        println!("{}", result.markdown);
        return Ok(());
    }

    // Write through the vault's single write path (I-1).
    let session = open_vault(&vault_path)
        .map_err(|e| format!("could not open vault at {}: {e}", vault_path.display()))?;
    let relative =
        RelativeVaultPath::parse(&note_rel_path).map_err(|e| format!("invalid note path: {e}"))?;

    // Compose frontmatter + body.
    let body = build_note_content(&result);
    save_note(
        &session.descriptor.id,
        &session.root,
        &relative,
        &body,
        None,
    )
    .map_err(|e| format!("failed to write note {note_rel_path}: {e}"))?;

    eprintln!("clip: wrote → {note_rel_path}");
    println!("{note_rel_path}");

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn resolve_filename(template: &str, title: &str) -> String {
    let now = chrono::Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let time = now.format("%H%M").to_string();

    let slug = title
        .to_ascii_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = &slug[..slug.len().min(80)];

    template
        .replace("{{date}}", &date)
        .replace("{{time}}", &time)
        .replace("{{title}}", slug)
}

fn build_note_content(result: &scriptor_capture::CaptureResult) -> String {
    let mut fm = String::from("---\n");
    fm.push_str(&format!("url: \"{}\"\n", result.url));
    fm.push_str(&format!(
        "title: \"{}\"\n",
        result.title.replace('"', "\\\"")
    ));
    if let Some(ref site) = result.site_name {
        fm.push_str(&format!("site: \"{site}\"\n"));
    }
    if let Some(ref date) = result.published_at {
        fm.push_str(&format!("published_at: {date}\n"));
    }
    fm.push_str("tags: [clip]\n");
    fm.push_str("---\n\n");
    fm.push_str(&result.markdown);
    fm
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_vault::{RelativeVaultPath, open_vault, read_note, save_note};
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn resolve_filename_replaces_date_and_title() {
        let name = resolve_filename("{{date}}-{{title}}.md", "Hello World");
        assert!(name.ends_with(".md"));
        assert!(name.contains("hello-world"));
        // Date prefix should match YYYY-MM-DD pattern.
        let parts: Vec<_> = name.splitn(4, '-').collect();
        assert_eq!(parts[0].len(), 4, "year is 4 chars");
    }

    #[test]
    fn resolve_filename_slugs_special_characters() {
        let name = resolve_filename("{{title}}.md", "Café: résumé & notes (2026)");
        // Should contain at most hyphens and alphanumeric ASCII.
        assert!(!name.contains('é'), "non-ASCII should be replaced: {name}");
    }

    #[test]
    fn clipped_note_body_saves_through_vault_write_contract() {
        let dir = std::env::temp_dir().join(format!(
            "scriptor-cli-clip-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let session = open_vault(&dir).unwrap();
        let relative = RelativeVaultPath::parse("00-inbox/clipped.md").unwrap();
        let markdown = build_note_content(&scriptor_capture::CaptureResult {
            url: "https://example.com/post".into(),
            title: "Example Post".into(),
            site_name: Some("Example".into()),
            published_at: Some("2026-08-13".into()),
            markdown: "# Heading\n\nBody".into(),
            word_count: 2,
        });

        save_note(
            &session.descriptor.id,
            &session.root,
            &relative,
            &markdown,
            None,
        )
        .unwrap();

        let saved = read_note(&session.descriptor.id, &session.root, &relative).unwrap();
        assert!(saved.markdown.contains("tags: [clip]"));
        assert!(saved.markdown.contains("# Heading"));
        let _ = fs::remove_dir_all(&dir);
    }
}
