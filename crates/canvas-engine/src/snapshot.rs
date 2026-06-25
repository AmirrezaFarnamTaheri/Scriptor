use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::CanvasError;
use crate::scene::{CanvasBlockKind, CanvasDocument, CanvasRect, CanvasShapeKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SnapshotFormat {
    Png,
    Svg,
    Pdf,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotOutput {
    pub format: SnapshotFormat,
    pub artifact_path: String,
    pub width: f64,
    pub height: f64,
    pub dry_run: bool,
}

pub fn render_svg(document: &CanvasDocument, bounds: Option<CanvasRect>) -> String {
    let viewport = bounds.unwrap_or_else(|| scene_bounds(document));
    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{} {} {} {}" width="{}" height="{}">"#,
        viewport.x, viewport.y, viewport.width, viewport.height, viewport.width, viewport.height
    ));
    svg.push_str(&format!(
        r##"<rect x="{}" y="{}" width="{}" height="{}" fill="#f8fafc" />"##,
        viewport.x, viewport.y, viewport.width, viewport.height
    ));

    let mut blocks = document.blocks.clone();
    blocks.sort_by_key(|block| block.z_index);

    for block in blocks {
        let fill = block
            .style
            .as_ref()
            .and_then(|style| style.fill.clone())
            .unwrap_or_else(|| "#ffffff".into());
        let stroke = block
            .style
            .as_ref()
            .and_then(|style| style.stroke.clone())
            .unwrap_or_else(|| "#64748b".into());
        let label = block.content_ref.clone().unwrap_or_else(|| block.id.clone());

        match block.kind {
            CanvasBlockKind::Connector => {
                svg.push_str(&format!(
                    r##"<g data-block-id="{}"><line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{}" stroke-width="2" marker-end="url(#arrow)" /><text x="{}" y="{}" font-size="12" fill="#334155">{}</text></g>"##,
                    block.id,
                    block.bounds.x,
                    block.bounds.y,
                    block.bounds.x + block.bounds.width,
                    block.bounds.y + block.bounds.height,
                    stroke,
                    block.bounds.x + 8.0,
                    block.bounds.y - 6.0,
                    xml_escape(&label),
                ));
                continue;
            }
            CanvasBlockKind::Image => {
                let href = block.content_ref.clone().unwrap_or_else(|| "image".into());
                svg.push_str(&format!(
                    r##"<g data-block-id="{}"><rect x="{}" y="{}" width="{}" height="{}" fill="#e2e8f0" stroke="{}" /><text x="{}" y="{}" font-size="12" fill="#475569">img: {}</text></g>"##,
                    block.id,
                    block.bounds.x,
                    block.bounds.y,
                    block.bounds.width,
                    block.bounds.height,
                    stroke,
                    block.bounds.x + 12.0,
                    block.bounds.y + 24.0,
                    xml_escape(&href),
                ));
                continue;
            }
            CanvasBlockKind::Embed => {
                svg.push_str(&format!(
                    r##"<g data-block-id="{}"><rect x="{}" y="{}" width="{}" height="{}" fill="#f1f5f9" stroke="{}" stroke-dasharray="4 2" /><text x="{}" y="{}" font-size="12" fill="#475569">embed: {}</text></g>"##,
                    block.id,
                    block.bounds.x,
                    block.bounds.y,
                    block.bounds.width,
                    block.bounds.height,
                    stroke,
                    block.bounds.x + 12.0,
                    block.bounds.y + 24.0,
                    xml_escape(&label),
                ));
                continue;
            }
            _ => {}
        }

        if block.shape_kind == Some(CanvasShapeKind::Freehand)
            || block.stroke_points.as_ref().is_some_and(|points| points.len() >= 2)
        {
            let points = block.stroke_points.clone().unwrap_or_default();
            if points.len() >= 2 {
                let path = points
                    .iter()
                    .enumerate()
                    .map(|(index, point)| {
                        if index == 0 {
                            format!("M {} {}", point.x, point.y)
                        } else {
                            format!(" L {} {}", point.x, point.y)
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("");
                let stroke_width = block
                    .style
                    .as_ref()
                    .and_then(|style| style.stroke_width)
                    .unwrap_or(2.0);
                svg.push_str(&format!(
                    r##"<g data-block-id="{}"><path d="{}" fill="none" stroke="{}" stroke-width="{}" stroke-linecap="round" stroke-linejoin="round" /></g>"##,
                    block.id,
                    path,
                    stroke,
                    stroke_width,
                ));
                continue;
            }
        }

        let rx = match block.kind {
            CanvasBlockKind::StickyNote => 8.0,
            _ => 2.0,
        };

        svg.push_str(&format!(
            r##"<g data-block-id="{}"><rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}" stroke="{}" /><text x="{}" y="{}" font-family="Segoe UI, sans-serif" font-size="14" fill="#0f172a">{}</text></g>"##,
            block.id,
            block.bounds.x,
            block.bounds.y,
            block.bounds.width,
            block.bounds.height,
            rx,
            fill,
            stroke,
            block.bounds.x + 12.0,
            block.bounds.y + 24.0,
            xml_escape(&label),
        ));
    }

    svg.push_str("</svg>");
    svg
}

pub fn write_snapshot(
    document: &CanvasDocument,
    output_path: &Path,
    format: SnapshotFormat,
    dry_run: bool,
) -> Result<SnapshotOutput, CanvasError> {
    let viewport = scene_bounds(document);

    match format {
        SnapshotFormat::Svg => {
            if dry_run {
                return Ok(SnapshotOutput {
                    format,
                    artifact_path: output_path.display().to_string(),
                    width: viewport.width,
                    height: viewport.height,
                    dry_run: true,
                });
            }
            let svg = render_svg(document, Some(viewport));
            fs::write(output_path, svg).map_err(|source| CanvasError::IoWrite {
                path: output_path.to_path_buf(),
                source,
            })?;
            Ok(SnapshotOutput {
                format,
                artifact_path: output_path.display().to_string(),
                width: viewport.width,
                height: viewport.height,
                dry_run: false,
            })
        }
        SnapshotFormat::Png => {
            if dry_run {
                return Ok(SnapshotOutput {
                    format,
                    artifact_path: output_path.display().to_string(),
                    width: viewport.width,
                    height: viewport.height,
                    dry_run: true,
                });
            }
            let svg = render_svg(document, Some(viewport));
            crate::snapshot_raster::write_png_from_svg(&svg, output_path)?;
            Ok(SnapshotOutput {
                format,
                artifact_path: output_path.display().to_string(),
                width: viewport.width,
                height: viewport.height,
                dry_run: false,
            })
        }
        SnapshotFormat::Pdf => {
            if dry_run {
                return Ok(SnapshotOutput {
                    format,
                    artifact_path: output_path.display().to_string(),
                    width: viewport.width,
                    height: viewport.height,
                    dry_run: true,
                });
            }
            let svg = render_svg(document, Some(viewport));
            crate::snapshot_raster::write_pdf_from_svg(&svg, output_path)?;
            Ok(SnapshotOutput {
                format,
                artifact_path: output_path.display().to_string(),
                width: viewport.width,
                height: viewport.height,
                dry_run: false,
            })
        }
    }
}

fn scene_bounds(document: &CanvasDocument) -> CanvasRect {
    if document.blocks.is_empty() {
        return CanvasRect {
            x: 0.0,
            y: 0.0,
            width: 640.0,
            height: 480.0,
        };
    }

    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;

    for block in &document.blocks {
        min_x = min_x.min(block.bounds.x);
        min_y = min_y.min(block.bounds.y);
        max_x = max_x.max(block.bounds.x + block.bounds.width);
        max_y = max_y.max(block.bounds.y + block.bounds.height);
    }

    CanvasRect {
        x: min_x.floor(),
        y: min_y.floor(),
        width: (max_x - min_x).ceil().max(320.0),
        height: (max_y - min_y).ceil().max(240.0),
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::{apply_template_dry_run, empty_document};

    #[test]
    fn svg_snapshot_contains_block_labels() {
        let document = empty_document("vault", "Board");
        let preview = apply_template_dry_run(&document, "weekly-plan").expect("preview");
        let mut merged = document;
        merged.blocks = preview.blocks_added;
        let svg = render_svg(&merged, None);
        assert!(svg.contains("Weekly focus"));
        assert!(svg.contains("data-block-id"));
    }

    #[test]
    fn png_snapshot_dry_run_reports_dimensions() {
        let document = empty_document("vault", "Board");
        let preview = apply_template_dry_run(&document, "weekly-plan").expect("preview");
        let mut merged = document;
        merged.blocks = preview.blocks_added;
        let temp = std::env::temp_dir().join(format!("scriptor-canvas-png-{}", uuid::Uuid::new_v4()));
        let output = temp.join("board.png");
        let result = write_snapshot(&merged, &output, SnapshotFormat::Png, true).expect("dry-run");
        assert!(result.dry_run);
        assert!(result.width >= 320.0);
        assert!(result.height >= 240.0);
        let _ = std::fs::remove_dir_all(&temp);
    }
}
