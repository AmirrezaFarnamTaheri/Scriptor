use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

const MAX_CONCURRENT_EXTERNAL_TOOLS: usize = 2;
static ACTIVE_EXTERNAL_TOOLS: AtomicUsize = AtomicUsize::new(0);

struct ExternalToolSlot;

impl Drop for ExternalToolSlot {
    fn drop(&mut self) {
        ACTIVE_EXTERNAL_TOOLS.fetch_sub(1, Ordering::SeqCst);
    }
}

fn acquire_external_tool_slot() -> Result<ExternalToolSlot, String> {
    ACTIVE_EXTERNAL_TOOLS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
            (current < MAX_CONCURRENT_EXTERNAL_TOOLS).then_some(current + 1)
        })
        .map_err(|_| "external tool concurrency limit reached; retry after an active job completes".to_string())?;
    Ok(ExternalToolSlot)
}

fn trusted_tool_hash(name: &str, expected: Option<String>) -> Result<Option<String>, String> {
    if expected.as_deref().is_some_and(|value| !value.trim().is_empty()) {
        return Ok(expected);
    }
    if environment_opt_in("SCRIPTOR_ALLOW_UNPINNED_EXTERNAL_TOOLS") {
        tracing::warn!(tool = name, "running unpinned external tool under explicit local override");
        return Ok(None);
    }
    Err(format!(
        "{name} requires an explicit SHA-256 pin; configure the documented hash variable or set SCRIPTOR_ALLOW_UNPINNED_EXTERNAL_TOOLS only for a reviewed local development environment"
    ))
}

fn verify_auxiliary_file_hash(path: &Path, expected: Option<String>, label: &str) -> Result<(), String> {
    let expected = trusted_tool_hash(label, expected)?;
    let Some(expected) = expected else { return Ok(()); };
    let actual = scriptor_system_bridge::hash_file(path).map_err(|error| error.to_string())?;
    if !actual.eq_ignore_ascii_case(expected.trim()) {
        return Err(format!("{label} hash mismatch: expected {} got {}", expected.trim(), actual));
    }
    Ok(())
}


pub(super) fn cmd_indexer_rebuild(state: &DaemonState) -> Result<Value, String> {
    state.index_rebuild.wait();
    let session = state.require_session()?.clone();
    to_value(rebuild_index(&session, &[]).map_err(|e| e.to_string())?)
}

pub(super) fn cmd_save_note(
    state: &DaemonState,
    path: &str,
    markdown: &str,
    expected_content_hash: Option<&str>,
    dry_run: bool,
) -> Result<scriptor_vault::SaveNoteOutput, String> {
    let session = state.require_session()?;
    let note_path = RelativeVaultPath::parse(path).map_err(|error| error.to_string())?;
    let output = save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &note_path,
        markdown,
        expected_content_hash,
        SaveNoteOptions { dry_run },
    )
    .map_err(|error| error.to_string())?;
    if !dry_run
        && let Err(error) =
            incremental_note_index_with_cache(session, state.require_cache()?, path, &[])
    {
        if let Err(rollback_error) = rollback_save_note(
            &session.descriptor.id,
            &session.root,
            &note_path,
            output.previous_content_hash.as_deref(),
        ) {
            return Err(format!(
                "index update failed: {error}; disk rollback failed: {rollback_error}"
            ));
        }
        return Err(error.to_string());
    }
    Ok(output)
}

pub(super) fn cmd_rename_apply(
    state: &DaemonState,
    from_path: &str,
    to_path: &str,
    update_links: bool,
) -> Result<scriptor_vault::RenameNoteApplyOutput, String> {
    let session = state.require_session()?;
    let from = RelativeVaultPath::parse(from_path).map_err(|error| error.to_string())?;
    let to = RelativeVaultPath::parse(to_path).map_err(|error| error.to_string())?;
    let (output, staged) = rename_apply_staged(
        &session.descriptor.id,
        &session.root,
        &from,
        &to,
        update_links,
    )
    .map_err(|error| error.to_string())?;
    if let Err(error) = incremental_notes_index_with_cache(
        session,
        state.require_cache()?,
        &output.affected_files,
        &[],
    ) {
        let _ = staged.abort();
        return Err(error.to_string());
    }
    staged.commit().map_err(|error| error.to_string())?;
    Ok(output)
}

