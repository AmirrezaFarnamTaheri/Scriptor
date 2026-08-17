use std::fs;
use std::io::{self, Read};
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

use crate::error::ExportError;

/// Wall-clock budget for a single diagram render. A pathological diagram (or a
/// renderer that waits on stdin) must never hang the whole export job.
pub(crate) const DIAGRAM_TIMEOUT: Duration = Duration::from_secs(60);

/// Budget for the cheap `which`/`where` PATH probe.
const WHICH_TIMEOUT: Duration = Duration::from_secs(10);

/// How often the timeout loop polls the child.
const POLL_INTERVAL: Duration = Duration::from_millis(25);

/// Run `command` to completion, capturing stdout/stderr, but kill it if it
/// outlives `timeout`.
///
/// `Command::output()` waits forever; every diagram engine below goes through
/// this helper instead so a wedged subprocess surfaces as a `TimedOut` error.
fn output_with_timeout(command: &mut Command, timeout: Duration) -> io::Result<Output> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // Drain both pipes concurrently: polling try_wait() while the child fills
    // the pipe buffer would deadlock exactly like a plain wait() would.
    let stdout_reader = child.stdout.take().map(|mut pipe| {
        std::thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = pipe.read_to_end(&mut buffer);
            buffer
        })
    });
    let stderr_reader = child.stderr.take().map(|mut pipe| {
        std::thread::spawn(move || {
            let mut buffer = Vec::new();
            let _ = pipe.read_to_end(&mut buffer);
            buffer
        })
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait()? {
            Some(status) => break status,
            None => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        format!("process exceeded {}s timeout", timeout.as_secs()),
                    ));
                }
                std::thread::sleep(POLL_INTERVAL);
            }
        }
    };

    let stdout = stdout_reader
        .map(|handle| handle.join().unwrap_or_default())
        .unwrap_or_default();
    let stderr = stderr_reader
        .map(|handle| handle.join().unwrap_or_default())
        .unwrap_or_default();

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

/// Render a Mermaid diagram source to SVG using `mmdc` (mermaid-cli).
/// Returns the SVG string, or falls back to a placeholder if `mmdc` is not on PATH.
pub fn render_mermaid_svg(source: &str) -> Result<String, ExportError> {
    let start = Instant::now();

    let mmdc = which_binary("mmdc");
    let Some(mmdc_path) = mmdc else {
        log::warn!("mmdc (mermaid-cli) not found on PATH; using placeholder SVG");
        return Ok(placeholder_svg("Mermaid diagram", source));
    };

    let temp_dir = std::env::temp_dir().join(format!("scriptor-mermaid-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|source_err| ExportError::Io {
        path: temp_dir.clone(),
        source: source_err,
    })?;

    let input_path = temp_dir.join("diagram.mmd");
    fs::write(&input_path, source).map_err(|source_err| ExportError::Io {
        path: input_path.clone(),
        source: source_err,
    })?;

    let output_path = temp_dir.join("diagram.svg");

    let result = output_with_timeout(
        // PROCESS_BROKER_EXCEPTION(mermaid-cli-render)
        Command::new(&mmdc_path).args([
            "-i",
            &input_path.display().to_string(),
            "-o",
            &output_path.display().to_string(),
            "--quiet",
        ]),
        DIAGRAM_TIMEOUT,
    );

    // The rendered SVG lives *inside* `temp_dir`, so it has to be read before
    // the directory is removed -- reading afterwards made the success arm dead
    // code and turned every diagram into a placeholder.
    let rendered = collect_rendered_svg(result, &output_path);
    let _ = fs::remove_dir_all(&temp_dir);

    match rendered {
        Ok(svg) => {
            log::info!(
                "Mermaid rendered in {}ms via mmdc",
                start.elapsed().as_millis()
            );
            Ok(svg)
        }
        Err(reason) => {
            log::warn!("mmdc failed: {reason}; using placeholder SVG");
            Ok(placeholder_svg("Mermaid diagram", source))
        }
    }
}

/// Turn a finished subprocess run into the SVG it produced.
///
/// Split out from [`render_mermaid_svg`] so the read-before-cleanup ordering is
/// directly testable without a real `mmdc` install.
fn collect_rendered_svg(result: io::Result<Output>, output_path: &Path) -> Result<String, String> {
    match result {
        Ok(output) => svg_from_run(
            output.status.success(),
            &String::from_utf8_lossy(&output.stderr),
            output_path,
        ),
        Err(error) => Err(format!("failed to run renderer: {error}")),
    }
}

