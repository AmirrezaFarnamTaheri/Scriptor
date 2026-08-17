//! Vault-scoped command handlers (open, scan, read, lint, rename, publish).

use std::fs;
use std::path::PathBuf;

use scriptor_vault::{
    RelativeVaultPath, SaveNoteOptions, ScannedEntryKind, export_text_bundle, format_lint_text,
    lint_vault, lint_vault_fix, load_vault_config, normalize_rule_filter, open_vault,
    open_vault_output, read_note, rename_apply, rename_dry_run, save_note_with_options, scan_vault,
    scan_vault_with_roots,
};

use crate::command_line::exit_code;

type CommandResult = Result<(), Box<dyn std::error::Error>>;

pub(crate) fn run_open(path: PathBuf) -> CommandResult {
    let session = open_vault(&path)?;
    println!(
        "{}",
        serde_json::to_string_pretty(&open_vault_output(&session))?
    );
    Ok(())
}

pub(crate) fn run_scan(path: PathBuf) -> CommandResult {
    let session = open_vault(&path)?;
    let entries = scan_vault(&session.root)?;
    println!("{}", serde_json::to_string_pretty(&entries)?);
    Ok(())
}

pub(crate) fn run_read(path: PathBuf, note: String) -> CommandResult {
    let session = open_vault(&path)?;
    let relative = RelativeVaultPath::parse(&note)?;
    let document = read_note(&session.descriptor.id, &session.root, &relative)?;
    println!("{}", serde_json::to_string_pretty(&document)?);
    Ok(())
}

pub(crate) fn run_lint(
    path: PathBuf,
    fix: bool,
    rules: Vec<String>,
    format: String,
) -> CommandResult {
    let session = open_vault(&path)?;
    let active_rules = normalize_rule_filter(&rules)?;
    if fix {
        let output = lint_vault_fix(&session.descriptor.id, &session.root, &active_rules)?;
        if format == "text" {
            println!("{}", format_lint_text(&output.report));
            if output.files_fixed > 0 {
                println!(
                    "Applied {} edit(s) across {} file(s).",
                    output.edits_applied, output.files_fixed
                );
            }
        } else {
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        if output.report.total_issues > 0 {
            std::process::exit(exit_code::LINT_ISSUES);
        }
    } else {
        let report = lint_vault(&session.descriptor.id, &session.root, &active_rules)?;
        if format == "text" {
            println!("{}", format_lint_text(&report));
        } else {
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        if report.total_issues > 0 {
            std::process::exit(exit_code::LINT_ISSUES);
        }
    }
    Ok(())
}

pub(crate) fn run_grep(path: PathBuf, pattern: String, limit: u32) -> CommandResult {
    let session = open_vault(&path)?;
    let regex = regex::Regex::new(&pattern)?;
    let mut hits = Vec::new();
    for entry in scan_vault(&session.root)? {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        let relative = RelativeVaultPath::parse(&entry.path)?;
        let document = read_note(&session.descriptor.id, &session.root, &relative)?;
        if regex.is_match(&document.markdown) {
            hits.push(serde_json::json!({
                "path": entry.path,
                "title": document.metadata.title,
            }));
        }
        if hits.len() >= limit as usize {
            break;
        }
    }
    println!("{}", serde_json::to_string_pretty(&hits)?);
    Ok(())
}

pub(crate) fn run_outline(path: PathBuf, note: String) -> CommandResult {
    let session = open_vault(&path)?;
    let relative = RelativeVaultPath::parse(&note)?;
    let document = read_note(&session.descriptor.id, &session.root, &relative)?;
    let heading_re = regex::Regex::new(r"^(#+)\s+(.*)$")?;
    let outline: Vec<serde_json::Value> = document
        .markdown
        .lines()
        .enumerate()
        .filter_map(|(index, line)| {
            let caps = heading_re.captures(line)?;
            Some(serde_json::json!({
                "line": index + 1,
                "level": caps.get(1)?.as_str().len(),
                "label": caps.get(2)?.as_str().trim(),
            }))
        })
        .collect();
    println!("{}", serde_json::to_string_pretty(&outline)?);
    Ok(())
}

pub(crate) fn run_note(
    path: PathBuf,
    file: String,
    title: Option<String>,
    body: Option<String>,
    dry_run: bool,
) -> CommandResult {
    let session = open_vault(&path)?;
    let relative = RelativeVaultPath::parse(&file)?;
    let heading = title.unwrap_or_else(|| {
        file.trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("Untitled")
            .to_string()
    });
    let markdown = body.unwrap_or_else(|| format!("# {heading}\n\n"));
    let saved = save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &markdown,
        None,
        SaveNoteOptions { dry_run },
    )?;
    println!("{}", serde_json::to_string_pretty(&saved)?);
    Ok(())
}

pub(crate) fn run_text_bundle_export(
    path: PathBuf,
    note: String,
    output: PathBuf,
) -> CommandResult {
    let session = open_vault(&path)?;
    let relative = RelativeVaultPath::parse(&note)?;
    let exported = export_text_bundle(&session.descriptor.id, &session.root, &relative, &output)?;
    println!("{}", serde_json::to_string_pretty(&exported)?);
    Ok(())
}

pub(crate) fn run_publish(path: PathBuf, output: PathBuf) -> CommandResult {
    let session = open_vault(&path)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    let entries = scan_vault_with_roots(&session.root, &config.extra_roots)?;
    let docs_dir = output.join("src").join("content").join("docs");
    fs::create_dir_all(&docs_dir)?;
    let mut copied = 0usize;
    for entry in entries {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        let source = session
            .root
            .root()
            .join(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
        let target = docs_dir.join(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source, &target)?;
        copied += 1;
    }
    fs::write(
        output.join("astro.config.mjs"),
        "import { defineConfig } from 'astro/config';\nimport starlight from '@astrojs/starlight';\nexport default defineConfig({ integrations: [starlight({ title: 'Scriptor Publish' })] });\n",
    )?;
    fs::write(
        output.join("package.json"),
        r#"{"name":"scriptor-publish","private":true,"scripts":{"dev":"astro dev","build":"astro build"}}"#,
    )?;
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "output": output,
            "notes_copied": copied,
            "docs_dir": docs_dir,
        }))?
    );
    Ok(())
}

pub(crate) fn run_rename_dry_run(
    path: PathBuf,
    from: String,
    to: String,
    update_links: bool,
) -> CommandResult {
    let session = open_vault(&path)?;
    let from_path = RelativeVaultPath::parse(&from)?;
    let to_path = RelativeVaultPath::parse(&to)?;
    let preview = rename_dry_run(
        &session.descriptor.id,
        &session.root,
        &from_path,
        &to_path,
        update_links,
    )?;
    println!("{}", serde_json::to_string_pretty(&preview)?);
    Ok(())
}

pub(crate) fn run_rename_apply(
    path: PathBuf,
    from: String,
    to: String,
    update_links: bool,
) -> CommandResult {
    let session = open_vault(&path)?;
    let from_path = RelativeVaultPath::parse(&from)?;
    let to_path = RelativeVaultPath::parse(&to)?;
    let output = rename_apply(
        &session.descriptor.id,
        &session.root,
        &from_path,
        &to_path,
        update_links,
    )?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}
