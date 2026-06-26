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

const ALLOWED_EQ_PREFIXES: &[&str] = &[
    "--css=",
    "--bibliography=",
    "--csl=",
    "--metadata=",
    "--variable=",
    "--reference-doc=",
    "--template=",
    "--lua-filter=",
    "--filter=",
    "--slide-level=",
    "--highlight-style=",
];

const ALLOWED_VALUE_FLAGS: &[&str] = &["-t", "--metadata", "--filter", "--lua-filter", "--variable"];

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
    if ALLOWED_EQ_PREFIXES.iter().any(|prefix| arg.starts_with(prefix)) {
        return Ok(false);
    }
    if ALLOWED_VALUE_FLAGS.iter().any(|flag| flag == &arg) {
        return Ok(true);
    }
    // Pandoc format targets and slide-level values appear as bare tokens after -t / --slide-level.
    if !arg.starts_with('-') {
        return Ok(false);
    }
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
}
