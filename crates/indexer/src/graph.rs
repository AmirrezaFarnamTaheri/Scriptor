use std::collections::{HashMap, HashSet};

use rusqlite::{params, params_from_iter, types::Value};
use serde::{Deserialize, Serialize};

use scriptor_vault::{note_id, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;

const MAX_FOCUSED_NODES: usize = 200;
const MAX_OVERVIEW_NODES: usize = 120;
pub const MAX_GRAPH_DEPTH: u32 = 5;

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

#[derive(Debug, Clone)]
struct NeighborLink {
    id: String,
    from: NoteRow,
    target: Option<NoteRow>,
    unresolved_target: String,
    kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphTraverseStep {
    pub path: String,
    pub depth: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub via: Option<String>,
}

#[derive(Debug)]
struct GraphSlice {
    notes: HashMap<String, NoteRow>,
    edges: Vec<GraphEdge>,
    unresolved: HashSet<String>,
    steps: Vec<GraphTraverseStep>,
}

pub fn query_focused_graph(
    cache: &IndexCache,
    session: &VaultSession,
    focus_path: Option<&str>,
    depth: u32,
    graph_groups: &[scriptor_vault::GraphGroupRule],
) -> Result<GraphQueryOutput, IndexerError> {
    let slice = if let Some(path) = focus_path {
        collect_focused_slice(cache, session, path, depth)?
    } else {
        collect_overview_slice(cache, session)?
    };
    let note_ids = slice.notes.keys().cloned().collect::<Vec<_>>();
    let note_tags = load_note_tags(cache, &session.descriptor.id, &note_ids)?;

    let mut nodes = slice
        .notes
        .values()
        .map(|note| GraphNode {
            id: note.id.clone(),
            path: note.path.clone(),
            label: note.title.clone(),
            unresolved: false,
            color: note_tags.get(&note.id).and_then(|tags| {
                tags.iter()
                    .find_map(|tag| apply_graph_group_color(tag, graph_groups))
            }),
        })
        .collect::<Vec<_>>();
    nodes.extend(slice.unresolved.into_iter().map(|target| GraphNode {
        id: format!("unresolved:{target}"),
        path: String::new(),
        label: target,
        unresolved: true,
        color: None,
    }));
    nodes.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
            .then_with(|| left.path.cmp(&right.path))
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(GraphQueryOutput {
        nodes,
        edges: slice.edges,
    })
}

/// Breadth-first traversal from a focus note for MCP `traverse_graph`.
///
/// Each frontier is fetched through indexed `from_note_id`/`to_note_id` queries;
/// the implementation never loads the entire vault graph into memory.
pub fn traverse_graph(
    cache: &IndexCache,
    session: &VaultSession,
    focus_path: &str,
    depth: u32,
) -> Result<Vec<GraphTraverseStep>, IndexerError> {
    Ok(collect_focused_slice(cache, session, focus_path, depth)?.steps)
}

fn collect_focused_slice(
    cache: &IndexCache,
    session: &VaultSession,
    focus_path: &str,
    depth: u32,
) -> Result<GraphSlice, IndexerError> {
    let relative = scriptor_vault::RelativeVaultPath::parse(focus_path)?;
    let focus_id = note_id(&session.descriptor.id, &relative);
    let Some(focus) = load_note_by_id(cache, &session.descriptor.id, &focus_id)? else {
        return Ok(GraphSlice {
            notes: HashMap::new(),
            edges: Vec::new(),
            unresolved: HashSet::new(),
            steps: Vec::new(),
        });
    };

    let max_depth = depth.clamp(1, MAX_GRAPH_DEPTH);
    let mut notes = HashMap::from([(focus.id.clone(), focus.clone())]);
    let mut visited = HashSet::from([focus.id.clone()]);
    let mut frontier = vec![focus.id.clone()];
    let mut steps = vec![GraphTraverseStep {
        path: focus.path,
        depth: 0,
        parent_path: None,
        via: None,
    }];
    let mut edges = Vec::new();
    let mut edge_ids = HashSet::new();
    let mut unresolved = HashSet::new();

    for next_depth in 1..=max_depth {
        if frontier.is_empty() || visited.len() >= MAX_FOCUSED_NODES {
            break;
        }
        let links = load_neighbor_links(cache, &session.descriptor.id, &frontier)?;
        let frontier_set = frontier.iter().map(String::as_str).collect::<HashSet<_>>();
        let mut candidates = Vec::<(NoteRow, String, String)>::new();

        for link in links {
            let target_id = link.target.as_ref().map(|target| target.id.clone());
            let target_key = target_id
                .clone()
                .unwrap_or_else(|| format!("unresolved:{}", link.unresolved_target));
            if edge_ids.insert(link.id.clone()) {
                edges.push(GraphEdge {
                    id: link.id.clone(),
                    source: link.from.id.clone(),
                    target: target_key,
                    kind: link.kind.clone(),
                });
            }

            if frontier_set.contains(link.from.id.as_str()) {
                if let Some(target) = link.target.clone() {
                    candidates.push((target, link.from.id.clone(), link.kind.clone()));
                } else if !link.unresolved_target.is_empty() {
                    unresolved.insert(link.unresolved_target.clone());
                }
            }
            if let Some(target) = link.target.as_ref()
                && frontier_set.contains(target.id.as_str())
            {
                candidates.push((link.from.clone(), target.id.clone(), link.kind.clone()));
            }
        }

        candidates.sort_by(|left, right| {
            left.0
                .path
                .to_ascii_lowercase()
                .cmp(&right.0.path.to_ascii_lowercase())
                .then_with(|| left.1.cmp(&right.1))
                .then_with(|| left.2.cmp(&right.2))
                .then_with(|| left.0.id.cmp(&right.0.id))
        });

        let mut next_frontier = Vec::new();
        for (note, parent_id, via) in candidates {
            if visited.len() >= MAX_FOCUSED_NODES {
                break;
            }
            if !visited.insert(note.id.clone()) {
                continue;
            }
            let parent_path = notes.get(&parent_id).map(|parent| parent.path.clone());
            steps.push(GraphTraverseStep {
                path: note.path.clone(),
                depth: next_depth,
                parent_path,
                via: Some(via),
            });
            next_frontier.push(note.id.clone());
            notes.insert(note.id.clone(), note);
        }
        frontier = next_frontier;
    }

    let visible = notes.keys().map(String::as_str).collect::<HashSet<_>>();
    edges.retain(|edge| {
        visible.contains(edge.source.as_str())
            && (visible.contains(edge.target.as_str()) || edge.target.starts_with("unresolved:"))
    });
    edges.sort_by(|left, right| {
        left.source
            .cmp(&right.source)
            .then_with(|| left.target.cmp(&right.target))
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(GraphSlice {
        notes,
        edges,
        unresolved,
        steps,
    })
}

fn collect_overview_slice(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<GraphSlice, IndexerError> {
    let notes = load_overview_notes(cache, &session.descriptor.id, MAX_OVERVIEW_NODES)?;
    let note_map = notes
        .into_iter()
        .map(|note| (note.id.clone(), note))
        .collect::<HashMap<_, _>>();
    let ids = note_map.keys().cloned().collect::<Vec<_>>();
    let visible = ids.iter().map(String::as_str).collect::<HashSet<_>>();
    let links = load_neighbor_links(cache, &session.descriptor.id, &ids)?;
    let mut edges = Vec::new();
    let mut edge_ids = HashSet::new();
    let mut unresolved = HashSet::new();
    for link in links {
        if !visible.contains(link.from.id.as_str()) || !edge_ids.insert(link.id.clone()) {
            continue;
        }
        match link.target {
            Some(target) if visible.contains(target.id.as_str()) => edges.push(GraphEdge {
                id: link.id,
                source: link.from.id,
                target: target.id,
                kind: link.kind,
            }),
            None if !link.unresolved_target.is_empty() => {
                unresolved.insert(link.unresolved_target.clone());
                edges.push(GraphEdge {
                    id: link.id,
                    source: link.from.id,
                    target: format!("unresolved:{}", link.unresolved_target),
                    kind: link.kind,
                });
            }
            _ => {}
        }
    }
    edges.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(GraphSlice {
        notes: note_map,
        edges,
        unresolved,
        steps: Vec::new(),
    })
}

fn load_note_by_id(
    cache: &IndexCache,
    vault_id: &str,
    id: &str,
) -> Result<Option<NoteRow>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT id, path, title FROM notes WHERE vault_id = ?1 AND id = ?2 LIMIT 1",
    )?;
    let mut rows = statement.query(params![vault_id, id])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };
    Ok(Some(NoteRow {
        id: row.get(0)?,
        path: row.get(1)?,
        title: row.get(2)?,
    }))
}

fn load_overview_notes(
    cache: &IndexCache,
    vault_id: &str,
    limit: usize,
) -> Result<Vec<NoteRow>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT id, path, title
         FROM notes
         WHERE vault_id = ?1
         ORDER BY lower(title), lower(path)
         LIMIT ?2",
    )?;
    let rows = statement.query_map(params![vault_id, limit as i64], |row| {
        Ok(NoteRow {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn load_neighbor_links(
    cache: &IndexCache,
    vault_id: &str,
    frontier: &[String],
) -> Result<Vec<NeighborLink>, IndexerError> {
    if frontier.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = std::iter::repeat("?").take(frontier.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT
           l.id,
           l.kind,
           l.to_path,
           source.id,
           source.path,
           source.title,
           target.id,
           target.path,
           target.title
         FROM links l
         JOIN notes source ON source.id = l.from_note_id AND source.vault_id = l.vault_id
         LEFT JOIN notes target ON target.id = l.to_note_id AND target.vault_id = l.vault_id
         WHERE l.vault_id = ?
           AND (l.from_note_id IN ({placeholders}) OR l.to_note_id IN ({placeholders}))
         ORDER BY lower(source.path), lower(COALESCE(target.path, l.to_path)), l.id"
    );
    let mut values = Vec::with_capacity(1 + frontier.len() * 2);
    values.push(Value::Text(vault_id.to_string()));
    values.extend(frontier.iter().cloned().map(Value::Text));
    values.extend(frontier.iter().cloned().map(Value::Text));

    let conn = cache.connection()?;
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params_from_iter(values.iter()), |row| {
        let target_id = row.get::<_, Option<String>>(6)?;
        let target_path = row.get::<_, Option<String>>(7)?.unwrap_or_default();
        let target_title = row.get::<_, Option<String>>(8)?.unwrap_or_default();
        Ok(NeighborLink {
            id: row.get(0)?,
            kind: row.get(1)?,
            unresolved_target: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            from: NoteRow {
                id: row.get(3)?,
                path: row.get(4)?,
                title: row.get(5)?,
            },
            target: target_id.map(|id| NoteRow {
                id,
                path: target_path,
                title: target_title,
            }),
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn load_note_tags(
    cache: &IndexCache,
    vault_id: &str,
    note_ids: &[String],
) -> Result<HashMap<String, Vec<String>>, IndexerError> {
    if note_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let placeholders = std::iter::repeat("?").take(note_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT id, tags_json FROM notes WHERE vault_id = ? AND id IN ({placeholders})"
    );
    let mut values = Vec::with_capacity(1 + note_ids.len());
    values.push(Value::Text(vault_id.to_string()));
    values.extend(note_ids.iter().cloned().map(Value::Text));

    let conn = cache.connection()?;
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params_from_iter(values.iter()), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut tags = HashMap::new();
    for row in rows {
        let (id, json) = row?;
        let parsed = serde_json::from_str::<Vec<String>>(&json).unwrap_or_default();
        if !parsed.is_empty() {
            tags.insert(id, parsed);
        }
    }
    Ok(tags)
}

pub fn apply_graph_group_color(
    tag: &str,
    groups: &[scriptor_vault::GraphGroupRule],
) -> Option<String> {
    groups
        .iter()
        .find(|group| tag.starts_with(&group.tag_prefix))
        .map(|group| group.color.clone())
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

    #[test]
    fn traversal_preserves_bfs_depth_parent_and_stable_order() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        fs::write(dir.path().join("a.md"), "# A\n\n[[b]]\n")?;
        fs::write(dir.path().join("b.md"), "# B\n\n[[c]]\n[[d]]\n")?;
        fs::write(dir.path().join("c.md"), "# C\n\n[[a]]\n")?;
        fs::write(dir.path().join("d.md"), "# D\n")?;

        let session = open_vault(dir.path())?;
        rebuild_index(&session, &[])?;
        let cache = crate::db::IndexCache::open(crate::db::default_cache_path(session.root.root()))?;

        let steps = traverse_graph(&cache, &session, "a.md", 3)?;
        let summary: Vec<_> = steps
            .iter()
            .map(|step| (step.path.as_str(), step.depth, step.parent_path.as_deref()))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("a.md", 0, None),
                ("b.md", 1, Some("a.md")),
                ("c.md", 1, Some("a.md")),
                ("d.md", 2, Some("b.md")),
            ]
        );
        assert_eq!(steps[1].via.as_deref(), Some("wikilink"));
        Ok(())
    }

    #[test]
    fn traversal_respects_depth_and_returns_empty_for_missing_focus() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        fs::write(dir.path().join("a.md"), "# A\n\n[[b]]\n")?;
        fs::write(dir.path().join("b.md"), "# B\n\n[[c]]\n")?;
        fs::write(dir.path().join("c.md"), "# C\n")?;
        let session = open_vault(dir.path())?;
        rebuild_index(&session, &[])?;
        let cache = crate::db::IndexCache::open(crate::db::default_cache_path(session.root.root()))?;

        let steps = traverse_graph(&cache, &session, "a.md", 1)?;
        assert!(steps.iter().all(|step| step.depth <= 1));
        assert!(traverse_graph(&cache, &session, "missing.md", 2)?.is_empty());
        Ok(())
    }
}