/// Runs outside the daemon lock: resolves a read-only whole-vault command
/// with a pre-cloned session.
///
/// `session` is cloned by the transport layer before the daemon mutex is
/// released; `cache` is present whenever an index has been built. Only
/// commands that never mutate vault state belong here — the rename previews
/// and the vault health report read every note on disk, so running them under
/// the daemon mutex would stall every other command for the whole scan.
pub(crate) fn run_read_only_vault_command(
    session: &scriptor_vault::VaultSession,
    cache: Option<&scriptor_indexer::IndexCache>,
    command: &str,
    payload: &Value,
) -> Result<String, String> {
    fn serialize<T: serde::Serialize>(value: Result<T, String>) -> Result<String, String> {
        value.and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string()))
    }
    match command {
        "vault_rename_dry_run" => {
            let from_path = require_str(payload, "from_path")?;
            let to_path = require_str(payload, "to_path")?;
            let update_links = require_bool(payload, "update_links")?;
            let from = RelativeVaultPath::parse(&from_path).map_err(|error| error.to_string())?;
            let to = RelativeVaultPath::parse(&to_path).map_err(|error| error.to_string())?;
            serialize(
                rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &from,
                    &to,
                    update_links,
                )
                .map_err(|e| e.to_string()),
            )
        }
        "vault_rename_tag_dry_run" => {
            let old_tag = require_str(payload, "old_tag")?;
            let new_tag = require_str(payload, "new_tag")?;
            serialize(
                tag_rename_dry_run(&session.descriptor.id, &session.root, &old_tag, &new_tag)
                    .map_err(|e| e.to_string()),
            )
        }
        "vault_rename_section_dry_run" => {
            let note_path = require_str(payload, "note_path")?;
            let old_section = require_str(payload, "old_section")?;
            let new_section = require_str(payload, "new_section")?;
            let update_heading = require_bool(payload, "update_heading")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            serialize(
                section_rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_section,
                    &new_section,
                    update_heading,
                )
                .map_err(|e| e.to_string()),
            )
        }
        "vault_rename_block_dry_run" => {
            let note_path = require_str(payload, "note_path")?;
            let old_block = require_str(payload, "old_block")?;
            let new_block = require_str(payload, "new_block")?;
            let update_anchor = require_bool(payload, "update_anchor")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            serialize(
                block_rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_block,
                    &new_block,
                    update_anchor,
                )
                .map_err(|e| e.to_string()),
            )
        }
        "vault_health" => {
            let cache =
                cache.ok_or_else(|| "no index cache is open; call OpenVault first".to_string())?;
            serialize(health_report_json(cache, session).map_err(|e| e.to_string()))
        }
        other => Err(format!(
            "unsupported read-only outside-lock invoke command: {other}"
        )),
    }
}