fn svg_from_run(success: bool, stderr: &str, output_path: &Path) -> Result<String, String> {
    if !success {
        return Err(format!("renderer exited non-zero: {stderr}"));
    }
    fs::read_to_string(output_path).map_err(|error| {
        format!(
            "renderer produced no readable SVG at {}: {error}",
            output_path.display()
        )
    })
}

/// Render a PlantUML diagram source to SVG using the `plantuml` CLI.
/// Resolution order mirrors the daemon: `PLANTUML_BIN` env, `PLANTUML_JAR` + java, bare `plantuml`.
///
/// An explicitly configured engine (`PLANTUML_BIN` / `PLANTUML_JAR`) that is
/// missing or fails is a hard error: silently falling through to a different
/// engine would ignore the operator's configuration. Only the implicit
/// PATH-discovery path degrades to a placeholder.
pub fn render_plantuml_svg(source: &str) -> Result<String, ExportError> {
    let start = Instant::now();

    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|source_err| ExportError::Io {
        path: temp_dir.clone(),
        source: source_err,
    })?;

    let input_path = temp_dir.join("diagram.puml");
    fs::write(&input_path, source).map_err(|source_err| ExportError::Io {
        path: input_path.clone(),
        source: source_err,
    })?;

    let svg_path = temp_dir.join("diagram.svg");

    let result = run_plantuml_engine(&input_path, &svg_path);
    let _ = fs::remove_dir_all(&temp_dir);

    match result {
        Ok(svg) => {
            log::info!("PlantUML rendered in {}ms", start.elapsed().as_millis());
            Ok(svg)
        }
        Err(EngineError::Configured(message)) => Err(ExportError::Process(format!(
            "PlantUML rendering failed: {message}"
        ))),
        Err(EngineError::Discovered(message)) => {
            log::warn!("PlantUML rendering failed: {message}; using placeholder SVG");
            Ok(placeholder_svg("PlantUML diagram", source))
        }
    }
}

/// Why a PlantUML engine run failed, and whether the operator asked for it.
#[derive(Debug)]
pub(crate) enum EngineError {
    /// An explicitly configured engine failed: do not fall back.
    Configured(String),
    /// The implicitly discovered engine failed: a placeholder is acceptable.
    Discovered(String),
}

fn run_plantuml_engine(input_path: &Path, svg_path: &Path) -> Result<String, EngineError> {
    let bin = std::env::var("PLANTUML_BIN").ok();
    let jar = std::env::var("PLANTUML_JAR").ok();
    run_plantuml_engine_with(bin.as_deref(), jar.as_deref(), input_path, svg_path)
}

