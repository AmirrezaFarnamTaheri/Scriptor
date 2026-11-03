use std::fs;
use std::io;
use std::path::Path;
use std::time::{Duration, Instant};

use crate::error::ExportError;
use scriptor_system_bridge::{BridgeError, ProcessSpec, run_process};

/// Wall-clock budget for a single diagram render. A pathological diagram (or a
/// renderer that waits on stdin) must never hang the whole export job.
pub(crate) const DIAGRAM_TIMEOUT: Duration = Duration::from_secs(60);

/// Maximum bytes retained for each renderer output stream.
const MAX_DIAGRAM_OUTPUT_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug)]
struct DiagramOutput {
    success: bool,
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
}

/// Run a renderer through the shared process broker. The broker owns process
/// groups, bounded pipe draining, timeout handling and descendant termination.
fn output_with_timeout(spec: ProcessSpec) -> io::Result<DiagramOutput> {
    let receipt = run_process(spec.max_output_bytes(MAX_DIAGRAM_OUTPUT_BYTES)).map_err(
        |error| match error {
            BridgeError::ProcessTimeout {
                program,
                timeout_ms,
                stdout,
                stderr,
            } => io::Error::new(
                io::ErrorKind::TimedOut,
                format!(
                    "process {} timed out after {}ms\nstdout: {}\nstderr: {}",
                    program.display(),
                    timeout_ms,
                    stdout,
                    stderr
                ),
            ),
            other => io::Error::other(other.to_string()),
        },
    )?;

    Ok(DiagramOutput {
        success: receipt.exit_code == 0,
        stdout: receipt.stdout,
        stderr: receipt.stderr,
        stdout_truncated: receipt.stdout_truncated,
        stderr_truncated: receipt.stderr_truncated,
    })
}

