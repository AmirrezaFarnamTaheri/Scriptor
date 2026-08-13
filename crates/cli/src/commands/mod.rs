//! Command dispatch: maps parsed `Commands` variants onto per-domain handlers.

use scriptor_ipc::{RpcResponse, RpcResult};

use crate::command_line::{Cli, Commands};

pub(crate) mod canvas;
pub(crate) mod clip;
pub(crate) mod git_ops;
pub(crate) mod indexing;
pub(crate) mod tooling;
pub(crate) mod vault;

type CommandResult = Result<(), Box<dyn std::error::Error>>;

/// Print a successful daemon payload as pretty JSON, or surface its error.
pub(crate) fn print_rpc_response(response: &RpcResponse) -> CommandResult {
    match &response.result {
        RpcResult::Ok(payload) => {
            println!("{}", serde_json::to_string_pretty(payload)?);
            Ok(())
        }
        RpcResult::Error(error) => Err(error.to_string().into()),
        RpcResult::Err(message) => Err(message.clone().into()),
    }
}

/// Execute the parsed CLI invocation.
pub(crate) fn dispatch(cli: Cli) -> CommandResult {
    let in_process = cli.in_process;
    match cli.command {
        Commands::SystemInfo => tooling::run_system_info(),
        Commands::CanvasListDocuments { path } => canvas::run_list_documents(path),
        Commands::CanvasSaveDocument { path, file } => canvas::run_save_document(path, file),
        Commands::CanvasLoadDocument { path, id } => canvas::run_load_document(path, id),
        Commands::Open { path } => vault::run_open(path),
        Commands::Scan { path } => vault::run_scan(path),
        Commands::Read { path, note } => vault::run_read(path, note),
        Commands::Tui {
            path,
            smoke_test,
            in_process: command_in_process,
        } => tooling::run_tui(path, smoke_test, in_process || command_in_process),
        Commands::Daemon { command } => tooling::run_daemon(command),
        Commands::RebuildIndex { path } => indexing::run_rebuild_index(path, in_process),
        Commands::Health { path } => indexing::run_health(path, in_process),
        Commands::HealthDiagnostics { path } => indexing::run_health_diagnostics(path, in_process),
        Commands::Lint {
            path,
            fix,
            rules,
            format,
        } => vault::run_lint(path, fix, rules, format),
        Commands::Search { path, query, limit } => {
            indexing::run_search(path, query, limit, in_process)
        }
        Commands::Backlinks { path, note } => indexing::run_backlinks(path, note, in_process),
        Commands::Graph { path, note, depth } => indexing::run_graph(path, note, depth, in_process),
        Commands::Grep {
            path,
            pattern,
            limit,
        } => vault::run_grep(path, pattern, limit),
        Commands::Outline { path, note } => vault::run_outline(path, note),
        Commands::Note {
            path,
            file,
            title,
            body,
            dry_run,
        } => vault::run_note(path, file, title, body, dry_run),
        Commands::TraverseGraph { path, note, depth } => {
            indexing::run_traverse_graph(path, note, depth, in_process)
        }
        Commands::TextBundleExport { path, note, output } => {
            vault::run_text_bundle_export(path, note, output)
        }
        Commands::Publish { path, output } => vault::run_publish(path, output),
        Commands::GitResolveConflict {
            path,
            file,
            strategy,
        } => git_ops::run_resolve_conflict(path, file, strategy),
        Commands::RenameDryRun {
            path,
            from,
            to,
            update_links,
        } => vault::run_rename_dry_run(path, from, to, update_links),
        Commands::RenameApply {
            path,
            from,
            to,
            update_links,
        } => vault::run_rename_apply(path, from, to, update_links),
        Commands::BenchScan { path, iterations } => tooling::run_bench_scan(path, iterations),
        Commands::BenchSearch {
            path,
            query,
            iterations,
        } => tooling::run_bench_search(path, query, iterations),
        Commands::GenerateVault {
            output,
            count,
            prefix,
        } => tooling::run_generate_vault(output, count, prefix),
        Commands::ExportDiscover => tooling::run_export_discover(),
        Commands::PdfTranslate {
            input,
            lang_in,
            lang_out,
            output,
        } => tooling::run_pdf_translate(input, lang_in, lang_out, output),
        Commands::Export {
            path,
            note,
            format,
            dry_run,
            extra_arg,
            output_subdir,
        } => tooling::run_export(path, note, format, dry_run, extra_arg, output_subdir),
        Commands::GitStatus { path } => git_ops::run_status(path, in_process),
        Commands::GitCommit {
            path,
            message,
            file,
        } => git_ops::run_commit(path, message, file),
        Commands::GitPull { path } => git_ops::run_pull(path),
        Commands::GitPush { path } => git_ops::run_push(path),
        Commands::CanvasHitTest { file, x, y } => canvas::run_hit_test(file, x, y),
        Commands::CanvasQuery {
            file,
            x,
            y,
            width,
            height,
        } => canvas::run_query(file, x, y, width, height),
        Commands::CanvasTemplateDryRun { file, template } => {
            canvas::run_template_dry_run(file, template)
        }
        Commands::CanvasTemplates => canvas::run_templates(),
        Commands::CanvasSnapshot {
            file,
            format,
            output,
            dry_run,
        } => canvas::run_snapshot(file, format, output, dry_run),
        Commands::BenchCanvasHitTest { file, iterations } => {
            canvas::run_bench_hit_test(file, iterations)
        }
        Commands::BenchCanvasSnapshot { file, iterations } => {
            canvas::run_bench_snapshot(file, iterations)
        }
        Commands::Completions { shell } => tooling::run_completions(shell),
        Commands::Doctor { path } => tooling::run_doctor(path),
        Commands::Clip {
            url,
            path,
            folder,
            filename,
            dry_run,
        } => clip::run_clip(url, path, folder, filename, dry_run),
    }
}
