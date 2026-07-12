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
    cargo(&["build", "--workspace", "--exclude", "scriptor-desktop"])?;
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
    let scan_ms = parse_mean_ms(&scan_out)?;
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
    let search_ms = parse_mean_ms(&search_out)?;
    check_threshold("search", search_ms, baselines.search_1k_ms)?;

    println!("Performance gates passed.");
    Ok(())
}

fn container_smoke() -> Result<()> {
    run(
        "docker",
        &["build", "-t", "scriptor-smoke", "."],
    )?;

    #[cfg(windows)]
    let (shell_cmd, shell_arg) = ("cmd", "/C");
    #[cfg(not(windows))]
    let (shell_cmd, shell_arg) = ("bash", "-lc");

    run(
        "docker",
        &[
            "run",
            "--rm",
            "scriptor-smoke",
            shell_cmd,
            shell_arg,
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

fn parse_mean_ms(output: &str) -> Result<f64> {
    for line in output.lines() {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(m) = v.get("mean_ms").and_then(|v| v.as_f64()) {
                return Ok(m);
            }
        }
    }
    bail!("could not parse mean_ms from benchmark output")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_mean_ms_extracts_value() {
        let output = "some noise\n{\"mean_ms\": 42.5, \"other\": 1}\n";
        assert_eq!(parse_mean_ms(output).unwrap(), 42.5);
    }

    #[test]
    fn parse_mean_ms_returns_err_for_empty() {
        assert!(parse_mean_ms("").is_err());
        assert!(parse_mean_ms("no json here\n").is_err());
    }

    #[test]
    fn parse_mean_ms_errs_lines_without_mean_ms() {
        let output = "{\"foo\": 1}\n{\"bar\": 2}\n";
        assert!(parse_mean_ms(output).is_err());
    }

    #[test]
    fn check_threshold_passes_within_limit() {
        let result = check_threshold("test", 100.0, 100.0);
        assert!(result.is_ok());
    }

    #[test]
    fn check_threshold_passes_at_exactly_115_percent() {
        let baseline = 100.0;
        let limit = baseline * 1.15;
        let result = check_threshold("test", limit, baseline);
        assert!(result.is_ok());
    }

    #[test]
    fn check_threshold_fails_above_115_percent() {
        let result = check_threshold("test", 116.0, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn check_threshold_fails_well_above_baseline() {
        let result = check_threshold("regression", 200.0, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn check_threshold_passes_below_baseline() {
        let result = check_threshold("fast", 50.0, 100.0);
        assert!(result.is_ok());
    }

    #[test]
    fn parse_mean_ms_picks_first_mean_ms() {
        let output = "{\"mean_ms\": 10.0}\n{\"mean_ms\": 20.0}\n";
        assert_eq!(parse_mean_ms(output).unwrap(), 10.0);
    }

    #[test]
    fn parse_mean_ms_handles_non_numeric_mean_ms() {
        let output = "{\"mean_ms\": \"not_a_number\"}\n";
        assert!(parse_mean_ms(output).is_err());
    }

    #[test]
    fn check_threshold_at_zero_baseline_passes() {
        let result = check_threshold("zero", 0.0, 0.0);
        assert!(result.is_ok());
    }
}
