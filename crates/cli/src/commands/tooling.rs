//! Environment, daemon, export, benchmark, and completion command handlers.

use std::path::PathBuf;
use std::time::Duration;

use clap::CommandFactory;
use scriptor_export_runner::{
    ExportJobInput, default_export_directory, discover_pandoc, run_export_job,
};
use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, detect_system_info, run_process};
use scriptor_vault::{RelativeVaultPath, open_vault, read_note};

use crate::bench::{bench_scan, bench_search, generate_vault};
use crate::command_line::{Cli, DaemonCommands, exit_code};
use crate::{daemon_client, doctor, tui};

type CommandResult = Result<(), Box<dyn std::error::Error>>;

pub(crate) fn run_system_info() -> CommandResult {
    println!("{}", serde_json::to_string_pretty(&detect_system_info())?);
    Ok(())
}

pub(crate) fn run_tui(path: PathBuf, smoke_test: bool, in_process: bool) -> CommandResult {
    if smoke_test {
        tui::smoke_test(path, !in_process)?;
    } else {
        tui::run(path, !in_process)?;
    }
    Ok(())
}

pub(crate) fn run_daemon(command: DaemonCommands) -> CommandResult {
    match command {
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
    Ok(())
}

pub(crate) fn run_bench_scan(path: PathBuf, iterations: u32) -> CommandResult {
    let report = bench_scan(&path, iterations)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    if !report.within_budget {
        std::process::exit(exit_code::BUDGET_EXCEEDED);
    }
    Ok(())
}

pub(crate) fn run_bench_search(path: PathBuf, query: String, iterations: u32) -> CommandResult {
    let report = bench_search(&path, &query, iterations)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    if !report.within_budget {
        std::process::exit(exit_code::BUDGET_EXCEEDED);
    }
    Ok(())
}

pub(crate) fn run_generate_vault(output: PathBuf, count: u32, prefix: String) -> CommandResult {
    let summary = generate_vault(&output, count, &prefix)?;
    println!("{}", serde_json::to_string_pretty(&summary)?);
    Ok(())
}

pub(crate) fn run_export_discover() -> CommandResult {
    let discovery = discover_pandoc()?;
    println!("{}", serde_json::to_string_pretty(&discovery)?);
    Ok(())
}

pub(crate) fn run_completions(shell: clap_complete::Shell) -> CommandResult {
    let mut command = Cli::command();
    let name = command.get_name().to_string();
    clap_complete::generate(shell, &mut command, name, &mut std::io::stdout());
    Ok(())
}

pub(crate) fn run_doctor(path: Option<PathBuf>) -> CommandResult {
    let report = doctor::run(path.as_deref());
    println!("{}", serde_json::to_string_pretty(&report)?);
    if !report.healthy {
        std::process::exit(exit_code::DOCTOR_FAILED);
    }
    Ok(())
}

pub(crate) fn run_export(
    path: PathBuf,
    note: String,
    format: String,
    dry_run: bool,
    extra_arg: Vec<String>,
    output_subdir: Option<String>,
) -> CommandResult {
    let session = open_vault(&path)?;
    let relative = RelativeVaultPath::parse(&note)?;
    let document = read_note(&session.descriptor.id, &session.root, &relative)?;
    let stem = note
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or("note");
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
        redact_secrets: false,
    };
    let output = run_export_job(input)?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub(crate) fn run_pdf_translate(
    input: PathBuf,
    lang_in: String,
    lang_out: String,
    output: Option<PathBuf>,
) -> CommandResult {
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
    Ok(())
}
