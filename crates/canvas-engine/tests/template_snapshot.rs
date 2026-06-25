use std::path::PathBuf;

use scriptor_canvas_engine::{
    apply_template, apply_template_dry_run, load_document_file, render_svg, write_snapshot, SnapshotFormat,
};

#[test]
fn template_apply_writes_undo_checkpoint_and_snapshot() {
    let dir = tempfile::tempdir().expect("tempdir");
    let vault_root = dir.path();
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/test-fixtures/canvas/minimal-board.json");
    let document = load_document_file(&fixture).expect("load fixture");

    let preview = apply_template_dry_run(&document, "research-board").expect("dry-run");
    assert!(!preview.blocks_added.is_empty());

    let applied = apply_template(vault_root, &document, "research-board").expect("apply");
    assert!(applied.blocks_added > 0);
    assert!(vault_root
        .join(".scriptor/canvas/patches")
        .join(format!("template-{}.json", applied.patch_id))
        .exists());

    let svg = render_svg(&applied.document, None);
    assert!(svg.contains("svg"));
    let output = vault_root.join("board.svg");
    let snapshot = write_snapshot(&applied.document, &output, SnapshotFormat::Svg, false).expect("snapshot");
    assert!(!snapshot.dry_run);
    assert!(output.exists());
}
