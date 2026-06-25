use std::fs;
use std::path::{Path, PathBuf};

use crate::error::ExportError;

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiagramFence {
    start: usize,
    end: usize,
    kind: String,
    source: String,
}

/// Replace ```mermaid / ```plantuml fences with SVG image references for Pandoc export.
pub fn preprocess_diagrams(
    markdown: &str,
    temp_dir: &Path,
) -> Result<(String, Vec<PathBuf>), ExportError> {
    let fences = collect_diagram_fences(markdown);
    if fences.is_empty() {
        return Ok((markdown.to_string(), Vec::new()));
    }

    let diagram_dir = temp_dir.join("diagrams");
    fs::create_dir_all(&diagram_dir).map_err(|source| ExportError::Io {
        path: diagram_dir.clone(),
        source,
    })?;

    let mut output = String::new();
    let mut cursor = 0;
    let mut written = Vec::new();

    for (index, fence) in fences.iter().enumerate() {
        output.push_str(&markdown[cursor..fence.start]);
        let file_name = format!("diagram-{}-{}.svg", fence.kind, index);
        let image_path = diagram_dir.join(&file_name);
        let svg = build_diagram_svg(&fence.kind, &fence.source);
        fs::write(&image_path, svg).map_err(|source| ExportError::Io {
            path: image_path.clone(),
            source,
        })?;
        written.push(image_path.clone());

        let alt = if fence.kind == "mermaid" {
            "Mermaid diagram"
        } else {
            "PlantUML diagram"
        };
        let relative = Path::new("diagrams").join(&file_name);
        output.push_str(&format!("![{alt}]({})\n", relative.display()));
        cursor = fence.end;
    }

    output.push_str(&markdown[cursor..]);
    Ok((output, written))
}

fn collect_diagram_fences(markdown: &str) -> Vec<DiagramFence> {
    let mut fences = Vec::new();
    let bytes = markdown.as_bytes();
    let mut index = 0;

    while index + 3 <= bytes.len() {
        if &markdown[index..index + 3] != "```" {
            index += 1;
            continue;
        }

        let line_end = markdown[index..]
            .find('\n')
            .map(|offset| index + offset)
            .unwrap_or(markdown.len());
        let info = markdown[index + 3..line_end].trim().to_ascii_lowercase();
        if info != "mermaid" && info != "plantuml" {
            index += 3;
            continue;
        }

        let content_start = if line_end < markdown.len() {
            line_end + 1
        } else {
            markdown.len()
        };
        let Some(close) = markdown[content_start..].find("\n```") else {
            index += 3;
            continue;
        };
        let content_end = content_start + close;
        let fence_end = content_end + 4;

        fences.push(DiagramFence {
            start: index,
            end: fence_end,
            kind: info,
            source: markdown[content_start..content_end].trim().to_string(),
        });
        index = fence_end;
    }

    fences
}

fn build_diagram_svg(kind: &str, source: &str) -> String {
    let escaped = xml_escape(source);
    let title = if kind == "mermaid" {
        "Mermaid diagram"
    } else {
        "PlantUML diagram"
    };
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
    use tempfile::tempdir;

    #[test]
    fn replaces_mermaid_fence_with_image_reference() {
        let markdown = "# Title\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\nDone";
        let temp = tempdir().expect("tempdir");
        let (processed, files) = preprocess_diagrams(markdown, temp.path()).expect("preprocess");
        assert_eq!(files.len(), 1);
        assert!(processed.contains("![Mermaid diagram]("));
        assert!(processed.contains("diagram-mermaid-0.svg"));
        assert!(!processed.contains("```mermaid"));
    }
}
