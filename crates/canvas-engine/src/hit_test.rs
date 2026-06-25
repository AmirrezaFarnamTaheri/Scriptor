use serde::{Deserialize, Serialize};

use crate::scene::{
    is_block_selectable, CanvasBlock, CanvasBlockKind, CanvasDocument, CanvasPoint, CanvasRect,
};

fn block_kind_label(kind: &CanvasBlockKind) -> &'static str {
    match kind {
        CanvasBlockKind::Markdown => "markdown",
        CanvasBlockKind::StickyNote => "sticky-note",
        CanvasBlockKind::Shape => "shape",
        CanvasBlockKind::Connector => "connector",
        CanvasBlockKind::Image => "image",
        CanvasBlockKind::Embed => "embed",
        CanvasBlockKind::Table => "table",
        CanvasBlockKind::Template => "template",
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HitTestResult {
    pub block_id: String,
    pub layer_id: String,
    pub kind: String,
}

pub fn hit_test(document: &CanvasDocument, point: CanvasPoint) -> Option<HitTestResult> {
    let mut candidates: Vec<&CanvasBlock> = document
        .blocks
        .iter()
        .filter(|block| is_block_selectable(document, block) && block.bounds.contains(point))
        .collect();

    candidates.sort_by(|left, right| right.z_index.cmp(&left.z_index));

    candidates.first().map(|block| HitTestResult {
        block_id: block.id.clone(),
        layer_id: block.layer_id.clone(),
        kind: block_kind_label(&block.kind).to_string(),
    })
}

pub fn query_blocks_in_bounds(
    document: &CanvasDocument,
    bounds: CanvasRect,
    kinds: Option<&[String]>,
) -> Vec<CanvasBlock> {
    let mut blocks: Vec<CanvasBlock> = document
        .blocks
        .iter()
        .filter(|block| {
            let Some(layer) = crate::scene::layer_by_id(document, &block.layer_id) else {
                return false;
            };
            if !layer.visible {
                return false;
            }
            if !block.bounds.intersects(&bounds) {
                return false;
            }
            if let Some(filter) = kinds {
                let kind = block_kind_label(&block.kind);
                return filter.iter().any(|entry| entry == kind);
            }
            true
        })
        .cloned()
        .collect();

    blocks.sort_by(|left, right| right.z_index.cmp(&left.z_index));
    blocks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::{
        CanvasBlock, CanvasBlockKind, CanvasDocument, CanvasLayer, CanvasMode, CanvasRect,
    };

    fn overlap_fixture() -> CanvasDocument {
        CanvasDocument {
            id: "canvas-overlap".into(),
            vault_id: "vault-fixture".into(),
            title: "Overlap".into(),
            mode: CanvasMode::Edgeless,
            layers: vec![
                CanvasLayer {
                    id: "layer-base".into(),
                    name: "Base".into(),
                    visible: true,
                    locked: false,
                    order: 0,
                },
                CanvasLayer {
                    id: "layer-overlay".into(),
                    name: "Overlay".into(),
                    visible: true,
                    locked: false,
                    order: 1,
                },
            ],
            blocks: vec![
                CanvasBlock {
                    id: "block-low".into(),
                    kind: CanvasBlockKind::Shape,
                    layer_id: "layer-base".into(),
                    bounds: CanvasRect {
                        x: 0.0,
                        y: 0.0,
                        width: 200.0,
                        height: 200.0,
                    },
                    z_index: 1,
                    source_note_id: None,
                    shape_kind: None,
                    content_ref: None,
                    style: None,
                    locked: None,
                    stroke_points: None,
                },
                CanvasBlock {
                    id: "block-high".into(),
                    kind: CanvasBlockKind::StickyNote,
                    layer_id: "layer-overlay".into(),
                    bounds: CanvasRect {
                        x: 50.0,
                        y: 50.0,
                        width: 120.0,
                        height: 80.0,
                    },
                    z_index: 5,
                    source_note_id: None,
                    shape_kind: None,
                    content_ref: Some("Idea".into()),
                    style: None,
                    locked: None,
                    stroke_points: None,
                },
            ],
            updated_at: "2026-06-20T00:00:00Z".into(),
        }
    }

    #[test]
    fn hit_test_prefers_highest_z_index() {
        let document = overlap_fixture();
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
    fn locked_layer_blocks_are_not_selectable() {
        let mut document = overlap_fixture();
        document.layers[1].locked = true;
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
}
