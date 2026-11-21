use crate::error::ExportError;

const ALLOWED_BOOL_FLAGS: &[&str] = &[
    "--standalone",
    "--citeproc",
    "-s",
    "--toc",
    "--number-sections",
];

// These fixed values select supported local PDF engines without allowing a
// caller-controlled executable path.
const ALLOWED_PDF_ENGINE_FLAGS: &[&str] = &[
    "--pdf-engine=pdflatex",
    "--pdf-engine=xelatex",
    "--pdf-engine=typst",
];

const ALLOWED_EQ_PREFIXES: &[&str] = &[
    "--css=",
    "--bibliography=",
    "--csl=",
    "--reference-doc=",
    "--template=",
    "--slide-level=",
    "--highlight-style=",
];

const ALLOWED_VALUE_FLAGS: &[&str] = &["--metadata", "--variable"];

// `--metadata` and `--variable` take `KEY[=VALUE]` or `KEY[:VALUE]`. Several
// Pandoc keys are file, URL, or raw-markup sinks (`bibliography`, `csl`,
// `header-includes`, `include-before`, `css`, ...). Those would sidestep the
// vault confinement applied to the dedicated `--bibliography=`/`--csl=`/`--css=`
// flags, and the PDF-engine stage is not covered by `--sandbox`. Only keys that
// carry plain presentation values are accepted.
const ALLOWED_KEYED_VALUE_KEYS: &[&str] = &[
    "abstract",
    "aspectratio",
    "author",
    "classoption",
    "colorlinks",
    "colortheme",
    "controls",
    "date",
    "description",
    "dir",
    "documentclass",
    "fontsize",
    "fonttheme",
    "geometry",
    "institute",
    "keywords",
    "lang",
    "linestretch",
    "link-citations",
    "linkcolor",
    "lof",
    "lot",
    "mainfont",
    "monofont",
    "numbersections",
    "pagetitle",
    "papersize",
    "progress",
    "reference-section-title",
    "sansfont",
    "secnumdepth",
    "slidenumber",
    "subject",
    "subtitle",
    "theme",
    "title",
    "toc-depth",
    "toc-title",
    "transition",
    "urlcolor",
];

fn validate_keyed_value(pair: &str, raw_variable: bool) -> Result<(), ExportError> {
    let (key, value) = pair.split_once(['=', ':']).unwrap_or((pair, ""));
    let key = key.trim().to_ascii_lowercase();
    if pair.contains('\\') || !ALLOWED_KEYED_VALUE_KEYS.contains(&key.as_str()) {
        return Err(ExportError::DisallowedArg(pair.to_string()));
    }
    // Values passed through Pandoc's --variable are not escaped by the template.
    if raw_variable && value.chars().any(|ch| matches!(ch, '<' | '>' | '{' | '}' | '$' | '%' | '#')) {
        return Err(ExportError::DisallowedArg(pair.to_string()));
    }
    // fontspec loads file paths as fonts. Accept family names only, not paths or options.
    if matches!(key.as_str(), "mainfont" | "sansfont" | "monofont") && !value.is_empty() {
        if value.trim().is_empty()
            || value.starts_with('.')
            || value.contains("..")
            || value.chars().any(|ch| !ch.is_ascii_alphanumeric() && !matches!(ch, ' ' | '-' | '_' | '+'))
        {
            return Err(ExportError::DisallowedArg(pair.to_string()));
        }
    }
    Ok(())
}

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
    for keyed in ["--metadata=", "--variable="] {
        if let Some(pair) = arg.strip_prefix(keyed) {
            validate_keyed_value(pair, keyed == "--variable=")?;
            return Ok(false);
        }
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
            validate_keyed_value(&extra_args[index], arg == "--variable")?;
        }
        index += 1;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_font_paths_and_raw_variable_markup() {
        for arg in [
            "--metadata=mainfont=/tmp/secret.ttf",
            "--variable=mainfont=../escape.ttf",
            "--variable=sansfont=C:/Windows/Fonts/font.ttf",
            "--variable=monofont=~/fonts/private.ttf",
            "--variable=title=<script>alert(1)</script>",
            "--variable=title={raw}",
        ] {
            assert!(validate_extra_args(&[arg.into()]).is_err(), "{arg}");
        }
        for (keyed, value) in [
            ("--metadata", "mainfont=/etc/passwd"),
            ("--variable", "title:<img src=x>"),
        ] {
            assert!(validate_extra_args(&[keyed.into(), value.into()]).is_err());
        }
        validate_extra_args(&["--metadata=title=Hello <World>".into()])
            .expect("escaped metadata should remain usable");
        validate_extra_args(&["--variable=mainfont=Noto Sans CJK".into()])
            .expect("plain font family names should remain usable");
    }

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
        assert!(validate_extra_args(&["-t".into(), "revealjs".into()]).is_err());
        validate_extra_args(&["--variable".into(), "theme:moon".into()]).expect("variable value");
    }

    #[test]
    fn rejects_metadata_and_variable_keys_that_are_file_url_or_markup_sinks() {
        for arg in [
            "--metadata=bibliography=/etc/passwd",
            "--metadata=csl=https://example.invalid/style.csl",
            "--metadata=BIBLIOGRAPHY:/etc/passwd",
            "--variable=header-includes=x",
            "--variable=include-before:/etc/hostname",
            "--variable=css=https://example.invalid/a.css",
            "--variable=title=\\input{/etc/passwd}",
            "--metadata=unknown-key=value",
        ] {
            assert!(validate_extra_args(&[arg.into()]).is_err(), "{arg}");
        }
        for (flag, value) in [
            ("--metadata", "bibliography=/etc/passwd"),
            ("--variable", "header-includes:x"),
        ] {
            assert!(validate_extra_args(&[flag.into(), value.into()]).is_err());
        }
    }

    #[test]
    fn allows_presentation_metadata_and_variable_keys() {
        validate_extra_args(&[
            "--metadata=title=Field notes".into(),
            "--variable=fontsize=11pt".into(),
            "--metadata".into(),
            "lang=en-GB".into(),
            "--variable".into(),
            "geometry:margin=2cm".into(),
        ])
        .expect("presentation keys");
    }

    #[test]
    fn allows_profile_defaults() {
        validate_extra_args(&[
            "--css=export-theme.css".into(),
            "--citeproc".into(),
            "-s".into(),
            "--slide-level=2".into(),
            "--standalone".into(),
        ])
        .expect("profile args");
    }

    #[test]
    fn allows_only_named_pdf_engines() {
        validate_extra_args(&["--pdf-engine=pdflatex".into()]).expect("supported PDF engine");
        validate_extra_args(&["--pdf-engine=xelatex".into()]).expect("supported PDF engine");
        validate_extra_args(&["--pdf-engine=typst".into()]).expect("opt-in Typst PDF engine");
        assert!(validate_extra_args(&["--pdf-engine=tectonic".into()]).is_err());
        assert!(validate_extra_args(&["--pdf-engine=C:/tools/custom.exe".into()]).is_err());
    }

    #[test]
    fn rejects_resource_embedding_flags_that_can_fetch_remote_urls() {
        assert!(validate_extra_args(&["--embed-resources".into()]).is_err());
        assert!(validate_extra_args(&["--self-contained".into()]).is_err());
    }
}
