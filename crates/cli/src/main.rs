use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use scriptor_export_runner::{
    default_export_directory, discover_pandoc, run_export_job, ExportJobInput,
};
use scriptor_canvas_engine::{
    apply_template_dry_run, bench_hit_test_frame, bench_snapshot_render, hit_test,
    list_documents as canvas_list_stored, load_document as canvas_load_stored, load_document_file,
    list_templates, save_document as canvas_save_stored, query_blocks_in_bounds, write_snapshot, CanvasPoint,
    SnapshotFormat,
};
use scriptor_indexer::{
    backlinks_for_path, health_diagnostics_json, health_report_json, open_cache_for_session,
    query_focused_graph, rebuild_index, search_notes, traverse_graph,
};
use scriptor_native_git::{git_commit_selected, git_pull, git_push, git_resolve_conflict, git_status};
use scriptor_vault::{
    export_text_bundle, format_lint_text, lint_vault, lint_vault_fix, load_vault_config, normalize_rule_filter,
    open_vault, open_vault_output, read_note, rename_apply, rename_dry_run, save_note_with_options,
    scan_vault, SaveNoteOptions,
    scan_vault_with_roots, RelativeVaultPath, ScannedEntryKind,
};
use scriptor_daemon::rpc_call;
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult};
use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, detect_system_info, run_process};
use clap::Parser;
use serde::Serialize;

use command_line::{Cli, Commands, DaemonCommands};

mod daemon_client;
mod term_markdown;
mod tui;

const VAULT_SCAN_BUDGET_MS: u128 = 1500;
const SEARCH_BUDGET_MS: u128 = 100;

mod command_line;
mod bench;
use bench::*;

