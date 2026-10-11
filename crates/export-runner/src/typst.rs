use crate::{ExportError, ExportFormat};
use scriptor_system_bridge::{ProcessSpec, run_process};
use std::time::Duration;

pub(crate) fn validate_selection(
    format: ExportFormat,
    args: &[String],
) -> Result<bool, ExportError> {
    let selected = args.iter().any(|arg| arg == "--pdf-engine=typst");
    if selected
        && (format != ExportFormat::Pdf
            || args
                .iter()
                .filter(|arg| arg.starts_with("--pdf-engine="))
                .count()
                != 1)
    {
        return Err(ExportError::Process(
            "Typst requires a PDF profile with exactly one PDF engine".into(),
        ));
    }
    Ok(selected)
}

pub(crate) fn preflight() -> Result<(), ExportError> {
    let output = run_process(
        ProcessSpec::new("typst")
            .args(["--version"])
            .timeout(Duration::from_secs(5))
            .max_output_bytes(4096),
    )
    .map_err(|error| {
        ExportError::Process(format!(
            "Typst is unavailable: {error}. Install Typst on PATH or choose another PDF engine."
        ))
    })?;
    if output.exit_code != 0 || !output.stdout.trim_start().starts_with("typst ") {
        return Err(ExportError::Process(
            "Typst preflight did not return a valid compiler version".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn typst_is_an_explicit_unambiguous_pdf_selection() {
        assert!(validate_selection(ExportFormat::Pdf, &["--pdf-engine=typst".into()]).unwrap());
        assert!(!validate_selection(ExportFormat::Pdf, &[]).unwrap());
        assert!(validate_selection(ExportFormat::Html, &["--pdf-engine=typst".into()]).is_err());
        assert!(
            validate_selection(
                ExportFormat::Pdf,
                &["--pdf-engine=typst".into(), "--pdf-engine=xelatex".into()]
            )
            .is_err()
        );
    }
}
