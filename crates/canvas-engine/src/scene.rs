use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl CanvasRect {
    pub fn contains(&self, point: CanvasPoint) -> bool {
        point.x >= self.x
            && point.y >= self.y
            && point.x <= self.x + self.width
            && point.y <= self.y + self.height
    }

    pub fn intersects(&self, other: &CanvasRect) -> bool {
        self.x < other.x + other.width
            && self.x + self.width > other.x
            && self.y < other.y + other.height
            && self.y + self.height > other.y
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CanvasMode {
    Document,
    Edgeless,
    Presentation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CanvasBlockKind {
    Markdown,
    #[serde(rename = "sticky-note")]
    StickyNote,
    Shape,
    Connector,
    Image,
    Embed,
    Table,
    Template,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CanvasShapeKind {
    Rectangle,
    Ellipse,
    Line,
    Arrow,
    Polygon,
    Freehand,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasStyle {
    pub fill: Option<String>,
    pub stroke: Option<String>,
    pub stroke_width: Option<f64>,
    pub opacity: Option<f64>,
    pub text_style: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasBlock {
    pub id: String,
    pub kind: CanvasBlockKind,
    pub layer_id: String,
    pub bounds: CanvasRect,
    pub z_index: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_note_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shape_kind: Option<CanvasShapeKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<CanvasStyle>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_points: Option<Vec<CanvasPoint>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasLayer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub order: i32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasDocument {
    pub id: String,
    pub vault_id: String,
    pub title: String,
    pub mode: CanvasMode,
    pub layers: Vec<CanvasLayer>,
    pub blocks: Vec<CanvasBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub relations: Vec<CanvasRelation>,
    pub updated_at: String,
}

/// Explicit note endpoints. Drawing proximity never implies a semantic link.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CanvasRelation {
    pub id: String,
    pub connector_block_id: String,
    pub source_note_path: String,
    pub target_note_path: String,
    pub label: String,
}

pub fn validate_relations(document: &CanvasDocument) -> Result<(), crate::CanvasError> {
    if document.relations.len() > 5_000 {
        return Err(crate::CanvasError::InvalidDocument(
            "At most 5000 relations are allowed".into(),
        ));
    }
    let mut ids = std::collections::HashSet::new();
    let connectors = document
        .blocks
        .iter()
        .filter(|b| b.kind == CanvasBlockKind::Connector)
        .map(|b| b.id.as_str())
        .collect::<std::collections::HashSet<_>>();
    for relation in &document.relations {
        if relation.id.is_empty()
            || relation.id.len() > 128
            || !ids.insert(&relation.id)
            || relation.label.trim().is_empty()
            || relation.label.len() > 128
            || !connectors.contains(relation.connector_block_id.as_str())
        {
            return Err(crate::CanvasError::InvalidDocument(
                "Invalid relation identity, label or connector".into(),
            ));
        }
        for path in [&relation.source_note_path, &relation.target_note_path] {
            let relative = scriptor_vault::RelativeVaultPath::parse(path)
                .map_err(|e| crate::CanvasError::InvalidDocument(e.to_string()))?;
            if !relative.as_str().ends_with(".md") || relative.as_str() != path.as_str() {
                return Err(crate::CanvasError::InvalidDocument(
                    "Relation endpoints must be Markdown paths".into(),
                ));
            }
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasTemplate {
    pub id: String,
    pub name: String,
    pub category: String,
    pub blocks: Vec<CanvasBlock>,
    pub default_mode: CanvasMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

pub fn parse_document_json(raw: &str) -> Result<CanvasDocument, serde_json::Error> {
    serde_json::from_str(raw)
}

pub fn document_to_json(document: &CanvasDocument) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(document)
}

pub fn layer_by_id<'a>(document: &'a CanvasDocument, layer_id: &str) -> Option<&'a CanvasLayer> {
    document.layers.iter().find(|layer| layer.id == layer_id)
}

pub fn is_block_selectable(document: &CanvasDocument, block: &CanvasBlock) -> bool {
    if block.locked.unwrap_or(false) {
        return false;
    }
    let Some(layer) = layer_by_id(document, &block.layer_id) else {
        return false;
    };
    layer.visible && !layer.locked
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rect_contains_and_intersects() {
        let rect = CanvasRect {
            x: 10.0,
            y: 20.0,
            width: 100.0,
            height: 50.0,
        };
        assert!(rect.contains(CanvasPoint { x: 10.0, y: 20.0 }));
        assert!(rect.contains(CanvasPoint { x: 110.0, y: 70.0 }));
        assert!(!rect.contains(CanvasPoint { x: 9.0, y: 20.0 }));
        assert!(rect.intersects(&CanvasRect {
            x: 100.0,
            y: 60.0,
            width: 20.0,
            height: 20.0,
        }));
    }
}
