//! Bounded, authoritative ingestion of explicit Canvas endpoints. Never writes Markdown.
use crate::{IndexCache, IndexerError};
use rusqlite::{Connection, params};
use scriptor_vault::{RelativeVaultPath, VaultSession};
use serde::Deserialize;
use std::{fs, io::Read};

const MAX_BOARDS: usize = 1_000;
const MAX_BOARD_BYTES: u64 = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES: usize = 32 * 1024 * 1024;
const MAX_RELATIONS: usize = 20_000;

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct CanvasRelationSyncReport {
    pub boards: usize,
    pub relations: usize,
    pub skipped: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Board {
    id: String,
    vault_id: String,
    blocks: Vec<Block>,
    #[serde(default)]
    relations: Vec<Relation>,
}
#[derive(Deserialize)]
struct Block {
    id: String,
    kind: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Relation {
    id: String,
    connector_block_id: String,
    source_note_path: String,
    target_note_path: String,
    label: String,
}

pub fn sync_canvas_relations(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<CanvasRelationSyncReport, IndexerError> {
    let mut conn = cache.connection()?;
    let tx = conn.transaction()?;
    let report = sync_canvas_relations_on(&tx, session)?;
    tx.commit()?;
    Ok(report)
}

pub(crate) fn sync_canvas_relations_on(
    conn: &Connection,
    session: &VaultSession,
) -> Result<CanvasRelationSyncReport, IndexerError> {
    let dir = session.root.root().join(".scriptor/canvas/boards");
    let mut report = CanvasRelationSyncReport::default();
    let mut accepted = Vec::new();
    let mut total = 0;
    let mut relation_total = 0;
    let io_error = |source| IndexerError::Io {
        path: dir.clone(),
        source,
    };
    if dir.exists() {
        let canonical = fs::canonicalize(&dir).map_err(io_error)?;
        if !canonical.starts_with(session.root.root()) {
            return Err(IndexerError::InvalidQuery(
                "Canvas directory escapes vault".into(),
            ));
        }
        let entries = fs::read_dir(&dir).map_err(io_error)?;
        let mut count = 0;
        let mut board_ids = std::collections::HashSet::new();
        for entry in entries {
            let entry = entry.map_err(io_error)?;
            if !entry
                .file_name()
                .to_string_lossy()
                .ends_with(".canvas.json")
            {
                continue;
            }
            count += 1;
            if count > MAX_BOARDS {
                return Err(IndexerError::InvalidQuery(
                    "Canvas scan exceeds 1000 boards; previous cache retained".into(),
                ));
            }
            let metadata = fs::symlink_metadata(entry.path()).map_err(io_error)?;
            if !metadata.file_type().is_file() || metadata.len() > MAX_BOARD_BYTES {
                report.skipped += 1;
                continue;
            }
            let mut raw = Vec::new();
            fs::File::open(entry.path())
                .map_err(io_error)?
                .take(MAX_BOARD_BYTES + 1)
                .read_to_end(&mut raw)
                .map_err(io_error)?;
            total += raw.len();
            if total > MAX_TOTAL_BYTES {
                return Err(IndexerError::InvalidQuery(
                    "Canvas scan exceeds 32 MiB; previous cache retained".into(),
                ));
            }
            if raw.len() as u64 > MAX_BOARD_BYTES {
                report.skipped += 1;
                continue;
            }
            let Ok(board) = serde_json::from_slice::<Board>(&raw) else {
                report.skipped += 1;
                continue;
            };
            if board.vault_id != session.descriptor.id
                || board.id.is_empty()
                || board.id.len() > 128
                || board.relations.len() > 5_000
            {
                report.skipped += 1;
                continue;
            }
            if !board_ids.insert(board.id.clone()) {
                return Err(IndexerError::InvalidQuery(
                    "Duplicate Canvas board identity; previous cache retained".into(),
                ));
            }
            let mut ids = std::collections::HashSet::new();
            let connectors = board
                .blocks
                .iter()
                .filter(|b| b.kind == "connector")
                .map(|b| b.id.as_str())
                .collect::<std::collections::HashSet<_>>();
            let valid = board.relations.iter().all(|r| {
                !r.id.is_empty()
                    && r.id.len() <= 128
                    && ids.insert(&r.id)
                    && !r.label.trim().is_empty()
                    && r.label.len() <= 128
                    && connectors.contains(r.connector_block_id.as_str())
                    && [&r.source_note_path, &r.target_note_path].iter().all(|p| {
                        p.ends_with(".md")
                            && RelativeVaultPath::parse(p)
                                .is_ok_and(|parsed| parsed.as_str() == p.as_str())
                    })
            });
            if !valid {
                report.skipped += 1;
                continue;
            }
            relation_total += board.relations.len();
            if relation_total > MAX_RELATIONS {
                return Err(IndexerError::InvalidQuery(
                    "Canvas scan exceeds 20000 relations; previous cache retained".into(),
                ));
            }
            accepted.push(board);
        }
    }
    conn.execute(
        "DELETE FROM canvas_relations WHERE vault_id=?1",
        [&session.descriptor.id],
    )?;
    let mut insert = conn.prepare_cached("INSERT INTO canvas_relations(vault_id,board_id,relation_id,connector_block_id,source_path,target_path,label) VALUES (?1,?2,?3,?4,?5,?6,?7)")?;
    for board in accepted {
        report.boards += 1;
        for r in board.relations {
            insert.execute(params![
                session.descriptor.id,
                board.id,
                r.id,
                r.connector_block_id,
                r.source_note_path,
                r.target_note_path,
                r.label
            ])?;
            report.relations += 1;
        }
    }
    Ok(report)
}
