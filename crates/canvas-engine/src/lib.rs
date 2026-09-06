//! Native canvas scene model, spatial hit-testing, templates, and SVG snapshots.

pub mod apply;
pub mod error;
pub mod hit_test;
pub mod scene;
pub mod snapshot;
pub mod snapshot_raster;
pub mod store;
pub mod templates;

pub use apply::{
    TemplateApplyOutput, TemplateUndoCheckpoint, apply_template, restore_template_checkpoint,
};

pub use error::CanvasError;
pub use hit_test::{HitTestResult, hit_test, query_blocks_in_bounds};
pub use scene::{
    CanvasBlock, CanvasBlockKind, CanvasDocument, CanvasLayer, CanvasMode, CanvasPoint, CanvasRect,
    CanvasTemplate, document_to_json, parse_document_json,
};
pub use snapshot::{
    MAX_SNAPSHOT_DIMENSION, SnapshotFormat, SnapshotOutput, render_svg, write_snapshot,
};
pub use snapshot_raster::{write_png_from_svg, write_png_from_svg_async};
pub use store::{
    CanvasDocumentSummary, canvas_boards_dir, list_documents, list_documents_reporting_skipped,
    load_document, save_document,
};
pub use templates::{TemplateApplyPreview, apply_template_dry_run, empty_document, list_templates};

const SNAPSHOT_BUDGET_MS: u128 = 500;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSnapshotBenchReport {
    pub block_count: usize,
    pub iterations: u32,
    pub mean_ms: f64,
    pub samples_ms: Vec<f64>,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub budget_ms: u128,
    pub within_budget: bool,
}

pub fn bench_snapshot_render(
    document: &CanvasDocument,
    iterations: u32,
) -> CanvasSnapshotBenchReport {
    let mut samples_ms = Vec::with_capacity(iterations as usize);
    for _ in 0..iterations {
        let started = Instant::now();
        let _ = render_svg(document, None);
        samples_ms.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    let (mean_ms, p50_ms, p95_ms) = summarize_benchmark_samples(&samples_ms);
    CanvasSnapshotBenchReport {
        block_count: document.blocks.len(),
        iterations,
        mean_ms,
        samples_ms,
        p50_ms,
        p95_ms,
        budget_ms: SNAPSHOT_BUDGET_MS,
        within_budget: mean_ms <= SNAPSHOT_BUDGET_MS as f64,
    }
}

use std::path::Path;
use std::time::Instant;
fn summarize_benchmark_samples(samples: &[f64]) -> (f64, f64, f64) {
    if samples.is_empty() {
        return (0.0, 0.0, 0.0);
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    let mean = sorted.iter().sum::<f64>() / sorted.len() as f64;
    let percentile = |p: f64| {
        let index = ((sorted.len() as f64 * p).ceil() as usize).saturating_sub(1);
        sorted[index.min(sorted.len() - 1)]
    };
    (mean, percentile(0.50), percentile(0.95))
}

const HIT_TEST_FRAME_BUDGET_MS: u128 = 16;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasHitTestBenchReport {
    pub scenario: &'static str,
    pub block_count: usize,
    pub iterations: u32,
    pub mean_ms: f64,
    pub samples_ms: Vec<f64>,
    pub p50_ms: f64,
    pub p95_ms: f64,
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

    let mut samples_ms = Vec::with_capacity(iterations as usize);
    for _ in 0..iterations {
        let started = Instant::now();
        let _ = hit_test(document, point);
        let _ = query_blocks_in_bounds(document, bounds, None);
        samples_ms.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    let (mean_ms, p50_ms, p95_ms) = summarize_benchmark_samples(&samples_ms);

    CanvasHitTestBenchReport {
        scenario: "canvas-hit-test-frame",
        block_count: document.blocks.len(),
        iterations,
        mean_ms,
        samples_ms,
        p50_ms,
        p95_ms,
        budget_ms: HIT_TEST_FRAME_BUDGET_MS,
        within_budget: mean_ms <= HIT_TEST_FRAME_BUDGET_MS as f64,
    }
}

#[cfg(test)]
mod benchmark_tests {
    use super::*;

    #[test]
    fn benchmark_summary_handles_zero_iterations() {
        assert_eq!(summarize_benchmark_samples(&[]), (0.0, 0.0, 0.0));
    }
}
