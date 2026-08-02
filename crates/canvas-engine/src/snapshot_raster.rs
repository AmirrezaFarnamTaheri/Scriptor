use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use std::thread::JoinHandle;

use resvg::usvg::{self, Transform};
use scriptor_export_runner::discover_pandoc;
use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use tiny_skia::Pixmap;

use crate::error::CanvasError;
use crate::snapshot::MAX_SNAPSHOT_DIMENSION;

/// Largest raster edge we will allocate, in pixels.
const MAX_RASTER_DIMENSION: u32 = MAX_SNAPSHOT_DIMENSION as u32;

/// Pick the pixmap size for a tree, scaling the whole scene down proportionally
/// rather than allocating whatever the document asked for.
///
/// `Pixmap::new(w, h)` allocates `w * h * 4` bytes, so an unclamped scene (one
/// block at 100000x100000) requests tens of gigabytes and aborts the process.
/// Returning a bounded size plus a scale factor degrades such a canvas to a
/// smaller image instead.
fn raster_plan(width: u32, height: u32) -> Option<(u32, u32, f32)> {
    if width == 0 || height == 0 {
        return None;
    }
    let longest = width.max(height);
    if longest <= MAX_RASTER_DIMENSION {
        return Some((width, height, 1.0));
    }
    let scale = MAX_RASTER_DIMENSION as f32 / longest as f32;
    let scaled_width = ((width as f32 * scale).floor() as u32).clamp(1, MAX_RASTER_DIMENSION);
    let scaled_height = ((height as f32 * scale).floor() as u32).clamp(1, MAX_RASTER_DIMENSION);
    Some((scaled_width, scaled_height, scale))
}

fn render_tree_to_png(svg: &str, output_path: &Path) -> Result<(), CanvasError> {
    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();

    let tree = usvg::Tree::from_str(svg, &options)
        .map_err(|error| CanvasError::ExportFailed(format!("svg parse failed: {error}")))?;
    let size = tree.size().to_int_size();
    let (width, height, scale) = raster_plan(size.width(), size.height())
        .ok_or_else(|| CanvasError::ExportFailed("invalid png dimensions".into()))?;
    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| CanvasError::ExportFailed("invalid png dimensions".into()))?;

    resvg::render(&tree, Transform::from_scale(scale, scale), &mut pixmap.as_mut());
    pixmap
        .save_png(output_path)
        .map_err(|error| CanvasError::ExportFailed(format!("png write failed: {error}")))?;
    Ok(())
}

pub fn write_png_from_svg(svg: &str, output_path: &Path) -> Result<(), CanvasError> {
    render_tree_to_png(svg, output_path)
}

pub fn write_png_from_svg_async(
    svg: String,
    output_path: PathBuf,
) -> JoinHandle<Result<(), CanvasError>> {
    std::thread::spawn(move || render_tree_to_png(&svg, &output_path))
}

pub fn write_pdf_from_svg(svg: &str, output_path: &Path) -> Result<(), CanvasError> {
    let pandoc = discover_pandoc().map_err(|_| {
        CanvasError::ExportFailed("pandoc is required for PDF canvas snapshots".into())
    })?;

    // A fixed `.tmp/canvas-snapshot.html` next to the output is shared by every
    // job: two concurrent snapshots clobbered each other's HTML and whichever
    // finished first removed the directory out from under the other. A unique
    // directory per job is isolated, and `TempDir`'s drop cleans it up on every
    // path -- including the early return when pandoc fails to start.
    let parent = output_path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(|source| CanvasError::IoWrite {
        path: parent.to_path_buf(),
        source,
    })?;
    let temp_dir = tempfile::Builder::new()
        .prefix("scriptor-canvas-snapshot-")
        .tempdir_in(parent)
        .map_err(|source| CanvasError::IoWrite {
            path: parent.to_path_buf(),
            source,
        })?;

    let html_path = temp_dir.path().join("canvas-snapshot.html");
    let html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{{margin:0;padding:0;}}</style></head><body>{svg}</body></html>"#
    );
    fs::write(&html_path, html).map_err(|source| CanvasError::IoWrite {
        path: html_path.clone(),
        source,
    })?;

    let receipt = run_process(
        ProcessSpec::new(&pandoc.path)
            .arg(&html_path)
            .arg("-o")
            .arg(output_path)
            .arg("--standalone")
            .current_dir(temp_dir.path())
            .timeout(Duration::from_secs(2 * 60))
            .max_output_bytes(256 * 1024)
            .network_policy(NetworkPolicy::Deny)
            .allow_unsandboxed_network_denial(
                std::env::var("SCRIPTOR_ALLOW_UNSANDBOXED_EXTERNAL_TOOLS")
                    .ok()
                    .is_some_and(|value| {
                        matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes")
                    }),
            )
            .expected_sha256(std::env::var("SCRIPTOR_PANDOC_SHA256").ok()),
    )
    .map_err(|error| CanvasError::ExportFailed(format!("pandoc failed: {error}")))?;

    if receipt.exit_code != 0 {
        return Err(CanvasError::ExportFailed(format!(
            "pandoc pdf export failed with code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raster_plan_passes_small_scenes_through_unscaled() {
        assert_eq!(raster_plan(640, 480), Some((640, 480, 1.0)));
    }

    #[test]
    fn raster_plan_rejects_degenerate_sizes() {
        assert_eq!(raster_plan(0, 480), None);
        assert_eq!(raster_plan(640, 0), None);
    }

    #[test]
    fn raster_plan_clamps_absurd_dimensions() {
        let (width, height, scale) = raster_plan(100_000, 50_000).expect("plan");
        assert!(width <= MAX_RASTER_DIMENSION && height <= MAX_RASTER_DIMENSION);
        assert_eq!(width, MAX_RASTER_DIMENSION);
        assert!(scale < 1.0);
        // Aspect ratio preserved within a pixel of rounding.
        assert!((width as f32 / height as f32 - 2.0).abs() < 0.01);
        // The allocation this implies stays bounded.
        let bytes = u64::from(width) * u64::from(height) * 4;
        assert!(bytes < 2 * 1024 * 1024 * 1024, "allocation {bytes} too large");
    }

    #[test]
    fn raster_plan_clamps_the_maximum_u32() {
        let (width, height, _) = raster_plan(u32::MAX, u32::MAX).expect("plan");
        assert!(width <= MAX_RASTER_DIMENSION && height <= MAX_RASTER_DIMENSION);
    }

    #[test]
    fn a_100000px_scene_never_asks_for_a_40gb_pixmap() {
        let (width, height, _) = raster_plan(100_000, 100_000).expect("plan");
        let bytes = u64::from(width) * u64::from(height) * 4;
        assert!(
            bytes <= u64::from(MAX_RASTER_DIMENSION) * u64::from(MAX_RASTER_DIMENSION) * 4,
            "allocation {bytes} exceeds the clamp"
        );
        assert!(bytes < 40 * 1024 * 1024 * 1024);
    }

    /// End-to-end through the real renderer, with an aspect ratio that keeps the
    /// clamped allocation tiny so the assertion is about behaviour, not memory.
    #[test]
    fn oversized_svg_renders_clamped_without_panicking() {
        let dir = tempfile::tempdir().expect("tempdir");
        let output = dir.path().join("huge.png");
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="200" viewBox="0 0 100000 200"><rect width="100000" height="200" fill="#ffffff"/></svg>"##;

        render_tree_to_png(svg, &output).expect("clamped render must succeed");

        let bytes = fs::metadata(&output).expect("png written").len();
        assert!(bytes > 0);
    }
}
