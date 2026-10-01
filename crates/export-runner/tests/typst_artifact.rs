use scriptor_export_runner::{
    ExportFormat, ExportJobInput, run_export_job, validate_export_artifact,
};

/// Exercises the production process broker, compiler preflight and artifact validator.
#[test]
#[ignore = "requires installed Pandoc and Typst; run explicitly for artifact verification"]
fn typst_produces_a_real_pdf_through_the_export_runner() {
    let temporary = tempfile::tempdir().unwrap();
    let root = std::env::var_os("SCRIPTOR_TYPST_VERIFY_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| temporary.path().to_path_buf());
    std::fs::create_dir_all(&root).unwrap();
    let output = run_export_job(ExportJobInput {
        format: "pdf".into(),
        source_markdown: "# Scriptor Typst verification\n\nA measured export through the production runner.\n\n- Markdown stays authoritative.\n- The artifact is validated.\n\n| Measure | Value |\n|---|---|\n| Verified path | Pandoc and Typst |\n".into(),
        output_directory: root.join(".scriptor/exports").display().to_string(),
        source_stem: "typst-verification".into(),
        title: Some("Scriptor Typst verification".into()),
        dry_run: false,
        extra_pandoc_args: vec!["--pdf-engine=typst".into()],
        vault_root: root.display().to_string(),
        job_id: None,
        preserve_temp_on_failure: true,
        trusted_pandoc_hash: None,
        redact_secrets: false,
    }).expect("real Typst export must succeed");
    assert!(!output.dry_run);
    assert!(
        output
            .command
            .iter()
            .any(|argument| argument == "--pdf-engine=typst")
    );
    let artifact = std::path::Path::new(&output.artifact_path);
    let validated = validate_export_artifact(artifact, ExportFormat::Pdf).unwrap();
    assert!(validated.size_bytes > 1024);
    println!(
        "Verified PDF: {} ({} bytes)",
        artifact.display(),
        validated.size_bytes
    );
}
