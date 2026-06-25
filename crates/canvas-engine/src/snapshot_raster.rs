use std::fs;
use std::path::Path;
use std::process::Command;

use scriptor_export_runner::discover_pandoc;
use resvg::usvg::{self, Transform};
use tiny_skia::Pixmap;

use crate::error::CanvasError;

pub fn write_png_from_svg(svg: &str, output_path: &Path) -> Result<(), CanvasError> {
    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();

    let tree = usvg::Tree::from_str(svg, &options)
        .map_err(|error| CanvasError::ExportFailed(format!("svg parse failed: {error}")))?;
    let size = tree.size().to_int_size();
    let mut pixmap = Pixmap::new(size.width(), size.height())
        .ok_or_else(|| CanvasError::ExportFailed("invalid png dimensions".into()))?;

    resvg::render(&tree, Transform::default(), &mut pixmap.as_mut());
    pixmap
        .save_png(output_path)
        .map_err(|error| CanvasError::ExportFailed(format!("png write failed: {error}")))?;
    Ok(())
}

pub fn write_pdf_from_svg(svg: &str, output_path: &Path) -> Result<(), CanvasError> {
    let pandoc = discover_pandoc().map_err(|_| {
        CanvasError::ExportFailed("pandoc is required for PDF canvas snapshots".into())
    })?;

    let temp_dir = output_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".tmp");
    fs::create_dir_all(&temp_dir).map_err(|source| CanvasError::IoWrite {
        path: temp_dir.clone(),
        source,
    })?;

    let html_path = temp_dir.join("canvas-snapshot.html");
    let html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{{margin:0;padding:0;}}</style></head><body>{svg}</body></html>"#
    );
    fs::write(&html_path, html).map_err(|source| CanvasError::IoWrite {
        path: html_path.clone(),
        source,
    })?;

    let output = Command::new(&pandoc.path)
        .arg(&html_path)
        .arg("-o")
        .arg(output_path)
        .arg("--standalone")
        .output()
        .map_err(|error| CanvasError::ExportFailed(format!("pandoc failed to start: {error}")))?;

    let _ = fs::remove_file(&html_path);

    if !output.status.success() {
        return Err(CanvasError::ExportFailed(format!(
            "pandoc pdf export failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    Ok(())
}
