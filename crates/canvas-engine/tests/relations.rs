use scriptor_canvas_engine::{
    CanvasDocument, CanvasRelation, load_document, parse_document_json, save_document,
    validate_relations,
};

fn document() -> CanvasDocument {
    parse_document_json(r#"{"id":"board","vaultId":"vault","title":"Relations","mode":"edgeless","updatedAt":"now","layers":[],"blocks":[{"id":"c","kind":"connector","layerId":"base","bounds":{"x":0,"y":0,"width":1,"height":1},"zIndex":0}],"relations":[{"id":"r","connectorBlockId":"c","sourceNotePath":"A.md","targetNotePath":"B.md","label":"supports"}]}"#).unwrap()
}

#[test]
fn relation_roundtrip_and_invalid_endpoint_do_not_overwrite_saved_board() {
    let dir = tempfile::tempdir().unwrap();
    let mut board = document();
    save_document(dir.path(), &board).unwrap();
    assert_eq!(load_document(dir.path(), "board").unwrap(), board);
    board.relations[0].target_note_path = "../outside.md".into();
    assert!(save_document(dir.path(), &board).is_err());
    assert_eq!(
        load_document(dir.path(), "board").unwrap().relations[0].target_note_path,
        "B.md"
    );
}

#[test]
fn dangling_connectors_duplicate_ids_and_excess_relations_are_rejected() {
    let mut board = document();
    board.blocks.clear();
    assert!(validate_relations(&board).is_err());
    board = document();
    board.relations.push(board.relations[0].clone());
    assert!(validate_relations(&board).is_err());
    board = document();
    board.relations = (0..5001)
        .map(|index| CanvasRelation {
            id: format!("r{index}"),
            ..board.relations[0].clone()
        })
        .collect();
    assert!(validate_relations(&board).is_err());
}
