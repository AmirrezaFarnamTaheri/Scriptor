//! Fixture parity tests for serialized canvas scenes.

use std::path::PathBuf;

use scriptor_canvas_engine::{hit_test, load_document_file, CanvasPoint};

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/test-fixtures/canvas")
        .join(name)
}

#[test]
fn overlap_fixture_prefers_top_block() {
    let document = load_document_file(&fixture_path("overlap-blocks.json")).expect("fixture");
    let hit = hit_test(
        &document,
        CanvasPoint {
            x: 100.0,
            y: 100.0,
        },
    )
    .expect("hit");
    assert_eq!(hit.block_id, "block-high");
}

#[test]
fn locked_layer_fixture_skips_overlay_block() {
    let document = load_document_file(&fixture_path("locked-layer.json")).expect("fixture");
    let hit = hit_test(
        &document,
        CanvasPoint {
            x: 100.0,
            y: 100.0,
        },
    )
    .expect("hit");
    assert_eq!(hit.block_id, "block-low");
}
