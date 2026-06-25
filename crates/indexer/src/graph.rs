use std::collections::{HashMap, HashSet, VecDeque};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::{note_id, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphNode {
    pub id: String,
    pub path: String,
    pub label: String,
    pub unresolved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphQueryOutput {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone)]
struct NoteRow {
    id: String,
    path: String,
    title: String,
}

pub fn query_focused_graph(
    cache: &IndexCache,
    session: &VaultSession,
    focus_path: Option<&str>,
    depth: u32,
    graph_groups: &[scriptor_vault::GraphGroupRule],
) -> Result<GraphQueryOutput, IndexerError> {
    let note_index = load_note_index(cache, &session.descriptor.id)?;
    let link_rows = load_link_rows(cache, &session.descriptor.id)?;
    let note_tags = load_note_tags(cache, &session.descriptor.id)?;

    let max_depth = depth.clamp(1, 5);
    let max_nodes = if focus_path.is_some() { 200 } else { 120 };
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, u32)> = VecDeque::new();
    let mut edges: Vec<GraphEdge> = Vec::new();
    let mut edge_ids: HashSet<String> = HashSet::new();

    let seed_ids: Vec<String> = if let Some(path) = focus_path {
        let key = note_id(&session.descriptor.id, &scriptor_vault::RelativeVaultPath::parse(path)?);
        vec![key]
    } else if note_index.len() <= max_nodes {
        note_index.values().map(|note| note.id.clone()).collect()
    } else {
        note_index
            .values()
            .take(max_nodes)
            .map(|note| note.id.clone())
            .collect()
    };

    for seed in seed_ids {
        if visited.insert(seed.clone()) {
            queue.push_back((seed, 0));
        }
    }

    while let Some((current_id, current_depth)) = queue.pop_front() {
        if current_depth >= max_depth {
            continue;
        }

        for link in link_rows.iter().filter(|row| row.from_note_id == current_id) {
            let edge_id = link.id.clone();
            if edge_ids.insert(edge_id.clone()) {
                let target_id = resolve_target(&note_index, &link.to_path);
                edges.push(GraphEdge {
                    id: edge_id,
                    source: current_id.clone(),
                    target: target_id
                        .as_ref()
                        .map(|(id, _)| id.clone())
                        .unwrap_or_else(|| format!("unresolved:{}", link.to_path)),
                    kind: link.kind.clone(),
                });
            }

            if let Some((target_id, _)) = resolve_target(&note_index, &link.to_path) {
                if visited.insert(target_id.clone()) {
                    queue.push_back((target_id, current_depth + 1));
                }
            }
        }

        for link in link_rows.iter().filter(|row| {
            resolve_target(&note_index, &row.to_path)
                .map(|(id, _)| id == current_id)
                .unwrap_or(false)
        }) {
            let edge_id = link.id.clone();
            if edge_ids.insert(edge_id.clone()) {
                edges.push(GraphEdge {
                    id: edge_id,
                    source: link.from_note_id.clone(),
                    target: current_id.clone(),
                    kind: link.kind.clone(),
                });
            }

            if visited.insert(link.from_note_id.clone()) {
                queue.push_back((link.from_note_id.clone(), current_depth + 1));
            }
        }
    }

    let mut nodes = Vec::new();
    for node_id in visited {
        if let Some(note) = note_index.values().find(|row| row.id == node_id) {
            let color = note_tags
                .get(&note.id)
                .and_then(|tags| {
                    tags.iter()
                        .find_map(|tag| apply_graph_group_color(tag, graph_groups))
                });
            nodes.push(GraphNode {
                id: note.id.clone(),
                path: note.path.clone(),
                label: note.title.clone(),
                unresolved: false,
                color,
            });
            continue;
        }

        if let Some(unresolved) = node_id.strip_prefix("unresolved:") {
            nodes.push(GraphNode {
                id: node_id.clone(),
                path: String::new(),
                label: unresolved.to_string(),
                unresolved: true,
                color: None,
            });
        }
    }

    for edge in &edges {
        if edge.target.starts_with("unresolved:") && !nodes.iter().any(|node| node.id == edge.target) {
            let label = edge.target.trim_start_matches("unresolved:");
            nodes.push(GraphNode {
                id: edge.target.clone(),
                path: String::new(),
                label: label.to_string(),
                unresolved: true,
                color: None,
            });
        }
    }

    nodes.sort_by(|left, right| left.label.cmp(&right.label));

    Ok(GraphQueryOutput { nodes, edges })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphTraverseStep {
    pub path: String,
    pub depth: u32,
    pub via: Option<String>,
}

/// Breadth-first traversal from a focus note for MCP `traverse_graph`.
pub fn traverse_graph(
    cache: &IndexCache,
    session: &VaultSession,
    focus_path: &str,
    depth: u32,
) -> Result<Vec<GraphTraverseStep>, IndexerError> {
    let graph = query_focused_graph(cache, session, Some(focus_path), depth, &[])?;
    let mut steps = vec![GraphTraverseStep {
        path: focus_path.to_string(),
        depth: 0,
        via: None,
    }];

    for edge in graph.edges {
        if let Some(target) = graph.nodes.iter().find(|node| node.id == edge.target && !node.unresolved) {
            steps.push(GraphTraverseStep {
                path: target.path.clone(),
                depth: 1,
                via: Some(edge.kind.clone()),
            });
        }
    }

    steps.sort_by(|left, right| left.path.cmp(&right.path));
    steps.dedup_by(|left, right| left.path == right.path);
    Ok(steps)
}

pub fn apply_graph_group_color(tag: &str, groups: &[scriptor_vault::GraphGroupRule]) -> Option<String> {
    groups
        .iter()
        .find(|group| tag.starts_with(&group.tag_prefix))
        .map(|group| group.color.clone())
}

#[derive(Debug, Clone)]
struct LinkRow {
    id: String,
    from_note_id: String,
    to_path: String,
    kind: String,
}

fn load_note_tags(
    cache: &IndexCache,
    vault_id: &str,
) -> Result<HashMap<String, Vec<String>>, IndexerError> {
    let mut statement = cache
        .connection()
        .prepare("SELECT id, tags_json FROM notes WHERE vault_id = ?1")?;
    let rows = statement.query_map(params![vault_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut tags: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let (note_id, tags_json) = row?;
        let parsed: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        if !parsed.is_empty() {
            tags.insert(note_id, parsed);
        }
    }
    Ok(tags)
}

fn load_note_index(cache: &IndexCache, vault_id: &str) -> Result<HashMap<String, NoteRow>, IndexerError> {
    let mut statement = cache.connection().prepare(
        "SELECT id, path, title FROM notes WHERE vault_id = ?1",
    )?;
    let rows = statement.query_map(params![vault_id], |row| {
        Ok(NoteRow {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
        })
    })?;

    let mut index = HashMap::new();
    for row in rows {
        let note = row?;
        index.insert(note.path.clone(), note);
    }
    Ok(index)
}

fn load_link_rows(cache: &IndexCache, vault_id: &str) -> Result<Vec<LinkRow>, IndexerError> {
    let mut statement = cache.connection().prepare(
        "SELECT id, from_note_id, to_path, kind FROM links WHERE vault_id = ?1",
    )?;
    let rows = statement.query_map(params![vault_id], |row| {
        Ok(LinkRow {
            id: row.get(0)?,
            from_note_id: row.get(1)?,
            to_path: row.get(2)?,
            kind: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn resolve_target(note_index: &HashMap<String, NoteRow>, target: &str) -> Option<(String, String)> {
    if let Some(note) = note_index.get(target) {
        return Some((note.id.clone(), note.path.clone()));
    }

    for note in note_index.values() {
        if note.title.eq_ignore_ascii_case(target) {
            return Some((note.id.clone(), note.path.clone()));
        }
        let stem = note
            .path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or(&note.path);
        if stem.eq_ignore_ascii_case(target) {
            return Some((note.id.clone(), note.path.clone()));
        }
        if note.path.eq_ignore_ascii_case(target) {
            return Some((note.id.clone(), note.path.clone()));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rebuild::rebuild_index;
    use scriptor_vault::open_vault;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn focused_graph_includes_neighbors() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        fs::write(
            dir.path().join("Research Plan.md"),
            "# Research Plan\n\n- [[Field Notes]]\n",
        )?;
        fs::write(dir.path().join("Field Notes.md"), "# Field Notes\n\n")?;

        let session = open_vault(dir.path())?;
        rebuild_index(&session, &[])?;
        let cache = crate::db::IndexCache::open(crate::db::default_cache_path(session.root.root()))?;

        let graph = query_focused_graph(&cache, &session, Some("Research Plan.md"), 1, &[])?;
        assert!(graph.nodes.len() >= 2);
        assert!(!graph.edges.is_empty());
        Ok(())
    }
}
