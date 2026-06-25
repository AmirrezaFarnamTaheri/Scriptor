use std::fs;
use std::path::PathBuf;
use std::time::Instant;

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
use scriptor_ipc::{RpcMethod, RpcRequest, RpcResponse, RpcResult};
use scriptor_system_bridge::detect_system_info;
use clap::{Parser, Subcommand};
use serde::Serialize;

mod term_markdown;
mod tui;

const VAULT_SCAN_BUDGET_MS: u128 = 1500;
const SEARCH_BUDGET_MS: u128 = 100;

#[derive(Debug, Parser)]
#[command(name = "scriptor", about = "Scriptor command-line interface")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Detect host OS metadata for diagnostics.
    SystemInfo,
    /// List persisted canvas boards in a vault.
    CanvasListDocuments {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Save a canvas scene JSON file into a vault store.
    CanvasSaveDocument {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: PathBuf,
    },
    /// Load a persisted canvas board from a vault by id.
    CanvasLoadDocument {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        id: String,
    },
    /// Open a vault and print its descriptor.
    Open {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Scan a vault and emit note entries as JSON.
    Scan {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Read a note from a vault.
    Read {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Open a terminal UI for local-first vault browsing.
    Tui {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long, default_value_t = false)]
        smoke_test: bool,
        #[arg(long, default_value_t = false, help = "Route vault operations through the headless daemon")]
        via_daemon: bool,
    },
    /// Interact with the headless Scriptor daemon over local IPC.
    Daemon {
        #[command(subcommand)]
        command: DaemonCommands,
    },
    /// Rebuild the derived index for a vault.
    RebuildIndex {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Emit a vault health report from the derived index.
    Health {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Emit detailed vault health diagnostics with issue rows.
    HealthDiagnostics {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Lint vault notes for Foam-style issues (missing heading, stale wikilink definitions).
    Lint {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        fix: bool,
        #[arg(long = "rule")]
        rules: Vec<String>,
        #[arg(long, default_value = "json")]
        format: String,
    },
    /// Search indexed notes with FTS.
    Search {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long, default_value_t = 25)]
        limit: u32,
    },
    /// List backlinks for a note path.
    Backlinks {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Query a focused knowledge graph from the derived index.
    Graph {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: Option<String>,
        #[arg(long, default_value_t = 1)]
        depth: u32,
    },
    /// Grep note bodies in a vault (regex over file contents).
    Grep {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "PATTERN")]
        pattern: String,
        #[arg(long, default_value_t = 50)]
        limit: u32,
    },
    /// Print heading outline for a note.
    Outline {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Create or overwrite a note at a relative path.
    Note {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: String,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        body: Option<String>,
        #[arg(long)]
        dry_run: bool,
    },
    /// Traverse graph steps from a focus note (MCP parity).
    TraverseGraph {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long, default_value_t = 2)]
        depth: u32,
    },
    /// Export a note as TextBundle zip.
    TextBundleExport {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long)]
        output: PathBuf,
    },
    /// Scaffold a Starlight site from vault notes (Foam publish parity).
    Publish {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
    /// Resolve a Git merge conflict with ours/theirs.
    GitResolveConflict {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: String,
        #[arg(long, default_value = "ours")]
        strategy: String,
    },
    /// Preview a rename transaction with link updates.
    RenameDryRun {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long, default_value_t = true)]
        update_links: bool,
    },
    /// Apply a rename transaction with link updates.
    RenameApply {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long, default_value_t = true)]
        update_links: bool,
    },
    /// Measure vault scan latency and emit JSON for CI budgets.
    BenchScan {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long, default_value_t = 5)]
        iterations: u32,
    },
    /// Measure warm FTS search latency and emit JSON for CI budgets.
    BenchSearch {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long, default_value_t = 10)]
        iterations: u32,
    },
    /// Generate a synthetic Markdown vault fixture for benchmarks.
    GenerateVault {
        #[arg(value_name = "OUTPUT")]
        output: PathBuf,
        #[arg(long, default_value_t = 100)]
        count: u32,
        #[arg(long, default_value = "notes")]
        prefix: String,
    },
    /// Discover Pandoc on PATH.
    ExportDiscover,
    /// Translate a PDF with pdf2zh (layout-preserving scientific translation).
    PdfTranslate {
        #[arg(value_name = "PDF")]
        input: PathBuf,
        #[arg(long = "lang-in", default_value = "en")]
        lang_in: String,
        #[arg(long = "lang-out", default_value = "zh")]
        lang_out: String,
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// Export a note through Pandoc.
    Export {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long, default_value = "html")]
        format: String,
        #[arg(long)]
        dry_run: bool,
        #[arg(long = "extra-arg")]
        extra_arg: Vec<String>,
        #[arg(long)]
        output_subdir: Option<String>,
    },
    /// Show Git status for a vault root.
    GitStatus {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Commit selected files in a vault Git repository.
    GitCommit {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        message: String,
        #[arg(long, required = true)]
        file: Vec<String>,
    },
    /// Pull from upstream with fast-forward only.
    GitPull {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Push to upstream.
    GitPush {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Hit-test a canvas scene JSON file at a point.
    CanvasHitTest {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long)]
        x: f64,
        #[arg(long)]
        y: f64,
    },
    /// Query visible blocks in a viewport bounds rectangle.
    CanvasQuery {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 0.0)]
        x: f64,
        #[arg(long, default_value_t = 0.0)]
        y: f64,
        #[arg(long, default_value_t = 640.0)]
        width: f64,
        #[arg(long, default_value_t = 480.0)]
        height: f64,
    },
    /// Preview template insertion without mutating the scene file.
    CanvasTemplateDryRun {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long)]
        template: String,
    },
    /// List built-in canvas templates.
    CanvasTemplates,
    /// Render a canvas snapshot (SVG, PNG, or PDF).
    CanvasSnapshot {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value = "svg")]
        format: String,
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        dry_run: bool,
    },
    /// Measure canvas hit-test frame latency for CI budgets.
    BenchCanvasHitTest {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 120)]
        iterations: u32,
    },
    /// Measure canvas snapshot render latency for CI budgets.
    BenchCanvasSnapshot {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 20)]
        iterations: u32,
    },
}

