use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use std::process::Command;

#[derive(Parser)]
#[command(name = "xtask", about = "Cross-platform project automation")]
struct Cli {
    #[command(subcommand)]
    command: CommandKind,
}

#[derive(Subcommand)]
enum CommandKind {
    /// Build workspace, run cargo test, run pnpm build
    ReleaseSmoke,
    /// Run benchmark scripts and compare against baselines
    PerfGate,
    /// Build Docker image and run smoke test
    ContainerSmoke,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        CommandKind::ReleaseSmoke => release_smoke()?,
        CommandKind::PerfGate => perf_gate()?,
        CommandKind::ContainerSmoke => container_smoke()?,
    }
    Ok(())
}

fn run(name: &str, args: &[&str]) -> Result<()> {
    println!("==> {name} {}", args.join(" "));
    let status = Command::new(name)
        .args(args)
        .status()
        .with_context(|| format!("failed to run {name}"))?;
    if !status.success() {
        bail!("{name} exited with {status}");
    }
    Ok(())
}

fn run_capture(name: &str, args: &[&str]) -> Result<String> {
    let output = Command::new(name)
        .args(args)
        .output()
        .with_context(|| format!("failed to run {name}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("{name} exited with {}: {stderr}", output.status);
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn cargo(args: &[&str]) -> Result<()> {
    run("cargo", args)
}

fn pnpm(args: &[&str]) -> Result<()> {
    run("pnpm", args)
}

fn release_smoke() -> Result<()> {
    cargo(&["build", "--workspace"])?;
    cargo(&["test", "--workspace", "--exclude", "scriptor-desktop"])?;
    pnpm(&["build"])?;
    println!("Release smoke passed.");
    Ok(())
}

fn perf_gate() -> Result<()> {
    let baselines = load_baselines()?;

    println!("==> Running vault scan benchmark");
    let scan_out = run_capture(
        "cargo",
        &[
            "run",
            "-p",
            "scriptor-cli",
            "--",
            "bench-scan",
            "packages/test-fixtures/vaults/minimal",
            "--iterations",
            "3",
        ],
    )?;
    let scan_ms = parse_mean_ms(&scan_out).unwrap_or(0.0);
    check_threshold("vault_scan", scan_ms, baselines.vault_scan_1k_ms)?;

    println!("==> Running search benchmark");
    let search_out = run_capture(
        "cargo",
        &[
            "run",
            "-p",
            "scriptor-cli",
            "--",
            "bench-search",
            "packages/test-fixtures/vaults/minimal",
            "Research",
            "--iterations",
            "3",
        ],
    )?;
    let search_ms = parse_mean_ms(&search_out).unwrap_or(0.0);
    check_threshold("search", search_ms, baselines.search_1k_ms)?;

    println!("Performance gates passed.");
    Ok(())
}

fn container_smoke() -> Result<()> {
    run(
        "docker",
        &["build", "-t", "scriptor-smoke", "."],
    )?;
    run(
        "docker",
        &[
            "run",
            "--rm",
            "scriptor-smoke",
            "bash",
            "-lc",
            "pnpm build && cargo run -p scriptor-cli -- system-info",
        ],
    )?;
    println!("Container smoke passed.");
    Ok(())
}

struct Baselines {
    vault_scan_1k_ms: f64,
    search_1k_ms: f64,
}

fn load_baselines() -> Result<Baselines> {
    let raw = std::fs::read_to_string("perf-baselines.json")
        .context("read perf-baselines.json")?;
    let v: serde_json::Value = serde_json::from_str(&raw).context("parse perf-baselines.json")?;
    Ok(Baselines {
        vault_scan_1k_ms: v["vault_scan_1k_ms"].as_f64().unwrap_or(500.0),
        search_1k_ms: v["search_1k_ms"].as_f64().unwrap_or(100.0),
    })
}

fn parse_mean_ms(output: &str) -> Option<f64> {
    for line in output.lines() {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(m) = v.get("mean_ms").and_then(|v| v.as_f64()) {
                return Some(m);
            }
        }
    }
    None
}

fn check_threshold(name: &str, measured: f64, baseline: f64) -> Result<()> {
    let limit = baseline * 1.15;
    if measured > limit {
        bail!(
            "{name} regression: {measured:.1}ms exceeds baseline {baseline:.1}ms (>15%)"
        );
    }
    println!("  {name}: {measured:.1}ms (baseline {baseline:.1}ms) OK");
    Ok(())
}