/// Runs outside the daemon lock: resolves a wikilink target using the index.
///
/// When `cache` is available (normal case) this issues a single SQL query
/// against `notes.aliases_json` — one indexed query instead of O(n) disk reads.
/// Falls back to a full vault scan when the cache is absent (e.g., before the
/// first index build).
pub(crate) fn resolve_wikilink_for_session(
    session: &scriptor_vault::VaultSession,
    cache: Option<&scriptor_indexer::IndexCache>,
    target: &str,
) -> Result<Value, String> {
    if let Some(cache) = cache {
        // Fast path: aliases are stored in the index (v9+).
        let (note_paths, aliases_by_path) = note_paths_and_aliases(cache, &session.descriptor.id)
            .map_err(|error| error.to_string())?;
        return to_value(resolve_wikilink_target_with_aliases(
            &note_paths,
            &aliases_by_path,
            target,
        ));
    }

    // Slow fallback: read every note from disk to extract aliases.
    // Used only when the index has not been built yet.
    let scanned = scan_vault(&session.root).map_err(|error| error.to_string())?;
    let mut note_paths = Vec::new();
    let mut aliases_by_path = std::collections::BTreeMap::new();
    for entry in scanned {
        if entry.kind != scriptor_vault::ScannedEntryKind::Note {
            continue;
        }
        note_paths.push(entry.path.clone());
        if let Ok(relative) = RelativeVaultPath::parse(&entry.path)
            && let Ok(document) = read_note(&session.descriptor.id, &session.root, &relative)
        {
            let parsed = parse_note_markdown(&entry.path, &document.markdown);
            if !parsed.aliases.is_empty() {
                aliases_by_path.insert(entry.path, parsed.aliases);
            }
        }
    }
    to_value(resolve_wikilink_target_with_aliases(
        &note_paths,
        &aliases_by_path,
        target,
    ))
}

pub(super) fn build_export_note_input(
    state: &DaemonState,
    note_path: &str,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: &[String],
    output_subdirectory: &Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let session = state.require_session()?;
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let stem = export_artifact_stem(note_path);
    let output_directory = match output_subdirectory {
        Some(subdir) => {
            let validated = RelativeVaultPath::parse(subdir)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))?;
            session.root.resolve_relative(&validated)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))?
        }
        None => default_export_directory(session.root.root()),
    };
    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown: note.markdown,
        output_directory: output_directory.display().to_string(),
        source_stem: stem,
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args: extra_pandoc_args.to_vec(),
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash: None,
        redact_secrets: false,
    })
}

// Mirrors the RPC wire shape of ExportStartMarkdown one-to-one.
#[allow(clippy::too_many_arguments)]
pub(super) fn build_export_markdown_input(
    state: &DaemonState,
    note_path: &str,
    source_markdown: &str,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: &[String],
    output_subdirectory: &Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let session = state.require_session()?;
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let stem = export_artifact_stem(note_path);
    let output_directory = match output_subdirectory {
        Some(subdir) => {
            let validated = RelativeVaultPath::parse(subdir)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))?;
            session.root.resolve_relative(&validated)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))?
        }
        None => default_export_directory(session.root.root()),
    };
    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown: source_markdown.to_string(),
        output_directory: output_directory.display().to_string(),
        source_stem: stem,
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args: extra_pandoc_args.to_vec(),
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash: None,
        redact_secrets: false,
    })
}

#[derive(serde::Serialize)]
pub(crate) struct PdfTranslateOutput {
    #[serde(rename = "outputPath")]
    output_path: String,
}

/// Everything needed to run pdf2zh WITHOUT holding the daemon lock. The
/// subprocess may legitimately run for minutes; prepare under a short guard,
/// execute outside the lock.
pub(crate) struct PreparedPdfTranslate {
    pub(crate) program: String,
    args: Vec<String>,
    current_dir: PathBuf,
    expected_sha256: Option<String>,
    output: PathBuf,
}

