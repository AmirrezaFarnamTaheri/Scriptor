//! Native canvas scene model, spatial hit-testing, templates, and SVG snapshots.

pub mod apply;
pub mod error;
pub mod hit_test;
pub mod scene;
pub mod snapshot;
pub mod snapshot_raster;
pub mod store;
pub mod templates;

pub use apply::{apply_template, restore_template_checkpoint, TemplateApplyOutput, TemplateUndoCheckpoint};

pub use error::CanvasError;
pub use hit_test::{hit_test, query_blocks_in_bounds, HitTestResult};
pub use scene::{
    parse_document_json, document_to_json, CanvasBlock, CanvasBlockKind, CanvasDocument,
    CanvasLayer, CanvasMode, CanvasPoint, CanvasRect, CanvasTemplate,
};
pub use snapshot::{render_svg, write_snapshot, SnapshotFormat, SnapshotOutput};
pub use store::{
    canvas_boards_dir, list_documents, load_document, save_document, CanvasDocumentSummary,
};
pub use templates::{
    apply_template_dry_run, empty_document, list_templates, TemplateApplyPreview,
};

const SNAPSHOT_BUDGET_MS: u128 = 500;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSnapshotBenchReport {
    pub block_count: usize,
    pub iterations: u32,
    pub mean_ms: f64,
    pub budget_ms: u128,
    pub within_budget: bool,
}

pub fn bench_snapshot_render(document: &CanvasDocument, iterations: u32) -> CanvasSnapshotBenchReport {
    let started = Instant::now();
    for _ in 0..iterations {
        let _ = render_svg(document, None);
    }
    let mean_ms = started.elapsed().as_millis() as f64 / iterations as f64;
    CanvasSnapshotBenchReport {
        block_count: document.blocks.len(),
        iterations,
        mean_ms,
        budget_ms: SNAPSHOT_BUDGET_MS,
        within_budget: mean_ms <= SNAPSHOT_BUDGET_MS as f64,
    }
}

use std::path::Path;
use std::time::Instant;

const HIT_TEST_FRAME_BUDGET_MS: u128 = 16;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasHitTestBenchReport {
    pub scenario: &'static str,
    pub block_count: usize,
    pub iterations: u32,
    pub mean_ms: f64,
    pub budget_ms: u128,
    pub within_budget: bool,
}

pub fn load_document_file(path: &Path) -> Result<CanvasDocument, CanvasError> {
    let raw = std::fs::read_to_string(path).map_err(|source| CanvasError::IoRead {
        path: path.to_path_buf(),
        source,
    })?;
    parse_document_json(&raw).map_err(|error| CanvasError::InvalidDocument(error.to_string()))
}

pub fn bench_hit_test_frame(
    document: &CanvasDocument,
    iterations: u32,
) -> CanvasHitTestBenchReport {
    let point = CanvasPoint { x: 120.0, y: 90.0 };
    let bounds = CanvasRect {
        x: 0.0,
        y: 0.0,
        width: 640.0,
        height: 480.0,
    };

    let started = Instant::now();
    for _ in 0..iterations {
        let _ = hit_test(document, point);
        let _ = query_blocks_in_bounds(document, bounds, None);
    }
    let elapsed_ms = started.elapsed().as_millis() as f64;
    let mean_ms = elapsed_ms / iterations as f64;

    CanvasHitTestBenchReport {
        scenario: "canvas-hit-test-frame",
        block_count: document.blocks.len(),
        iterations,
        mean_ms,
        budget_ms: HIT_TEST_FRAME_BUDGET_MS,
        within_budget: mean_ms <= HIT_TEST_FRAME_BUDGET_MS as f64,
    }
}
