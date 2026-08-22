use scriptor_canvas_engine::{
    CanvasDocumentSummary, CanvasPoint, CanvasRect, HitTestResult, SnapshotFormat,
    TemplateApplyOutput, TemplateApplyPreview, apply_template, apply_template_dry_run,
    document_to_json, hit_test, list_documents, list_templates, load_document, parse_document_json,
    query_blocks_in_bounds, render_svg, restore_template_checkpoint, save_document, write_snapshot,
};

use crate::state::{ActiveSession, AppState, active_session};

fn require_canvas_capability<'a>(
    state: &'a tauri::State<'a, AppState>,
) -> Result<ActiveSession<'a>, String> {
    let session = active_session(state)?;
    let plugin_state = scriptor_vault::load_plugin_state(session.root.root())
        .map_err(|error| error.to_string())?;
    if plugin_state.is_enabled("scriptor.canvas") {
        Ok(session)
    } else {
        Err("Plugin capability 'scriptor.canvas' is disabled in active vault".into())
    }
}

#[tauri::command]
pub fn canvas_hit_test(
    state: tauri::State<AppState>,
    scene_json: String,
    x: f64,
    y: f64,
) -> Result<Option<HitTestResult>, String> {
    require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    Ok(hit_test(&document, CanvasPoint { x, y }))
}

#[tauri::command]
pub fn canvas_render_svg(
    state: tauri::State<AppState>,
    scene_json: String,
) -> Result<String, String> {
    require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    Ok(render_svg(&document, None))
}

#[tauri::command]
pub fn canvas_template_dry_run(
    state: tauri::State<AppState>,
    scene_json: String,
    template_id: String,
) -> Result<TemplateApplyPreview, String> {
    require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    apply_template_dry_run(&document, &template_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn canvas_apply_template(
    state: tauri::State<AppState>,
    scene_json: String,
    template_id: String,
) -> Result<TemplateApplyOutput, String> {
    let session = require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    apply_template(session.root.root(), &document, &template_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn canvas_restore_template(
    state: tauri::State<AppState>,
    patch_id: String,
) -> Result<String, String> {
    let session = require_canvas_capability(&state)?;
    let document = restore_template_checkpoint(session.root.root(), &patch_id)
        .map_err(|error| error.to_string())?;
    document_to_json(&document).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn canvas_query_blocks(
    state: tauri::State<AppState>,
    scene_json: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<Vec<String>, String> {
    require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    let bounds = CanvasRect {
        x,
        y,
        width,
        height,
    };
    Ok(query_blocks_in_bounds(&document, bounds, None)
        .into_iter()
        .map(|block| block.id)
        .collect())
}

#[tauri::command]
pub fn canvas_list_templates(
    state: tauri::State<AppState>,
) -> Result<Vec<scriptor_canvas_engine::CanvasTemplate>, String> {
    require_canvas_capability(&state)?;
    Ok(list_templates())
}

#[tauri::command]
pub fn canvas_snapshot(
    state: tauri::State<AppState>,
    scene_json: String,
    format: String,
    output_path: String,
    dry_run: bool,
) -> Result<scriptor_canvas_engine::SnapshotOutput, String> {
    let session = require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    let snapshot_format = match format.as_str() {
        "svg" => SnapshotFormat::Svg,
        "png" => SnapshotFormat::Png,
        "pdf" => SnapshotFormat::Pdf,
        other => return Err(format!("unsupported snapshot format: {other}")),
    };
    // Only vault-relative output paths are accepted (the frontend passes
    // `.scriptor/exports/<id>.<ext>`); traversal, absolute paths, and symlink
    // escapes are rejected by the vault path resolution.
    let relative = scriptor_vault::RelativeVaultPath::parse(&output_path)
        .map_err(|error| format!("invalid output_path: {error}"))?;
    let resolved = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    if !dry_run && let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create snapshot directory: {error}"))?;
    }
    write_snapshot(&document, &resolved, snapshot_format, dry_run)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn canvas_save_document(
    state: tauri::State<AppState>,
    scene_json: String,
) -> Result<String, String> {
    let session = require_canvas_capability(&state)?;
    let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
    let path = save_document(session.root.root(), &document).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn canvas_load_document(
    state: tauri::State<AppState>,
    canvas_id: String,
) -> Result<String, String> {
    let session = require_canvas_capability(&state)?;
    let document =
        load_document(session.root.root(), &canvas_id).map_err(|error| error.to_string())?;
    document_to_json(&document).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn canvas_list_documents(
    state: tauri::State<AppState>,
) -> Result<Vec<CanvasDocumentSummary>, String> {
    let session = require_canvas_capability(&state)?;
    list_documents(session.root.root()).map_err(|error| error.to_string())
}