pub(crate) fn prepare_pdf_translate(
    state: &DaemonState,
    payload: &Value,
) -> Result<PreparedPdfTranslate, String> {
    let session = state.require_session()?;
    let input_path = require_str(payload, "input_path")?;
    let relative = RelativeVaultPath::parse(&input_path)
        .map_err(|error| format!("invalid input_path: {error}"))?;
    let resolved = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let program = std::env::var("SCRIPTOR_PDF2ZH_PATH").unwrap_or_else(|_| "pdf2zh".into());
    let mut args = vec![
        resolved.display().to_string(),
        "-li".into(),
        optional_str(payload, "lang_in").unwrap_or_else(|| "en".into()),
        "-lo".into(),
        optional_str(payload, "lang_out").unwrap_or_else(|| "zh".into()),
    ];
    let explicit_output = if let Some(out) = optional_str(payload, "output_path") {
        let out_relative = RelativeVaultPath::parse(&out)
            .map_err(|error| format!("invalid output_path: {error}"))?;
        let out_resolved = session
            .root
            .resolve_relative(&out_relative)
            .map_err(|error| error.to_string())?;
        args.push("-o".into());
        args.push(out_resolved.display().to_string());
        Some(out_resolved)
    } else {
        None
    };

    let stem = resolved
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let parent = resolved.parent().unwrap_or_else(|| Path::new("."));
    let output = explicit_output.unwrap_or_else(|| parent.join(format!("{stem}-dual.pdf")));
    Ok(PreparedPdfTranslate {
        args,
        current_dir: session.root.root().to_path_buf(),
        expected_sha256: std::env::var("SCRIPTOR_PDF2ZH_SHA256").ok(),
        output,
        program,
    })
}

pub(crate) fn run_prepared_pdf_translate(
    prepared: PreparedPdfTranslate,
) -> Result<PdfTranslateOutput, String> {
    let _slot = acquire_external_tool_slot()?;
    let expected_sha256 = trusted_tool_hash("pdf2zh", prepared.expected_sha256)?;
    let receipt = run_process(
        ProcessSpec::new(&prepared.program)
            .args(prepared.args)
            .current_dir(&prepared.current_dir)
            .timeout(Duration::from_secs(15 * 60))
            .max_output_bytes(512 * 1024)
            .network_policy(NetworkPolicy::Allow)
            .expected_sha256(expected_sha256),
    )
    .map_err(|error| {
        format!("PDF translation failed ({error}). Install PDFMathTranslate or configure SCRIPTOR_PDF2ZH_PATH and SCRIPTOR_PDF2ZH_SHA256.")
    })?;
    if receipt.exit_code != 0 {
        return Err(format!(
            "pdf2zh exited with code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        ));
    }
    Ok(PdfTranslateOutput {
        output_path: prepared.output.display().to_string(),
    })
}

#[derive(serde::Serialize)]
pub(crate) struct PlantUmlRenderOutput {
    svg: String,
    engine: String,
}

pub(super) fn environment_opt_in(name: &str) -> bool {
    std::env::var(name).ok().is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes"
        )
    })
}

pub(crate) fn cmd_plantuml_render(payload: &Value) -> Result<PlantUmlRenderOutput, String> {
    let _slot = acquire_external_tool_slot()?;
    let source = require_str(payload, "source")?;
    if source.len() > 1024 * 1024 {
        return Err("PlantUML source exceeds the 1 MiB rendering limit".into());
    }
    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let input = temp_dir.join("diagram.puml");
    fs::write(&input, source).map_err(|error| error.to_string())?;
    let result = run_plantuml(&input);
    let _ = fs::remove_dir_all(&temp_dir);
    let (svg, engine) = result?;
    Ok(PlantUmlRenderOutput { svg, engine })
}

