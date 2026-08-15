//! Canvas document command handlers (storage, hit-testing, templates, snapshots).

use std::path::PathBuf;

use scriptor_canvas_engine::{
    CanvasPoint, SnapshotFormat, apply_template_dry_run, bench_hit_test_frame,
    bench_snapshot_render, hit_test, list_documents as canvas_list_stored, list_templates,
    load_document as canvas_load_stored, load_document_file, query_blocks_in_bounds,
    save_document as canvas_save_stored, write_snapshot,
};
use scriptor_vault::open_vault;

use crate::command_line::exit_code;

type CommandResult = Result<(), Box<dyn std::error::Error>>;

pub(crate) fn run_list_documents(path: PathBuf) -> CommandResult {
    let session = open_vault(&path)?;
    let summaries = canvas_list_stored(session.root.root())?;
    println!("{}", serde_json::to_string_pretty(&summaries)?);
    Ok(())
}

pub(crate) fn run_save_document(path: PathBuf, file: PathBuf) -> CommandResult {
    let session = open_vault(&path)?;
    let document = load_document_file(&file)?;
    let saved = canvas_save_stored(session.root.root(), &document)?;
    println!(
        "{}",
        serde_json::to_string_pretty(&saved.display().to_string())?
    );
    Ok(())
}

pub(crate) fn run_load_document(path: PathBuf, id: String) -> CommandResult {
    let session = open_vault(&path)?;
    let document = canvas_load_stored(session.root.root(), &id)?;
    println!("{}", serde_json::to_string_pretty(&document)?);
    Ok(())
}

pub(crate) fn run_hit_test(file: PathBuf, x: f64, y: f64) -> CommandResult {
    let document = load_document_file(&file)?;
    let hit = hit_test(&document, CanvasPoint { x, y });
    println!("{}", serde_json::to_string_pretty(&hit)?);
    Ok(())
}

pub(crate) fn run_query(file: PathBuf, x: f64, y: f64, width: f64, height: f64) -> CommandResult {
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
    Ok(())
}

pub(crate) fn run_template_dry_run(file: PathBuf, template: String) -> CommandResult {
    let document = load_document_file(&file)?;
    let preview = apply_template_dry_run(&document, &template)?;
    println!("{}", serde_json::to_string_pretty(&preview)?);
    Ok(())
}

pub(crate) fn run_templates() -> CommandResult {
    println!("{}", serde_json::to_string_pretty(&list_templates())?);
    Ok(())
}

pub(crate) fn run_snapshot(
    file: PathBuf,
    format: String,
    output: PathBuf,
    dry_run: bool,
) -> CommandResult {
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
    Ok(())
}

pub(crate) fn run_bench_hit_test(file: PathBuf, iterations: u32) -> CommandResult {
    let document = load_document_file(&file)?;
    let report = bench_hit_test_frame(&document, iterations);
    println!("{}", serde_json::to_string_pretty(&report)?);
    if !report.within_budget {
        std::process::exit(exit_code::BUDGET_EXCEEDED);
    }
    Ok(())
}

pub(crate) fn run_bench_snapshot(file: PathBuf, iterations: u32) -> CommandResult {
    let document = load_document_file(&file)?;
    let report = bench_snapshot_render(&document, iterations);
    println!("{}", serde_json::to_string_pretty(&report)?);
    if !report.within_budget {
        std::process::exit(exit_code::BUDGET_EXCEEDED);
    }
    Ok(())
}