fn diagnostic_output(output: &DiagramOutput) -> String {
    let mut diagnostic = String::new();
    if !output.stdout.is_empty() {
        diagnostic.push_str("stdout: ");
        diagnostic.push_str(&output.stdout);
    }
    if !output.stderr.is_empty() {
        if !diagnostic.is_empty() {
            diagnostic.push('\n');
        }
        diagnostic.push_str("stderr: ");
        diagnostic.push_str(&output.stderr);
    }
    if output.stdout_truncated {
        diagnostic.push_str(&format!(
            "\n[stdout truncated after {} bytes]",
            MAX_DIAGRAM_OUTPUT_BYTES
        ));
    }
    if output.stderr_truncated {
        diagnostic.push_str(&format!(
            "\n[stderr truncated after {} bytes]",
            MAX_DIAGRAM_OUTPUT_BYTES
        ));
    }
    diagnostic
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

    let mut spec = ProcessSpec::new(&mmdc_path)
        .arg("-i")
        .arg(input_path.as_os_str())
        .arg("-o")
        .arg(output_path.as_os_str())
        .arg("--quiet")
        .timeout(DIAGRAM_TIMEOUT);
    // Puppeteer uses these two documented environment settings to select a
    // browser binary and cache without inheriting unrelated parent variables.
    for name in ["PUPPETEER_EXECUTABLE_PATH", "PUPPETEER_CACHE_DIR"] {
        if let Some(value) = std::env::var_os(name) {
            spec = spec.env(name, value);
        }
    }
    let result = output_with_timeout(spec);

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
fn collect_rendered_svg(
    result: io::Result<DiagramOutput>,
    output_path: &Path,
) -> Result<String, String> {
    match result {
        Ok(output) => {
            let diagnostic = diagnostic_output(&output);
            svg_from_run(output.success, &diagnostic, output_path)
        }
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
            ProcessSpec::new(&binary)
                .arg("-tsvg")
                .arg(input_path.as_os_str())
                .timeout(DIAGRAM_TIMEOUT),
        )
        .map_err(|error| EngineError::Configured(error.to_string()))?;
        if !output.success {
            return Err(EngineError::Configured(format!(
                "PLANTUML_BIN exited non-zero: {}",
                diagnostic_output(&output)
            )));
        }
        return fs::read_to_string(svg_path)
            .map_err(|error| EngineError::Configured(error.to_string()));
    }

    if let Some(jar) = plantuml_jar.filter(|value| !value.is_empty()) {
        validate_binary_path(Path::new(jar), "PLANTUML_JAR").map_err(EngineError::Configured)?;
        let output = output_with_timeout(
            ProcessSpec::new("java")
                .args(["-jar", jar, "-tsvg"])
                .arg(input_path.as_os_str())
                .timeout(DIAGRAM_TIMEOUT),
        )
        .map_err(|error| EngineError::Configured(error.to_string()))?;
        if !output.success {
            return Err(EngineError::Configured(format!(
                "PLANTUML_JAR run exited non-zero: {}",
                diagnostic_output(&output)
            )));
        }
        return fs::read_to_string(svg_path)
            .map_err(|error| EngineError::Configured(error.to_string()));
    }

    let output = output_with_timeout(
        ProcessSpec::new("plantuml")
            .arg("-tsvg")
            .arg(input_path.as_os_str())
            .timeout(DIAGRAM_TIMEOUT),
    )
    .map_err(|error| EngineError::Discovered(error.to_string()))?;
    if !output.success {
        return Err(EngineError::Discovered(format!(
            "PlantUML failed: {}",
            diagnostic_output(&output)
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
    let path_var = std::env::var_os("PATH")?;

    #[cfg(windows)]
    {
        let pathext_var =
            std::env::var_os("PATHEXT").unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".into());
        let pathexts: Vec<String> = std::env::split_paths(&pathext_var)
            .filter_map(|path| path.to_str().map(|value| value.to_ascii_lowercase()))
            .collect();
        let has_ext = Path::new(name).extension().is_some();

        for directory in std::env::split_paths(&path_var) {
            if has_ext {
                let candidate = directory.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            } else {
                for extension in &pathexts {
                    let candidate = directory.join(format!("{name}{extension}"));
                    if candidate.is_file() {
                        return Some(candidate);
                    }
                }
                let candidate = directory.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for directory in std::env::split_paths(&path_var) {
            let candidate = directory.join(name);
            if candidate.is_file()
                && candidate
                    .metadata()
                    .is_ok_and(|metadata| metadata.permissions().mode() & 0o111 != 0)
            {
                return Some(candidate);
            }
        }
    }

    #[cfg(not(any(windows, unix)))]
    {
        for directory in std::env::split_paths(&path_var) {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
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

    #[cfg(unix)]
    #[test]
    fn timed_out_diagram_renderer_must_stop_its_background_writer() {
        let directory = tempfile::tempdir().expect("isolated diagram timeout fixture");
        let heartbeat = directory.path().join("diagram-heartbeat");
        let script = r#"sh -c 'while :; do printf x >> "$SCRIPTOR_DIAGRAM_HEARTBEAT"; sleep 0.05; done' & wait"#;
        let result = output_with_timeout(
            ProcessSpec::new("sh")
                .args(["-c", script])
                .env("SCRIPTOR_DIAGRAM_HEARTBEAT", heartbeat.as_os_str())
                .timeout(Duration::from_millis(900)),
        );
        let first = fs::metadata(&heartbeat).map(|meta| meta.len()).unwrap_or(0);
        std::thread::sleep(Duration::from_millis(300));
        let second = fs::metadata(&heartbeat).map(|meta| meta.len()).unwrap_or(0);

        let error = result.expect_err("diagram renderer and descendants must time out");
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
        assert!(first > 0, "background writer did not start in the fixture");
        assert_eq!(
            first, second,
            "a renderer descendant kept writing after broker timeout returned",
        );
    }

    #[test]
    fn output_with_timeout_kills_a_hanging_child() {
        let spec = if cfg!(windows) {
            ProcessSpec::new("cmd")
                .args(["/C", "ping -n 30 127.0.0.1 > NUL"])
                .timeout(Duration::from_millis(200))
        } else {
            ProcessSpec::new("sleep")
                .arg("30")
                .timeout(Duration::from_millis(200))
        };
        let started = Instant::now();
        let error = output_with_timeout(spec).expect_err("hanging child must time out");
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
        assert!(
            started.elapsed() < Duration::from_secs(20),
            "timeout should fire promptly"
        );
    }

    #[test]
    fn output_with_timeout_returns_output_for_fast_child() {
        let spec = if cfg!(windows) {
            ProcessSpec::new("cmd")
                .args(["/C", "echo hi"])
                .timeout(Duration::from_secs(30))
        } else {
            ProcessSpec::new("echo")
                .arg("hi")
                .timeout(Duration::from_secs(30))
        };
        let output = output_with_timeout(spec).expect("ran");
        assert!(output.success);
        assert!(output.stdout.contains("hi"));
    }

    #[test]
    fn diagnostic_output_reports_captured_streams_and_truncation() {
        let output = DiagramOutput {
            success: false,
            stdout: "renderer detail".to_owned(),
            stderr: "renderer warning".to_owned(),
            stdout_truncated: true,
            stderr_truncated: true,
        };

        let diagnostic = diagnostic_output(&output);
        assert!(diagnostic.contains("stdout: renderer detail"));
        assert!(diagnostic.contains("stderr: renderer warning"));
        assert!(diagnostic.contains("[stdout truncated"));
        assert!(diagnostic.contains("[stderr truncated"));
    }

    #[cfg(unix)]
    #[test]
    fn output_with_timeout_bounds_stdout_and_stderr_independently() {
        let script = "yes x | head -c 17000000; yes y | head -c 17000000 >&2";
        let output = output_with_timeout(
            ProcessSpec::new("sh")
                .args(["-c", script])
                .timeout(Duration::from_secs(30)),
        )
        .expect("bounded output fixture completes");

        assert!(output.success);
        assert!(output.stdout_truncated, "stdout overflow must be reported");
        assert!(output.stderr_truncated, "stderr overflow must be reported");
        assert!(output.stdout.len() <= MAX_DIAGRAM_OUTPUT_BYTES);
        assert!(output.stderr.len() <= MAX_DIAGRAM_OUTPUT_BYTES);
    }
}