pub(super) fn run_plantuml_candidate(
    program: &str,
    args: Vec<String>,
    input: &Path,
    expected_sha256: Option<String>,
) -> Result<(String, String), String> {
    let expected_sha256 = trusted_tool_hash(program, expected_sha256)?;
    let receipt = run_process(
        ProcessSpec::new(program)
            .args(args)
            .current_dir(input.parent().unwrap_or_else(|| Path::new(".")))
            .timeout(Duration::from_secs(30))
            .max_output_bytes(256 * 1024)
            .network_policy(NetworkPolicy::Deny)
            .allow_unsandboxed_network_denial(environment_opt_in(
                "SCRIPTOR_ALLOW_UNSANDBOXED_EXTERNAL_TOOLS",
            ))
            .expected_sha256(expected_sha256),
    )
    .map_err(|error| error.to_string())?;
    if receipt.exit_code != 0 {
        return Err(format!(
            "PlantUML failed with exit code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        ));
    }
    let svg = fs::read_to_string(input.with_extension("svg")).map_err(|error| error.to_string())?;
    Ok((svg, receipt.resolved_program))
}

pub(super) fn run_plantuml(input: &Path) -> Result<(String, String), String> {
    if let Ok(path) = std::env::var("PLANTUML_BIN")
        && !path.trim().is_empty()
    {
        return run_plantuml_candidate(
            &path,
            vec!["-tsvg".into(), input.display().to_string()],
            input,
            std::env::var("SCRIPTOR_PLANTUML_SHA256").ok(),
        );
    }

    if let Ok(jar) = std::env::var("PLANTUML_JAR")
        && !jar.trim().is_empty()
    {
        let jar_path = PathBuf::from(&jar);
        verify_auxiliary_file_hash(
            &jar_path,
            std::env::var("SCRIPTOR_PLANTUML_JAR_SHA256").ok(),
            "PlantUML JAR",
        )?;
        return run_plantuml_candidate(
            "java",
            vec![
                "-jar".into(),
                jar,
                "-tsvg".into(),
                input.display().to_string(),
            ],
            input,
            std::env::var("SCRIPTOR_JAVA_SHA256").ok(),
        );
    }

    run_plantuml_candidate(
        "plantuml",
        vec!["-tsvg".into(), input.display().to_string()],
        input,
        std::env::var("SCRIPTOR_PLANTUML_SHA256").ok(),
    )
}

pub(super) fn to_value<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

pub(super) fn require_str(payload: &Value, key: &str) -> Result<String, String> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("missing or invalid string field: {key}"))
}

pub(super) fn optional_str(payload: &Value, key: &str) -> Option<String> {
    payload.get(key).and_then(Value::as_str).map(str::to_string)
}

pub(super) fn require_bool(payload: &Value, key: &str) -> Result<bool, String> {
    payload
        .get(key)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("missing or invalid bool field: {key}"))
}

pub(super) fn optional_bool(payload: &Value, key: &str) -> Option<bool> {
    payload.get(key).and_then(Value::as_bool)
}

pub(super) fn require_u32(payload: &Value, key: &str) -> Result<u32, String> {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| format!("missing or invalid u32 field: {key}"))
}

pub(super) fn optional_u32(payload: &Value, key: &str) -> Option<u32> {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
}

pub(super) fn require_f64(payload: &Value, key: &str) -> Result<f64, String> {
    payload
        .get(key)
        .and_then(Value::as_f64)
        .ok_or_else(|| format!("missing or invalid f64 field: {key}"))
}

pub(super) fn require_i64(payload: &Value, key: &str) -> Result<i64, String> {
    payload
        .get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing or invalid i64 field: {key}"))
}

pub(super) fn require_bytes(payload: &Value, key: &str) -> Result<Vec<u8>, String> {
    let array = payload
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing or invalid bytes field: {key}"))?;
    array
        .iter()
        .enumerate()
        .map(|(index, value)| {
            value
                .as_u64()
                .and_then(|byte| u8::try_from(byte).ok())
                .ok_or_else(|| {
                    format!(
                        "invalid byte at index {index} in field {key}: expected integer 0..=255"
                    )
                })
        })
        .collect()
}

pub(super) fn require_deserialize<T: serde::de::DeserializeOwned>(
    payload: &Value,
    key: &str,
) -> Result<T, String> {
    payload
        .get(key)
        .ok_or_else(|| format!("missing field: {key}"))
        .and_then(|value| serde_json::from_value(value.clone()).map_err(|error| error.to_string()))
}

pub(super) fn optional_deserialize<T: serde::de::DeserializeOwned>(
    payload: &Value,
    key: &str,
) -> Option<T> {
    payload
        .get(key)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
}
