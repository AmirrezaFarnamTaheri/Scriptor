use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::CanvasError;
use crate::scene::{
    CanvasBlock, CanvasBlockKind, CanvasDocument, CanvasLayer, CanvasMode, CanvasRect, CanvasStyle,
    CanvasTemplate,
};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateApplyPreview {
    pub template_id: String,
    pub blocks_added: Vec<CanvasBlock>,
    pub patch_log: Vec<String>,
}

pub fn list_templates() -> Vec<CanvasTemplate> {
    vec![research_board_template(), weekly_plan_template()]
}

pub fn apply_template_dry_run(
    document: &CanvasDocument,
    template_id: &str,
) -> Result<TemplateApplyPreview, CanvasError> {
    let template = list_templates()
        .into_iter()
        .find(|entry| entry.id == template_id)
        .ok_or_else(|| CanvasError::UnknownTemplate(template_id.to_string()))?;

    let mut blocks_added = Vec::new();
    let mut patch_log = vec![format!(
        "dry-run apply template '{}' to canvas '{}'",
        template.id, document.id
    )];

    for (index, block) in template.blocks.iter().enumerate() {
        let new_id = format!("{}-{}", template.id, Uuid::new_v4());
        let mut cloned = block.clone();
        cloned.id = new_id.clone();
        cloned.z_index = document
            .blocks
            .iter()
            .map(|entry| entry.z_index)
            .max()
            .unwrap_or(0)
            + 1
            + index as i32;
        patch_log.push(format!("add block {new_id} ({:?}) at z={}", cloned.kind, cloned.z_index));
        blocks_added.push(cloned);
    }

    Ok(TemplateApplyPreview {
        template_id: template.id,
        blocks_added,
        patch_log,
    })
}

fn research_board_template() -> CanvasTemplate {
    CanvasTemplate {
        id: "research-board".into(),
        name: "Research Board".into(),
        category: "research".into(),
        default_mode: CanvasMode::Edgeless,
        description: Some("Question, evidence, and synthesis sticky columns.".into()),
        blocks: vec![
            sticky_block("question", 40.0, 40.0, "#fef3c7", "Research question"),
            sticky_block("evidence", 220.0, 40.0, "#dbeafe", "Evidence cluster"),
            sticky_block("synthesis", 400.0, 40.0, "#dcfce7", "Synthesis"),
            markdown_block("summary", 40.0, 220.0, "Summary note"),
        ],
    }
}

fn weekly_plan_template() -> CanvasTemplate {
    CanvasTemplate {
        id: "weekly-plan".into(),
        name: "Weekly Plan".into(),
        category: "planning".into(),
        default_mode: CanvasMode::Edgeless,
        description: Some("Five day lanes with a focus block.".into()),
        blocks: vec![
            sticky_block("mon", 20.0, 20.0, "#fee2e2", "Mon"),
            sticky_block("tue", 140.0, 20.0, "#ffedd5", "Tue"),
            sticky_block("wed", 260.0, 20.0, "#fef9c3", "Wed"),
            sticky_block("thu", 380.0, 20.0, "#dcfce7", "Thu"),
            sticky_block("fri", 500.0, 20.0, "#dbeafe", "Fri"),
            markdown_block("focus", 20.0, 160.0, "Weekly focus"),
        ],
    }
}

fn sticky_block(id: &str, x: f64, y: f64, fill: &str, label: &str) -> CanvasBlock {
    CanvasBlock {
        id: id.into(),
        kind: CanvasBlockKind::StickyNote,
        layer_id: "layer-main".into(),
        bounds: CanvasRect {
            x,
            y,
            width: 100.0,
            height: 80.0,
        },
        z_index: 1,
        source_note_id: None,
        shape_kind: None,
        content_ref: Some(label.into()),
        style: Some(CanvasStyle {
            fill: Some(fill.into()),
            stroke: Some("#334155".into()),
            stroke_width: Some(1.0),
            opacity: Some(1.0),
            text_style: Some("body".into()),
        }),
        locked: None,
        stroke_points: None,
    }
}

fn markdown_block(id: &str, x: f64, y: f64, label: &str) -> CanvasBlock {
    CanvasBlock {
        id: id.into(),
        kind: CanvasBlockKind::Markdown,
        layer_id: "layer-main".into(),
        bounds: CanvasRect {
            x,
            y,
            width: 280.0,
            height: 160.0,
        },
        z_index: 2,
        source_note_id: None,
        shape_kind: None,
        content_ref: Some(label.into()),
        style: Some(CanvasStyle {
            fill: Some("#ffffff".into()),
            stroke: Some("#94a3b8".into()),
            stroke_width: Some(1.0),
            opacity: Some(1.0),
            text_style: Some("heading".into()),
        }),
        locked: None,
        stroke_points: None,
    }
}

pub fn empty_document(vault_id: &str, title: &str) -> CanvasDocument {
    CanvasDocument {
        id: format!("canvas-{}", Uuid::new_v4()),
        vault_id: vault_id.into(),
        title: title.into(),
        mode: CanvasMode::Edgeless,
        layers: vec![CanvasLayer {
            id: "layer-main".into(),
            name: "Main".into(),
            visible: true,
            locked: false,
            order: 0,
        }],
        blocks: vec![],
        updated_at: "2026-06-20T00:00:00Z".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_dry_run_adds_blocks_without_mutating_source() {
        let document = empty_document("vault-1", "Board");
        let preview = apply_template_dry_run(&document, "research-board").expect("preview");
        assert_eq!(preview.blocks_added.len(), 4);
        assert!(document.blocks.is_empty());
        assert!(preview.patch_log.len() >= 2);
    }
}
