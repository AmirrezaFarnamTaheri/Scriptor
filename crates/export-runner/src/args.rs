use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::ExportError;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Html,
    Pdf,
    Docx,
    Latex,
    Epub,
}

impl ExportFormat {
    pub fn parse(raw: &str) -> Result<Self, ExportError> {
        match raw.to_ascii_lowercase().as_str() {
            "html" => Ok(Self::Html),
            "pdf" => Ok(Self::Pdf),
            "docx" => Ok(Self::Docx),
            "latex" | "tex" => Ok(Self::Latex),
            "epub" => Ok(Self::Epub),
            other => Err(ExportError::UnsupportedFormat(other.to_string())),
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Self::Html => "html",
            Self::Pdf => "pdf",
            Self::Docx => "docx",
            Self::Latex => "tex",
            Self::Epub => "epub",
        }
    }
}

pub fn build_pandoc_args(
    format: ExportFormat,
    source_path: &Path,
    output_path: &Path,
    title: Option<&str>,
    extra_args: &[String],
) -> Result<Vec<String>, ExportError> {
    let mut args = vec![
        source_path.display().to_string(),
        "-o".into(),
        output_path.display().to_string(),
        "--standalone".into(),
    ];

    if let Some(title) = title {
        args.push("--metadata".into());
        args.push(format!("title={title}"));
    }

    match format {
        ExportFormat::Html => {
            args.push("-t".into());
            args.push("html5".into());
        }
        ExportFormat::Pdf => {
            args.push("-t".into());
            args.push("pdf".into());
        }
        ExportFormat::Docx => {
            args.push("-t".into());
            args.push("docx".into());
        }
        ExportFormat::Latex => {
            args.push("-t".into());
            args.push("latex".into());
        }
        ExportFormat::Epub => {
            args.push("-t".into());
            args.push("epub".into());
        }
    }

    append_extra_args(&mut args, extra_args)?;
    Ok(args)
}

pub fn append_extra_args(args: &mut Vec<String>, extra_args: &[String]) -> Result<(), ExportError> {
    for arg in extra_args {
        if arg.contains('&') || arg.contains('|') || arg.contains(';') || arg.contains('`') {
            return Err(ExportError::DisallowedArg(arg.clone()));
        }
        args.push(arg.clone());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn rejects_shell_injection_in_paths() {
        let args = build_pandoc_args(
            ExportFormat::Html,
            Path::new("note.md"),
            Path::new("out.html"),
            Some("safe title"),
            &[],
        )
        .expect("args");
        assert!(!args.iter().any(|arg| arg.contains('&') || arg.contains('|')));
        assert!(args.contains(&"-o".to_string()));
        assert!(args.contains(&PathBuf::from("out.html").display().to_string()));
    }

    #[test]
    fn rejects_shell_injection_in_extra_args() {
        let error = append_extra_args(&mut vec![], &["--foo;rm".into()]).unwrap_err();
        assert!(error.to_string().contains("disallowed"));
    }
}