fn print_rpc_response(response: &RpcResponse) -> Result<(), Box<dyn std::error::Error>> {
    match &response.result {
        RpcResult::Ok(payload) => {
            println!("{}", serde_json::to_string_pretty(payload)?);
            Ok(())
        }
        RpcResult::Err(message) => Err(message.clone().into()),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = scriptor_system_bridge::observability::init_observability("cli");
    let cli = Cli::parse();

    match cli.command {
        Commands::SystemInfo => {
            println!("{}", serde_json::to_string_pretty(&detect_system_info())?);
        }
        Commands::CanvasListDocuments { path } => {
            let session = open_vault(&path)?;
            let summaries = canvas_list_stored(session.root.root())?;
            println!("{}", serde_json::to_string_pretty(&summaries)?);
        }
        Commands::CanvasSaveDocument { path, file } => {
            let session = open_vault(&path)?;
            let document = load_document_file(&file)?;
            let saved = canvas_save_stored(session.root.root(), &document)?;
            println!("{}", serde_json::to_string_pretty(&saved.display().to_string())?);
        }
        Commands::CanvasLoadDocument { path, id } => {
            let session = open_vault(&path)?;
            let document = canvas_load_stored(session.root.root(), &id)?;
            println!("{}", serde_json::to_string_pretty(&document)?);
        }
        Commands::Open { path } => {
            let session = open_vault(&path)?;
            println!("{}", serde_json::to_string_pretty(&open_vault_output(&session))?);
        }
        Commands::Scan { path } => {
            let session = open_vault(&path)?;
            let entries = scan_vault(&session.root)?;
            println!("{}", serde_json::to_string_pretty(&entries)?);
        }
        Commands::Read { path, note } => {
            let session = open_vault(&path)?;
            let relative = RelativeVaultPath::parse(&note)?;
            let document = read_note(&session.descriptor.id, &session.root, &relative)?;
            println!("{}", serde_json::to_string_pretty(&document)?);
        }
        Commands::Tui { path, smoke_test, in_process } => {
            let in_process = cli.in_process || in_process;
            if smoke_test {
                tui::smoke_test(path, !in_process)?;
            } else {
                tui::run(path, !in_process)?;
            }
        }
        Commands::Daemon { command } => match command {
            DaemonCommands::Ping => {
                daemon_client::ensure_daemon_running()?;
                let version = daemon_client::daemon_ping()?;
                println!(
                    "{}",
                    serde_json::to_string_pretty(&serde_json::json!({ "version": version }))?
                );
            }
            DaemonCommands::Endpoint => {
                let endpoint = scriptor_daemon::read_endpoint()?;
                println!("{}", serde_json::to_string_pretty(&endpoint)?);
            }
        }
        Commands::RebuildIndex { path } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let summary = rebuild_index(&session, &[])?;
                println!("{}", serde_json::to_string_pretty(&summary)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(3, RpcMethod::RebuildIndex))?;
                print_rpc_response(&response)?;
            }
        }
        Commands::Health { path } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let _ = rebuild_index(&session, &[])?;
                let cache = open_cache_for_session(&session)?;
                println!("{}", health_report_json(&cache, &session)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(4, RpcMethod::HealthReport))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::HealthReport { json }) => println!("{json}"),
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon health response".into()),
                }
            }
        }
        Commands::HealthDiagnostics { path } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let _ = rebuild_index(&session, &[])?;
                let cache = open_cache_for_session(&session)?;
                println!("{}", health_diagnostics_json(&cache, &session)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(5, RpcMethod::HealthDiagnostics))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::HealthDiagnostics { json }) => println!("{json}"),
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon health diagnostics response".into()),
                }
            }
        }
        Commands::Lint { path, fix, rules, format } => {
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
                    std::process::exit(2);
                }
            } else {
                let report = lint_vault(&session.descriptor.id, &session.root, &active_rules)?;
                if format == "text" {
                    println!("{}", format_lint_text(&report));
                } else {
                    println!("{}", serde_json::to_string_pretty(&report)?);
                }
                if report.total_issues > 0 {
                    std::process::exit(2);
                }
            }
        }
        Commands::Search { path, query, limit } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let _ = rebuild_index(&session, &[])?;
                let cache = open_cache_for_session(&session)?;
                let hits = search_notes(&cache, &session.descriptor.id, &query, limit)?;
                println!("{}", serde_json::to_string_pretty(&hits)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(6, RpcMethod::SearchNotes {
                    query: query.clone(),
                    limit,
                }))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::SearchHits { hits }) => {
                        println!("{}", serde_json::to_string_pretty(&hits)?);
                    }
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon search response".into()),
                }
            }
        }
        Commands::Backlinks { path, note } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let _ = rebuild_index(&session, &[])?;
                let cache = open_cache_for_session(&session)?;
                let hits = backlinks_for_path(&cache, &session, &note)?;
                println!("{}", serde_json::to_string_pretty(&hits)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(7, RpcMethod::Backlinks { path: note.clone() }))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::Backlinks { json, .. }) => println!("{json}"),
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon backlinks response".into()),
                }
            }
        }
        Commands::Graph { path, note, depth } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let session = open_vault(&path)?;
                let _ = rebuild_index(&session, &[])?;
                let cache = open_cache_for_session(&session)?;
                let graph = query_focused_graph(&cache, &session, note.as_deref(), depth, &[])?;
                println!("{}", serde_json::to_string_pretty(&graph)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(8, RpcMethod::GraphSummary {
                    path: note.clone(),
                    depth,
                }))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::GraphSummary { json }) => println!("{json}"),
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon graph response".into()),
                }
            }
        }
        Commands::Grep { path, pattern, limit } => {
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
        }
        Commands::Outline { path, note } => {
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
        }
        Commands::Note { path, file, title, body, dry_run } => {
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
        }
        Commands::TraverseGraph { path, note, depth } => {
            if !cli.in_process {
                return Err(
                    "traverse-graph has no daemon RPC yet; pass --in-process for this command".into(),
                );
            }
            daemon_client::warn_in_process_deprecated();
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            let steps = traverse_graph(&cache, &session, &note, depth)?;
            println!("{}", serde_json::to_string_pretty(&steps)?);
        }
        Commands::TextBundleExport { path, note, output } => {
            let session = open_vault(&path)?;
            let relative = RelativeVaultPath::parse(&note)?;
            let exported = export_text_bundle(&session.descriptor.id, &session.root, &relative, &output)?;
            println!("{}", serde_json::to_string_pretty(&exported)?);
        }
        Commands::Publish { path, output } => {
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
                let source = session.root.root().join(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
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
        }
        Commands::GitResolveConflict { path, file, strategy } => {
            let resolved = git_resolve_conflict(&path, &file, &strategy)?;
            println!("{}", serde_json::to_string_pretty(&resolved)?);
        }
        Commands::RenameDryRun {
            path,
            from,
            to,
            update_links,
        } => {
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
        }
        Commands::RenameApply {
            path,
            from,
            to,
            update_links,
        } => {
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
        }
        Commands::BenchScan { path, iterations } => {
            let report = bench_scan(&path, iterations)?;
            println!("{}", serde_json::to_string_pretty(&report)?);
            if !report.within_budget {
                std::process::exit(1);
            }
        }
        Commands::BenchSearch { path, query, iterations } => {
            let report = bench_search(&path, &query, iterations)?;
            println!("{}", serde_json::to_string_pretty(&report)?);
            if !report.within_budget {
                std::process::exit(1);
            }
        }
        Commands::GenerateVault { output, count, prefix } => {
            let summary = generate_vault(&output, count, &prefix)?;
            println!("{}", serde_json::to_string_pretty(&summary)?);
        }
        Commands::ExportDiscover => {
            let discovery = discover_pandoc()?;
            println!("{}", serde_json::to_string_pretty(&discovery)?);
        }
        Commands::PdfTranslate {
            input,
            lang_in,
            lang_out,
            output,
        } => {
            let pdf2zh = std::env::var("SCRIPTOR_PDF2ZH_PATH").unwrap_or_else(|_| "pdf2zh".into());
            let mut args = vec![
                input.as_os_str().to_os_string(),
                "-li".into(),
                lang_in.into(),
                "-lo".into(),
                lang_out.into(),
            ];
            if let Some(out) = output {
                args.push("-o".into());
                args.push(out.into_os_string());
            }
            let receipt = run_process(
                ProcessSpec::new(&pdf2zh)
                    .args(args)
                    .timeout(Duration::from_secs(15 * 60))
                    .max_output_bytes(512 * 1024)
                    .network_policy(NetworkPolicy::Allow)
                    .expected_sha256(std::env::var("SCRIPTOR_PDF2ZH_SHA256").ok()),
            )
            .map_err(|error| {
                format!(
                    "PDF translation failed ({error}). Install PDFMathTranslate or configure SCRIPTOR_PDF2ZH_PATH and SCRIPTOR_PDF2ZH_SHA256."
                )
            })?;
            if receipt.exit_code != 0 {
                return Err(format!(
                    "pdf2zh exited with code {}: {}",
                    receipt.exit_code,
                    receipt.stderr.trim()
                )
                .into());
            }
        }
        Commands::Export {
            path,
            note,
            format,
            dry_run,
            extra_arg,
            output_subdir,
        } => {
            let session = open_vault(&path)?;
            let relative = RelativeVaultPath::parse(&note)?;
            let document = read_note(&session.descriptor.id, &session.root, &relative)?;
            let stem = note.trim_end_matches(".md").rsplit('/').next().unwrap_or("note");
            let output_directory = match output_subdir {
                Some(subdir) => session.root.root().join(subdir),
                None => default_export_directory(session.root.root()),
            };
            let input = ExportJobInput {
                format,
                source_markdown: document.markdown,
                output_directory: output_directory.display().to_string(),
                source_stem: stem.to_string(),
                title: Some(document.metadata.title),
                dry_run,
                extra_pandoc_args: extra_arg,
                vault_root: session.root.root().display().to_string(),
                job_id: None,
                preserve_temp_on_failure: false,
                trusted_pandoc_hash: None,
            };
            let output = run_export_job(input)?;
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Commands::GitStatus { path } => {
            if cli.in_process {
                daemon_client::warn_in_process_deprecated();
                let status = git_status(&path)?;
                println!("{}", serde_json::to_string_pretty(&status)?);
            } else {
                daemon_client::ensure_vault_open(&path)?;
                let response = rpc_call(RpcRequest::new(9, RpcMethod::GitStatus))?;
                match response.result {
                    RpcResult::Ok(RpcPayload::GitStatus { json }) => println!("{json}"),
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("unexpected daemon git status response".into()),
                }
            }
        }
        Commands::GitCommit { path, message, file } => {
            let output = git_commit_selected(&path, &file, &message)?;
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Commands::GitPull { path } => {
            let output = git_pull(&path)?;
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Commands::GitPush { path } => {
            let output = git_push(&path)?;
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Commands::CanvasHitTest { file, x, y } => {
            let document = load_document_file(&file)?;
            let hit = hit_test(&document, CanvasPoint { x, y });
            println!("{}", serde_json::to_string_pretty(&hit)?);
        }
        Commands::CanvasQuery {
            file,
            x,
            y,
            width,
            height,
        } => {
            let document = load_document_file(&file)?;
            let blocks = query_blocks_in_bounds(
                &document,
                scriptor_canvas_engine::CanvasRect {
                    x,
                    y,
                    width,
                    height,
                },
                None,
            );
            println!("{}", serde_json::to_string_pretty(&blocks)?);
        }
        Commands::CanvasTemplateDryRun { file, template } => {
            let document = load_document_file(&file)?;
            let preview = apply_template_dry_run(&document, &template)?;
            println!("{}", serde_json::to_string_pretty(&preview)?);
        }
        Commands::CanvasTemplates => {
            println!("{}", serde_json::to_string_pretty(&list_templates())?);
        }
        Commands::CanvasSnapshot {
            file,
            format,
            output,
            dry_run,
        } => {
            let document = load_document_file(&file)?;
            let snapshot_format = match format.as_str() {
                "svg" => SnapshotFormat::Svg,
                "png" => SnapshotFormat::Png,
                "pdf" => SnapshotFormat::Pdf,
                other => {
                    return Err(format!("unsupported snapshot format: {other}").into());
                }
            };
            let result = write_snapshot(&document, &output, snapshot_format, dry_run)?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Commands::BenchCanvasHitTest { file, iterations } => {
            let document = load_document_file(&file)?;
            let report = bench_hit_test_frame(&document, iterations);
            println!("{}", serde_json::to_string_pretty(&report)?);
            if !report.within_budget {
                std::process::exit(1);
            }
        }
        Commands::BenchCanvasSnapshot { file, iterations } => {
            let document = load_document_file(&file)?;
            let report = bench_snapshot_render(&document, iterations);
            println!("{}", serde_json::to_string_pretty(&report)?);
            if !report.within_budget {
                std::process::exit(1);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod cli_tests {
    use super::*;

    #[test]
    fn global_in_process_defaults_false() {
        let cli = Cli::try_parse_from(["scriptor", "search", "/tmp/v", "q"]).expect("parse");
        assert!(!cli.in_process);
    }

    #[test]
    fn tui_defaults_to_daemon_routing() {
        let cli = Cli::try_parse_from(["scriptor", "tui", "/tmp/vault"]).expect("parse");
        assert!(!cli.in_process);
        match cli.command {
            Commands::Tui { in_process, .. } => assert!(!in_process),
            _ => panic!("expected tui command"),
        }
    }
}