#[derive(Debug, Subcommand)]
enum DaemonCommands {
    /// Verify the daemon endpoint and return its version.
    Ping,
    /// Print the resolved daemon socket endpoint metadata.
    Endpoint,
}

#[derive(Debug, Serialize)]
struct BenchScanReport {
    scenario: &'static str,
    vault_path: String,
    iterations: u32,
    note_count: u32,
    mean_ms: f64,
    min_ms: u64,
    max_ms: u64,
    budget_ms: u128,
    within_budget: bool,
}

#[derive(Debug, Serialize)]
struct BenchSearchReport {
    scenario: &'static str,
    vault_path: String,
    query: String,
    iterations: u32,
    note_count: u32,
    hit_count: u32,
    mean_ms: f64,
    min_ms: u64,
    max_ms: u64,
    budget_ms: u128,
    within_budget: bool,
}

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
        Commands::Tui { path, smoke_test, via_daemon } => {
            if smoke_test {
                tui::smoke_test(path, via_daemon)?;
            } else {
                tui::run(path, via_daemon)?;
            }
        }
        Commands::Daemon { command } => match command {
            DaemonCommands::Ping => {
                let response = rpc_call(RpcRequest {
                    id: 1,
                    method: RpcMethod::Ping,
                })?;
                print_rpc_response(&response)?;
            }
            DaemonCommands::Endpoint => {
                let endpoint = scriptor_daemon::read_endpoint()?;
                println!("{}", serde_json::to_string_pretty(&endpoint)?);
            }
        }
        Commands::RebuildIndex { path } => {
            let session = open_vault(&path)?;
            let summary = rebuild_index(&session, &[])?;
            println!("{}", serde_json::to_string_pretty(&summary)?);
        }
        Commands::Health { path } => {
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            println!("{}", health_report_json(&cache, &session)?);
        }
        Commands::HealthDiagnostics { path } => {
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            println!("{}", health_diagnostics_json(&cache, &session)?);
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
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            let hits = search_notes(&cache, &session.descriptor.id, &query, limit)?;
            println!("{}", serde_json::to_string_pretty(&hits)?);
        }
        Commands::Backlinks { path, note } => {
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            let hits = backlinks_for_path(&cache, &session, &note)?;
            println!("{}", serde_json::to_string_pretty(&hits)?);
        }
        Commands::Graph { path, note, depth } => {
            let session = open_vault(&path)?;
            let _ = rebuild_index(&session, &[])?;
            let cache = open_cache_for_session(&session)?;
            let graph = query_focused_graph(&cache, &session, note.as_deref(), depth, &[])?;
            println!("{}", serde_json::to_string_pretty(&graph)?);
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
            let outline: Vec<serde_json::Value> = document
                .markdown
                .lines()
                .enumerate()
                .filter_map(|(index, line)| {
                    let caps = regex::Regex::new(r"^(#+)\s+(.*)$").ok()?.captures(line)?;
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
            let mut command = std::process::Command::new(&pdf2zh);
            command.arg(&input).arg("-li").arg(&lang_in).arg("-lo").arg(&lang_out);
            if let Some(out) = output {
                command.arg("-o").arg(out);
            }
            let status = command.status().map_err(|error| {
                format!(
                    "pdf2zh was not found ({error}). Install PDFMathTranslate (pip install pdf2zh) or set SCRIPTOR_PDF2ZH_PATH."
                )
            })?;
            if !status.success() {
                std::process::exit(status.code().unwrap_or(1));
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
            };
            let output = run_export_job(input)?;
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Commands::GitStatus { path } => {
            let status = git_status(&path)?;
            println!("{}", serde_json::to_string_pretty(&status)?);
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

fn bench_scan(path: &PathBuf, iterations: u32) -> Result<BenchScanReport, Box<dyn std::error::Error>> {
    let session = open_vault(path)?;
    let mut samples = Vec::with_capacity(iterations as usize);
    let mut note_count = 0u32;

    for _ in 0..iterations {
        let started = Instant::now();
        let entries = scan_vault(&session.root)?;
        samples.push(started.elapsed().as_millis() as u64);
        note_count = entries
            .iter()
            .filter(|entry| entry.kind == ScannedEntryKind::Note)
            .count() as u32;
    }

    let sum: u64 = samples.iter().sum();
    let mean_ms = sum as f64 / samples.len() as f64;
    let min_ms = *samples.iter().min().unwrap_or(&0);
    let max_ms = *samples.iter().max().unwrap_or(&0);

    Ok(BenchScanReport {
        scenario: "vault-scan",
        vault_path: path.display().to_string(),
        iterations,
        note_count,
        mean_ms,
        min_ms,
        max_ms,
        budget_ms: VAULT_SCAN_BUDGET_MS,
        within_budget: mean_ms <= VAULT_SCAN_BUDGET_MS as f64,
    })
}

fn bench_search(
    path: &PathBuf,
    query: &str,
    iterations: u32,
) -> Result<BenchSearchReport, Box<dyn std::error::Error>> {
    let session = open_vault(path)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let note_count = scan_vault(&session.root)?
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .count() as u32;

    let mut samples = Vec::with_capacity(iterations as usize);
    let mut hit_count = 0u32;

    for _ in 0..iterations {
        let started = Instant::now();
        let hits = search_notes(&cache, &session.descriptor.id, query, 25)?;
        samples.push(started.elapsed().as_millis() as u64);
        hit_count = hits.len() as u32;
    }

    let sum: u64 = samples.iter().sum();
    let mean_ms = sum as f64 / samples.len() as f64;
    let min_ms = *samples.iter().min().unwrap_or(&0);
    let max_ms = *samples.iter().max().unwrap_or(&0);

    Ok(BenchSearchReport {
        scenario: "warm-search",
        vault_path: path.display().to_string(),
        query: query.to_string(),
        iterations,
        note_count,
        hit_count,
        mean_ms,
        min_ms,
        max_ms,
        budget_ms: SEARCH_BUDGET_MS,
        within_budget: mean_ms <= SEARCH_BUDGET_MS as f64,
    })
}

#[derive(Debug, Serialize)]
struct GenerateVaultSummary {
    output: String,
    note_count: u32,
    prefix: String,
}

fn generate_vault(
    output: &PathBuf,
    count: u32,
    prefix: &str,
) -> Result<GenerateVaultSummary, Box<dyn std::error::Error>> {
    if output.exists() {
        return Err(format!("Output path already exists: {}", output.display()).into());
    }

    fs::create_dir_all(output.join(prefix))?;

    for index in 0..count {
        let stem = format!("note-{index:05}");
        let path = format!("{prefix}/{stem}.md");
        let previous = if index > 0 {
            format!("note-{:05}", index - 1)
        } else {
            String::new()
        };
        let next = if index + 1 < count {
            format!("note-{:05}", index + 1)
        } else {
            String::new()
        };

        let links = [
            if previous.is_empty() {
                None
            } else {
                Some(format!("- [[{previous}]]"))
            },
            if next.is_empty() {
                None
            } else {
                Some(format!("- [[{next}]]"))
            },
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join("\n");

        let body = format!(
            "# {stem}\n\nSynthetic note {index} for benchmark fixtures.\n\n## Links\n{links}\n"
        );
        fs::write(output.join(&path), body)?;
    }

    Ok(GenerateVaultSummary {
        output: output.display().to_string(),
        note_count: count,
        prefix: prefix.to_string(),
    })
}