/// Engine resolution with the configuration passed in explicitly, so tests do
/// not have to mutate process-global environment variables.
pub(crate) fn run_plantuml_engine_with(
    plantuml_bin: Option<&str>,
    plantuml_jar: Option<&str>,
    input_path: &Path,
    svg_path: &Path,
) -> Result<String, EngineError> {
    if let Some(path) = plantuml_bin.filter(|value| !value.is_empty()) {
        let binary = std::path::PathBuf::from(path);
        validate_binary_path(&binary, "PLANTUML_BIN").map_err(EngineError::Configured)?;
        let output = output_with_timeout(
            // PROCESS_BROKER_EXCEPTION(plantuml-configured-binary)
            Command::new(&binary).args(["-tsvg", &input_path.display().to_string()]),
            DIAGRAM_TIMEOUT,
        )
        .map_err(|error| EngineError::Configured(error.to_string()))?;
        if !output.status.success() {
            return Err(EngineError::Configured(format!(
                "PLANTUML_BIN exited non-zero: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        return fs::read_to_string(svg_path)
            .map_err(|error| EngineError::Configured(error.to_string()));
    }

    if let Some(jar) = plantuml_jar.filter(|value| !value.is_empty()) {
        validate_binary_path(Path::new(jar), "PLANTUML_JAR").map_err(EngineError::Configured)?;
        let output = output_with_timeout(
            // PROCESS_BROKER_EXCEPTION(plantuml-jar-java)
            Command::new("java").args(["-jar", jar, "-tsvg", &input_path.display().to_string()]),
            DIAGRAM_TIMEOUT,
        )
        .map_err(|error| EngineError::Configured(error.to_string()))?;
        if !output.status.success() {
            return Err(EngineError::Configured(format!(
                "PLANTUML_JAR run exited non-zero: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        return fs::read_to_string(svg_path)
            .map_err(|error| EngineError::Configured(error.to_string()));
    }

    let output = output_with_timeout(
        // PROCESS_BROKER_EXCEPTION(plantuml-path-render)
        Command::new("plantuml").args(["-tsvg", &input_path.display().to_string()]),
        DIAGRAM_TIMEOUT,
    )
    .map_err(|error| EngineError::Discovered(error.to_string()))?;
    if !output.status.success() {
        return Err(EngineError::Discovered(format!(
            "PlantUML failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    fs::read_to_string(svg_path).map_err(|error| EngineError::Discovered(error.to_string()))
}

fn validate_binary_path(binary: &Path, env_var: &str) -> Result<(), String> {
    if !binary.exists() {
        return Err(format!(
            "{env_var} path does not exist: {}",
            binary.display()
        ));
    }
    if binary.is_dir() {
        return Err(format!(
            "{env_var} path is a directory, not a file: {}",
            binary.display()
        ));
    }
    let canonical = binary
        .canonicalize()
        .map_err(|e| format!("{env_var} path cannot be canonicalized: {e}"))?;
    if canonical.is_dir() {
        return Err(format!(
            "{env_var} resolved to a directory: {}",
            canonical.display()
        ));
    }
    Ok(())
}

fn which_binary(name: &str) -> Option<std::path::PathBuf> {
    if cfg!(windows) {
        // PROCESS_BROKER_EXCEPTION(diagram-discovery-windows)
        output_with_timeout(Command::new("where").arg(name), WHICH_TIMEOUT)
            .ok()
            .and_then(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| std::path::PathBuf::from(line.trim()))
            })
    } else {
        // PROCESS_BROKER_EXCEPTION(diagram-discovery-unix)
        output_with_timeout(Command::new("which").arg(name), WHICH_TIMEOUT)
            .ok()
            .and_then(|output| {
                let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if line.is_empty() {
                    None
                } else {
                    Some(std::path::PathBuf::from(line))
                }
            })
    }
}

fn placeholder_svg(title: &str, source: &str) -> String {
    let escaped = xml_escape(source);
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="24" y="36" font-family="Segoe UI, sans-serif" font-size="18" fill="#0f172a">{title}</text>
  <foreignObject x="24" y="56" width="912" height="460">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font:12px/1.5 ui-monospace, monospace; white-space:pre-wrap; color:#334155;">{escaped}</div>
  </foreignObject>
</svg>"##
    )
}

fn xml_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_svg_contains_source_text() {
        let svg = placeholder_svg("Mermaid diagram", "flowchart TD\n  A --> B");
        assert!(svg.contains("Mermaid diagram"));
        assert!(svg.contains("flowchart TD"));
        assert!(svg.contains("<svg"));
    }

    #[test]
    fn render_mermaid_svg_returns_svg_even_without_mmdc() {
        let svg = render_mermaid_svg("graph TD\n  A-->B").unwrap();
        assert!(svg.contains("<svg"));
    }

    #[test]
    fn render_plantuml_svg_returns_svg_even_without_engine() {
        let svg = render_plantuml_svg("@startuml\nA -> B\n@enduml").unwrap();
        assert!(svg.contains("<svg"));
    }

    /// The success arm must be reachable: a successful run whose SVG is read
    /// before cleanup yields the real SVG, not a placeholder.
    #[test]
    fn successful_run_yields_rendered_svg_before_cleanup() {
        let dir = tempfile::tempdir().expect("tempdir");
        let output_path = dir.path().join("diagram.svg");
        fs::write(&output_path, "<svg id=\"real\"></svg>").expect("write svg");

        let rendered = svg_from_run(true, "", &output_path);
        let _ = fs::remove_dir_all(dir.path());

        let svg = rendered.expect("success path must be reachable");
        assert!(svg.contains("id=\"real\""));
        assert!(
            !output_path.exists(),
            "cleanup still happens after the read"
        );
    }

    /// Reading after cleanup is exactly the bug that was fixed: assert the
    /// ordering matters so a regression cannot slip back in unnoticed.
    #[test]
    fn reading_after_cleanup_would_fail() {
        let dir = tempfile::tempdir().expect("tempdir");
        let output_path = dir.path().join("diagram.svg");
        fs::write(&output_path, "<svg/>").expect("write svg");
        let _ = fs::remove_dir_all(dir.path());

        assert!(svg_from_run(true, "", &output_path).is_err());
    }

    #[test]
    fn non_zero_exit_reports_stderr() {
        let dir = tempfile::tempdir().expect("tempdir");
        let error = svg_from_run(false, "boom", &dir.path().join("diagram.svg"))
            .expect_err("non-zero exit is a failure");
        assert!(error.contains("boom"));
    }

    #[test]
    fn spawn_failure_is_reported_not_panicked() {
        let dir = tempfile::tempdir().expect("tempdir");
        let result = collect_rendered_svg(
            Err(io::Error::new(io::ErrorKind::NotFound, "no such binary")),
            &dir.path().join("diagram.svg"),
        );
        assert!(
            result
                .expect_err("spawn failure")
                .contains("no such binary")
        );
    }

    #[test]
    fn configured_plantuml_bin_failure_does_not_fall_back() {
        let dir = tempfile::tempdir().expect("tempdir");
        let error = run_plantuml_engine_with(
            Some("/nonexistent/scriptor/plantuml"),
            None,
            &dir.path().join("diagram.puml"),
            &dir.path().join("diagram.svg"),
        )
        .expect_err("explicitly configured engine must not fall back");
        assert!(matches!(error, EngineError::Configured(_)), "got {error:?}");
    }

    #[test]
    fn configured_plantuml_jar_failure_does_not_fall_back() {
        let dir = tempfile::tempdir().expect("tempdir");
        let error = run_plantuml_engine_with(
            None,
            Some("/nonexistent/scriptor/plantuml.jar"),
            &dir.path().join("diagram.puml"),
            &dir.path().join("diagram.svg"),
        )
        .expect_err("explicitly configured jar must not fall back");
        assert!(matches!(error, EngineError::Configured(_)), "got {error:?}");
    }

    #[test]
    fn empty_configuration_falls_through_to_path_discovery() {
        let dir = tempfile::tempdir().expect("tempdir");
        let result = run_plantuml_engine_with(
            Some(""),
            Some(""),
            &dir.path().join("diagram.puml"),
            &dir.path().join("diagram.svg"),
        );
        // No plantuml on PATH in CI: the failure must be the degradable kind.
        if let Err(error) = result {
            assert!(matches!(error, EngineError::Discovered(_)), "got {error:?}");
        }
    }

    #[test]
    fn output_with_timeout_kills_a_hanging_child() {
        let mut command = if cfg!(windows) {
            // PROCESS_BROKER_EXCEPTION(diagram-timeout-test-windows-hang)
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "ping -n 30 127.0.0.1 > NUL"]);
            cmd
        } else {
            // PROCESS_BROKER_EXCEPTION(diagram-timeout-test-unix-hang)
            let mut cmd = Command::new("sleep");
            cmd.arg("30");
            cmd
        };
        let started = Instant::now();
        let error = output_with_timeout(&mut command, Duration::from_millis(200))
            .expect_err("hanging child must time out");
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
        assert!(
            started.elapsed() < Duration::from_secs(20),
            "timeout should fire promptly"
        );
    }

    #[test]
    fn output_with_timeout_returns_output_for_fast_child() {
        let mut command = if cfg!(windows) {
            // PROCESS_BROKER_EXCEPTION(diagram-timeout-test-windows-fast)
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "echo hi"]);
            cmd
        } else {
            // PROCESS_BROKER_EXCEPTION(diagram-timeout-test-unix-fast)
            let mut cmd = Command::new("echo");
            cmd.arg("hi");
            cmd
        };
        let output = output_with_timeout(&mut command, Duration::from_secs(30)).expect("ran");
        assert!(output.status.success());
        assert!(String::from_utf8_lossy(&output.stdout).contains("hi"));
    }
}
