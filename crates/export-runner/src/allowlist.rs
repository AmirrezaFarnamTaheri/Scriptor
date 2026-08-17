use crate::error::ExportError;

const ALLOWED_BOOL_FLAGS: &[&str] = &[
    "--standalone",
    "--citeproc",
    "--embed-resources",
    "-s",
    "--toc",
    "--number-sections",
    "--self-contained",
];

// These fixed values select supported local PDF engines without allowing a
// caller-controlled executable path.
const ALLOWED_PDF_ENGINE_FLAGS: &[&str] = &[
    "--pdf-engine=pdflatex",
    "--pdf-engine=tectonic",
    "--pdf-engine=xelatex",
];

const ALLOWED_EQ_PREFIXES: &[&str] = &[
    "--css=",
    "--bibliography=",
    "--csl=",
    "--metadata=",
    "--variable=",
    "--reference-doc=",
    "--template=",
    "--slide-level=",
    "--highlight-style=",
];

const ALLOWED_VALUE_FLAGS: &[&str] = &["-t", "--metadata", "--variable"];

fn contains_shell_metachar(value: &str) -> bool {
    value.contains(['&', '|', ';', '`', '\n', '\r'])
}

fn is_disallowed_output_flag(arg: &str) -> bool {
    let lower = arg.to_ascii_lowercase();
    lower == "-o" || lower.starts_with("--output") || lower.starts_with("--output=")
}

fn validate_value_token(value: &str) -> Result<(), ExportError> {
    if value.starts_with('-') || contains_shell_metachar(value) {
        return Err(ExportError::DisallowedArg(value.to_string()));
    }
    Ok(())
}

fn validate_flag_token(arg: &str) -> Result<bool, ExportError> {
    if contains_shell_metachar(arg) || is_disallowed_output_flag(arg) {
        return Err(ExportError::DisallowedArg(arg.to_string()));
    }
    if ALLOWED_BOOL_FLAGS.iter().any(|flag| flag == &arg) {
        return Ok(false);
    }
    if ALLOWED_PDF_ENGINE_FLAGS.iter().any(|flag| flag == &arg) {
        return Ok(false);
    }
    if ALLOWED_EQ_PREFIXES
        .iter()
        .any(|prefix| arg.starts_with(prefix))
    {
        return Ok(false);
    }
    if ALLOWED_VALUE_FLAGS.iter().any(|flag| flag == &arg) {
        return Ok(true);
    }
    // Bare (non-dash) tokens are only permitted as the value immediately following
    // an allowed value flag (handled by the caller); anywhere else they would be
    // passed to pandoc as extra input files, so reject them here.
    Err(ExportError::DisallowedArg(arg.to_string()))
}

pub fn validate_extra_args(extra_args: &[String]) -> Result<(), ExportError> {
    let mut index = 0;
    while index < extra_args.len() {
        let arg = &extra_args[index];
        let expects_value = validate_flag_token(arg)?;
        if expects_value {
            index += 1;
            if index >= extra_args.len() {
                return Err(ExportError::DisallowedArg(format!("{arg} missing value")));
            }
            validate_value_token(&extra_args[index])?;
        }
        index += 1;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_output_escape() {
        let error = validate_extra_args(&["--output=/tmp/x".into()]).unwrap_err();
        assert!(error.to_string().contains("disallowed"));
    }

    #[test]
    fn rejects_filter_flags() {
        assert!(validate_extra_args(&["--filter=/tmp/evil.py".into()]).is_err());
        assert!(validate_extra_args(&["--lua-filter=evil.lua".into()]).is_err());
        assert!(validate_extra_args(&["--filter".into(), "evil.py".into()]).is_err());
        assert!(validate_extra_args(&["--lua-filter".into(), "evil.lua".into()]).is_err());
    }

    #[test]
    fn rejects_bare_tokens_outside_value_position() {
        assert!(validate_extra_args(&["extra-input.md".into()]).is_err());
        assert!(validate_extra_args(&["--standalone".into(), "extra-input.md".into()]).is_err());
        assert!(validate_extra_args(&["--slide-level=2".into(), "extra-input.md".into()]).is_err());
    }

    #[test]
    fn allows_bare_token_as_value_of_value_flag() {
        validate_extra_args(&["-t".into(), "revealjs".into()]).expect("format target value");
        validate_extra_args(&["--variable".into(), "theme:moon".into()]).expect("variable value");
    }

    #[test]
    fn allows_profile_defaults() {
        validate_extra_args(&[
            "--embed-resources".into(),
            "--css=export-theme.css".into(),
            "--citeproc".into(),
            "-t".into(),
            "revealjs".into(),
            "-s".into(),
            "--slide-level=2".into(),
            "--standalone".into(),
        ])
        .expect("profile args");
    }

    #[test]
    fn allows_only_named_pdf_engines() {
        validate_extra_args(&["--pdf-engine=tectonic".into()]).expect("supported PDF engine");
        assert!(validate_extra_args(&["--pdf-engine=C:/tools/custom.exe".into()]).is_err());
    }
}
