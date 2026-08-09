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
        let fill = sanitize_color(
            block
                .style
                .as_ref()
                .and_then(|style| style.fill.as_deref())
                .unwrap_or("#ffffff"),
            "#ffffff",
        );
        let stroke = sanitize_color(
            block
                .style
                .as_ref()
                .and_then(|style| style.stroke.as_deref())
                .unwrap_or("#64748b"),
            "#64748b",
        );
        let block_id = xml_escape(&block.id);
        let label = block
            .content_ref
            .clone()
            .unwrap_or_else(|| block.id.clone());

        match block.kind {
            CanvasBlockKind::Connector => {
                svg.push_str(&format!(
                    r##"<g data-block-id="{}"><line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{}" stroke-width="2" marker-end="url(#arrow)" /><text x="{}" y="{}" font-size="12" fill="#334155">{}</text></g>"##,
                    block_id,
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
                    block_id,
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
                    block_id,
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
            || block
                .stroke_points
                .as_ref()
                .is_some_and(|points| points.len() >= 2)
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
                    block_id,
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
            block_id,
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
            let handle =
                crate::snapshot_raster::write_png_from_svg_async(svg, output_path.to_path_buf());
            handle
                .join()
                .map_err(|_| CanvasError::ExportFailed("png worker thread panicked".into()))??;
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

/// Hard cap on a snapshot's logical width/height.
///
/// Scene bounds come straight from block coordinates in user-supplied canvas
/// JSON. A single block declaring `width: 100000, height: 100000` produced a
/// 100000x100000 raster request -- ~40 GB for the RGBA pixmap -- which aborts
/// the process instead of returning an error. 16384 matches the maximum texture
/// dimension of essentially every GPU and keeps the worst case near 1 GB.
pub const MAX_SNAPSHOT_DIMENSION: f64 = 16384.0;

/// Clamp a raw dimension into `[minimum, MAX_SNAPSHOT_DIMENSION]`, mapping NaN
/// to the minimum so a hostile document cannot produce a degenerate viewport.
fn clamp_dimension(value: f64, minimum: f64) -> f64 {
    if value.is_nan() {
        return minimum;
    }
    if value.is_infinite() {
        return if value.is_sign_positive() {
            MAX_SNAPSHOT_DIMENSION
        } else {
            minimum
        };
    }
    value.clamp(minimum, MAX_SNAPSHOT_DIMENSION)
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

    let x = if min_x.is_finite() {
        min_x.floor()
    } else {
        0.0
    };
    let y = if min_y.is_finite() {
        min_y.floor()
    } else {
        0.0
    };

    CanvasRect {
        x,
        y,
        width: clamp_dimension((max_x - min_x).ceil(), 320.0),
        height: clamp_dimension((max_y - min_y).ceil(), 240.0),
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Accept only `#rgb`..`#rrggbbaa` hex colors or plain ASCII-alphabetic color
/// names; anything else (quotes, spaces, functional notation) falls back to a
/// safe default so canvas JSON can never inject SVG attributes.
fn sanitize_color(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    let hex_ok = trimmed.strip_prefix('#').is_some_and(|rest| {
        (3..=8).contains(&rest.len()) && rest.chars().all(|c| c.is_ascii_hexdigit())
    });
    let name_ok = !trimmed.is_empty()
        && trimmed.len() <= 32
        && trimmed.chars().all(|c| c.is_ascii_alphabetic());
    if hex_ok || name_ok {
        trimmed.to_string()
    } else {
        fallback.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::{CanvasBlock, CanvasBlockKind, CanvasStyle};
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
    fn svg_escapes_hostile_style_and_id() {
        let mut document = empty_document("vault", "Board");
        let layer_id = document
            .layers
            .first()
            .map(|layer| layer.id.clone())
            .unwrap_or_else(|| "layer".into());
        document.blocks.push(CanvasBlock {
            id: r#"a"/><script>alert(1)</script>"#.into(),
            kind: CanvasBlockKind::Markdown,
            layer_id,
            bounds: CanvasRect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 50.0,
            },
            z_index: 0,
            source_note_id: None,
            shape_kind: None,
            content_ref: None,
            style: Some(CanvasStyle {
                fill: Some(r#"#fff" onload="alert(1)"#.into()),
                stroke: Some(r#"red"><script>x</script>"#.into()),
                stroke_width: None,
                opacity: None,
                text_style: None,
            }),
            locked: None,
            stroke_points: None,
        });

        let svg = render_svg(&document, None);
        assert!(
            !svg.contains("<script>"),
            "script tag must not survive: {svg}"
        );
        assert!(
            !svg.contains(r#"" onload="#),
            "attribute breakout must not survive: {svg}"
        );
        // Hostile colors fall back to safe defaults.
        assert!(svg.contains(r##"fill="#ffffff""##));
        assert!(svg.contains(r##"stroke="#64748b""##));
        // The hostile id is escaped, not dropped.
        assert!(svg.contains("a&quot;/&gt;&lt;script&gt;"));
    }

    fn block_with_bounds(document: &CanvasDocument, bounds: CanvasRect) -> CanvasBlock {
        let layer_id = document
            .layers
            .first()
            .map(|layer| layer.id.clone())
            .unwrap_or_else(|| "layer".into());
        CanvasBlock {
            id: "huge".into(),
            kind: CanvasBlockKind::Markdown,
            layer_id,
            bounds,
            z_index: 0,
            source_note_id: None,
            shape_kind: None,
            content_ref: None,
            style: None,
            locked: None,
            stroke_points: None,
        }
    }

    #[test]
    fn absurd_block_bounds_are_clamped() {
        let mut document = empty_document("vault", "Board");
        let block = block_with_bounds(
            &document,
            CanvasRect {
                x: 0.0,
                y: 0.0,
                width: 100_000.0,
                height: 100_000.0,
            },
        );
        document.blocks.push(block);

        let bounds = scene_bounds(&document);
        assert_eq!(bounds.width, MAX_SNAPSHOT_DIMENSION);
        assert_eq!(bounds.height, MAX_SNAPSHOT_DIMENSION);
        // 16384^2 * 4 bytes is bounded; 100000^2 * 4 would be ~40 GB.
        let bytes = bounds.width * bounds.height * 4.0;
        assert!(bytes < 2e9, "raster allocation {bytes} is not bounded");
    }

    #[test]
    fn non_finite_block_bounds_do_not_panic() {
        for (width, height) in [
            (f64::NAN, f64::NAN),
            (f64::INFINITY, f64::INFINITY),
            (-1.0, -1.0),
            (f64::MAX, f64::MAX),
        ] {
            let mut document = empty_document("vault", "Board");
            let block = block_with_bounds(
                &document,
                CanvasRect {
                    x: 0.0,
                    y: 0.0,
                    width,
                    height,
                },
            );
            document.blocks.push(block);

            let bounds = scene_bounds(&document);
            assert!(bounds.width.is_finite() && bounds.height.is_finite());
            assert!(bounds.width >= 320.0 && bounds.width <= MAX_SNAPSHOT_DIMENSION);
            assert!(bounds.height >= 240.0 && bounds.height <= MAX_SNAPSHOT_DIMENSION);
        }
    }

    #[test]
    fn absurd_bounds_snapshot_reports_bounded_dimensions() {
        let mut document = empty_document("vault", "Board");
        let block = block_with_bounds(
            &document,
            CanvasRect {
                x: -50_000.0,
                y: -50_000.0,
                width: 500_000.0,
                height: 500_000.0,
            },
        );
        document.blocks.push(block);

        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-huge-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).expect("temp");
        let output = temp.join("board.svg");
        let result = write_snapshot(&document, &output, SnapshotFormat::Svg, false)
            .expect("huge canvas must export, not abort");
        assert!(result.width <= MAX_SNAPSHOT_DIMENSION);
        assert!(result.height <= MAX_SNAPSHOT_DIMENSION);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn clamp_dimension_bounds_every_input() {
        assert_eq!(clamp_dimension(f64::NAN, 320.0), 320.0);
        assert_eq!(
            clamp_dimension(f64::INFINITY, 320.0),
            MAX_SNAPSHOT_DIMENSION
        );
        assert_eq!(clamp_dimension(f64::NEG_INFINITY, 320.0), 320.0);
        assert_eq!(clamp_dimension(-5.0, 320.0), 320.0);
        assert_eq!(clamp_dimension(1e12, 320.0), MAX_SNAPSHOT_DIMENSION);
        assert_eq!(clamp_dimension(640.0, 320.0), 640.0);
    }

    #[test]
    fn sanitize_color_accepts_hex_and_names_only() {
        assert_eq!(sanitize_color("#abc", "#000000"), "#abc");
        assert_eq!(sanitize_color("#AABBCCDD", "#000000"), "#AABBCCDD");
        assert_eq!(sanitize_color("rebeccapurple", "#000000"), "rebeccapurple");
        assert_eq!(sanitize_color("url(#evil)", "#000000"), "#000000");
        assert_eq!(sanitize_color("#ggg", "#000000"), "#000000");
        assert_eq!(sanitize_color("red\" x=\"y", "#000000"), "#000000");
    }

    #[test]
    fn png_snapshot_dry_run_reports_dimensions() {
        let document = empty_document("vault", "Board");
        let preview = apply_template_dry_run(&document, "weekly-plan").expect("preview");
        let mut merged = document;
        merged.blocks = preview.blocks_added;
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-png-{}", uuid::Uuid::new_v4()));
        let output = temp.join("board.png");
        let result = write_snapshot(&merged, &output, SnapshotFormat::Png, true).expect("dry-run");
        assert!(result.dry_run);
        assert!(result.width >= 320.0);
        assert!(result.height >= 240.0);
        let _ = std::fs::remove_dir_all(&temp);
    }
}
