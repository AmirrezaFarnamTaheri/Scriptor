use scriptor_indexer::{IndexCache, execute_dql_query, query_focused_graph, rebuild_index};
use scriptor_vault::open_vault;

#[test]
fn canvas_relations_are_separate_and_reconcile_edits_deletion_and_rebuild() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("A.md"), "# A\n[[B]]").unwrap();
    std::fs::write(dir.path().join("B.md"), "# B").unwrap();
    std::fs::write(dir.path().join("C.md"), "# C").unwrap();
    let session = open_vault(dir.path()).unwrap();
    let boards = dir.path().join(".scriptor/canvas/boards");
    std::fs::create_dir_all(&boards).unwrap();
    let board = boards.join("board.canvas.json");
    let write = |target: &str| {
        std::fs::write(&board, serde_json::json!({
            "id":"board", "vaultId":session.descriptor.id, "title":"Evidence", "mode":"edgeless",
            "layers":[], "blocks":[{"id":"connector", "kind":"connector", "layerId":"base",
            "bounds":{"x":0,"y":0,"width":10,"height":10},"zIndex":0}], "updatedAt":"now",
            "relations":[{"id":"r1", "connectorBlockId":"connector", "sourceNotePath":"A.md",
            "targetNotePath":target,"label":"supports"}]
        }).to_string()).unwrap();
    };
    write("B.md");
    rebuild_index(&session, &[]).unwrap();
    let cache =
        IndexCache::open(scriptor_indexer::default_cache_path(session.root.root())).unwrap();
    let graph = query_focused_graph(&cache, &session, Some("A.md"), 1, &[]).unwrap();
    assert!(graph.edges.iter().any(|e| e.kind == "canvas:supports"));
    assert!(graph.edges.iter().any(|e| !e.kind.starts_with("canvas:")));
    let rows = execute_dql_query(&cache, &session, "canvas:A.md").unwrap();
    assert_eq!(rows[0].path, "B.md");
    assert!(rows[0].snippet.contains("board"));
    write("C.md");
    scriptor_indexer::sync_canvas_relations(&cache, &session).unwrap();
    assert_eq!(
        execute_dql_query(&cache, &session, "canvas:A.md").unwrap()[0].path,
        "C.md"
    );
    std::fs::remove_file(dir.path().join("C.md")).unwrap();
    scriptor_indexer::incremental_note_index_with_cache(&session, &cache, "C.md", &[]).unwrap();
    assert!(
        execute_dql_query(&cache, &session, "canvas:A.md")
            .unwrap()
            .is_empty()
    );
    let graph = query_focused_graph(&cache, &session, Some("A.md"), 1, &[]).unwrap();
    assert!(
        graph
            .nodes
            .iter()
            .any(|n| n.unresolved && n.label == "C.md")
    );
    std::fs::remove_file(&board).unwrap();
    rebuild_index(&session, &[]).unwrap();
    assert!(
        execute_dql_query(&cache, &session, "canvas:A.md")
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        std::fs::read_to_string(dir.path().join("A.md")).unwrap(),
        "# A\n[[B]]"
    );
}

#[test]
fn migration_v11_to_v12_keeps_markdown_links_and_creates_canvas_provenance() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("cache.db");
    let cache = IndexCache::open(&db).unwrap();
    let conn = cache.connection().unwrap();
    conn.execute_batch("DROP VIEW knowledge_links; DROP TABLE canvas_relations; UPDATE cache_meta SET value='11' WHERE key='schema_version'; INSERT INTO links VALUES ('link','vault','a','b','B.md','wikilink','B',1);").unwrap();
    drop(conn);
    drop(cache);
    let cache = IndexCache::open(&db).unwrap();
    let conn = cache.connection().unwrap();
    assert_eq!(
        scriptor_indexer::db::read_schema_version(&conn).unwrap(),
        Some(12)
    );
    let count: i64 = conn
        .query_row(
            "SELECT count(*) FROM knowledge_links WHERE kind='wikilink'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn scan_budget_failure_rolls_back_and_malformed_board_reports_skipped() {
    let dir = tempfile::tempdir().unwrap();
    let session = open_vault(dir.path()).unwrap();
    let cache =
        IndexCache::open(scriptor_indexer::default_cache_path(session.root.root())).unwrap();
    cache
        .connection()
        .unwrap()
        .execute(
            "INSERT INTO canvas_relations VALUES (?1,'retained','r','c','A.md','B.md','supports')",
            [&session.descriptor.id],
        )
        .unwrap();
    let boards = dir.path().join(".scriptor/canvas/boards");
    std::fs::create_dir_all(&boards).unwrap();
    for index in 0..1001 {
        std::fs::write(boards.join(format!("{index}.canvas.json")), "{").unwrap();
    }
    assert!(scriptor_indexer::sync_canvas_relations(&cache, &session).is_err());
    let count: i64 = cache
        .connection()
        .unwrap()
        .query_row("SELECT count(*) FROM canvas_relations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
    for index in 1..1001 {
        std::fs::remove_file(boards.join(format!("{index}.canvas.json"))).unwrap();
    }
    let report = scriptor_indexer::sync_canvas_relations(&cache, &session).unwrap();
    assert_eq!(report.skipped, 1);
    assert_eq!(report.relations, 0);
}
