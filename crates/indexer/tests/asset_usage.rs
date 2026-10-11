use scriptor_indexer::{
    IndexerError, asset_usage::list_asset_usage, open_cache_for_session, rebuild_index,
};
#[test]
fn asset_usage_deduplicates_references_and_tracks_rebuild_deletion() -> Result<(), IndexerError> {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(fixture.path().join("notes")).unwrap();
    std::fs::create_dir_all(fixture.path().join("assets")).unwrap();
    std::fs::write(fixture.path().join("assets/image.png"), b"image").unwrap();
    std::fs::write(fixture.path().join("assets/unused.pdf"), b"pdf").unwrap();
    std::fs::write(
        fixture.path().join("notes/a.md"),
        "# A\n![A](../assets/image.png)\n![B](/assets/image.png)\n",
    )
    .unwrap();
    let session = scriptor_vault::open_vault(fixture.path())?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let result = list_asset_usage(&cache, &session)?;
    assert!(!result.truncated);
    assert_eq!(
        result
            .assets
            .iter()
            .find(|asset| asset.path == "assets/image.png")
            .unwrap()
            .used_by,
        ["notes/a.md"]
    );
    assert!(
        result
            .assets
            .iter()
            .find(|asset| asset.path == "assets/unused.pdf")
            .unwrap()
            .used_by
            .is_empty()
    );
    std::fs::remove_file(fixture.path().join("notes/a.md")).unwrap();
    rebuild_index(&session, &[])?;
    assert!(
        list_asset_usage(&cache, &session)?
            .assets
            .iter()
            .all(|asset| asset.used_by.is_empty())
    );
    Ok(())
}
