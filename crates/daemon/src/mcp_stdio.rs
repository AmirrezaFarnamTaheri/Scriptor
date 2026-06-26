use std::io::{self, BufRead, Write};

use chrono::Utc;
use scriptor_indexer::{
    backlinks_for_path, list_dead_end_notes, list_orphan_notes, list_unresolved_link_targets,
    list_vault_tags, notes_for_tag, open_cache_for_session, parse_note_markdown, query_focused_graph,
    search_notes, traverse_graph,
};
use scriptor_vault::{
    append_mcp_mutation, build_note_markdown, load_vault_config, open_vault, read_note,
    save_note_with_options, McpMutationAuditRecord, RelativeVaultPath, SaveNoteOptions, VaultSession,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct McpStdioOptions {
    pub vault_path: String,
    pub trust_stdio: bool,
}

#[derive(Debug, Deserialize)]
struct McpRequest {
    id: Value,
    method: String,
    #[serde(default)]
    params: Option<McpRequestParams>,
}

#[derive(Debug, Deserialize)]
struct McpRequestParams {
    name: Option<String>,
    #[serde(default)]
    arguments: Option<Value>,
}

#[derive(Debug, Serialize)]
struct McpResponse {
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<McpError>,
}

#[derive(Debug, Serialize)]
struct McpError {
    code: String,
    message: String,
}

struct McpStdioState {
    session: VaultSession,
    trust_stdio: bool,
}

const READ_TOOLS: &[(&str, &str, &str)] = &[
    ("mcp.search", "Search indexed notes in the open vault.", "mcp.search"),
    ("mcp.readNote", "Read a note path from the open vault.", "note.read"),
    (
        "mcp.inspectBacklinks",
        "List inbound links for a note path.",
        "mcp.inspectBacklinks",
    ),
    (
        "mcp.inspectBrokenLinks",
        "List unresolved wikilink targets in the vault.",
        "mcp.inspectBrokenLinks",
    ),
    (
        "mcp.inspectExportProfiles",
        "Return export-related vault config (profiles are desktop-managed).",
        "mcp.inspectExportProfiles",
    ),
    (
        "mcp.inspectOutline",
        "Return heading outline for a note path.",
        "mcp.inspectOutline",
    ),
    ("mcp.listTags", "List indexed tags with usage counts.", "mcp.listTags"),
    (
        "mcp.searchByTag",
        "List notes tagged with a hashtag.",
        "mcp.searchByTag",
    ),
    (
        "mcp.inspectGraphSummary",
        "Summarize orphans, dead ends, unresolved links, and top tags.",
        "mcp.inspectGraphSummary",
    ),
    (
        "mcp.traverseGraph",
        "Breadth-first graph traversal from a focus note.",
        "mcp.traverseGraph",
    ),
    (
        "mcp.exportGraph",
        "Export a focused link graph (nodes and edges).",
        "mcp.exportGraph",
    ),
    (
        "mcp.renderMarkdown",
        "Render markdown to basic HTML (headless preview).",
        "mcp.renderMarkdown",
    ),
];

const WRITE_TOOLS: &[(&str, &str, &str)] = &[
    (
        "mcp.proposePatch",
        "Propose a Markdown patch (writes when --trust-stdio is set).",
        "mcp.proposePatch",
    ),
    (
        "mcp.createNote",
        "Create a new note (writes when --trust-stdio is set).",
        "note.create",
    ),
];

pub fn run_mcp_stdio(options: McpStdioOptions) -> Result<(), String> {
    let session = open_vault(&options.vault_path).map_err(|error| error.to_string())?;
    let mut state = McpStdioState {
        session,
        trust_stdio: options.trust_stdio,
    };
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    for line in stdin.lock().lines() {
        let line = line.map_err(|error| error.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<McpRequest>(trimmed) {
            Ok(request) => handle_request(&mut state, request),
            Err(error) => McpResponse {
                id: json!("invalid"),
                result: None,
                error: Some(McpError {
                    code: "parse_error".into(),
                    message: error.to_string(),
                }),
            },
        };
        let encoded = serde_json::to_string(&response).map_err(|error| error.to_string())?;
        writeln!(stdout, "{encoded}").map_err(|error| error.to_string())?;
        stdout.flush().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn handle_request(state: &mut McpStdioState, request: McpRequest) -> McpResponse {
    match request.method.as_str() {
        "tools/list" => McpResponse {
            id: request.id,
            result: Some(json!({ "tools": list_tools(state.trust_stdio) })),
            error: None,
        },
        "tools/call" => {
            let name = request
                .params
                .as_ref()
                .and_then(|params| params.name.clone())
                .unwrap_or_default();
            if name.is_empty() {
                return error_response(request.id, "invalid_params", "Tool name is required");
            }
            match invoke_tool(state, &name, request.params.and_then(|params| params.arguments)) {
                Ok(output) => McpResponse {
                    id: request.id,
                    result: Some(json!({ "output": output })),
                    error: None,
                },
                Err(message) => error_response(request.id, "invoke_failed", &message),
            }
        }
        other => error_response(request.id, "method_not_found", &format!("Unsupported method: {other}")),
    }
}

fn error_response(id: Value, code: &str, message: &str) -> McpResponse {
    McpResponse {
        id,
        result: None,
        error: Some(McpError {
            code: code.into(),
            message: message.into(),
        }),
    }
}

fn list_tools(trust_stdio: bool) -> Vec<Value> {
    let mut tools: Vec<Value> = READ_TOOLS
        .iter()
        .map(|(name, description, command_id)| {
            json!({
                "name": name,
                "description": description,
                "modeRequired": "read-only",
                "commandId": command_id,
            })
        })
        .collect();
    if trust_stdio {
        tools.extend(WRITE_TOOLS.iter().map(|(name, description, command_id)| {
            json!({
                "name": name,
                "description": description,
                "modeRequired": "write-approved",
                "commandId": command_id,
            })
        }));
    }
    tools
}

fn invoke_tool(state: &mut McpStdioState, tool_name: &str, arguments: Option<Value>) -> Result<Value, String> {
    let args = arguments.unwrap_or(json!({}));
    match tool_name {
        "mcp.search" => {
            let query = args
                .get("query")
                .and_then(Value::as_str)
                .ok_or_else(|| "query is required".to_string())?;
            let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(25) as u32;
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let hits = search_notes(&cache, &state.session.descriptor.id, query, limit)
                .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(hits).map_err(|error| error.to_string())?)
        }
        "mcp.readNote" => {
            let path = args
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "path is required".to_string())?;
            let relative = RelativeVaultPath::parse(path).map_err(|error| error.to_string())?;
            let note = read_note(
                &state.session.descriptor.id,
                &state.session.root,
                &relative,
            )
            .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(note).map_err(|error| error.to_string())?)
        }
        "mcp.inspectBacklinks" => {
            let path = args
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "path is required".to_string())?;
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let hits = backlinks_for_path(&cache, &state.session, path)
                .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(hits).map_err(|error| error.to_string())?)
        }
        "mcp.inspectBrokenLinks" => {
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let targets = list_unresolved_link_targets(&cache, &state.session)
                .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(targets).map_err(|error| error.to_string())?)
        }
        "mcp.inspectExportProfiles" => {
            let config = load_vault_config(state.session.root.root()).map_err(|error| error.to_string())?;
            Ok(json!({
                "profiles": [],
                "export_on_save": config.export.export_on_save,
                "bibliography_path": config.export.bibliography_path,
                "csl_style_path": config.export.csl_style_path,
            }))
        }
        "mcp.inspectOutline" => {
            let path = args
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "path is required".to_string())?;
            let relative = RelativeVaultPath::parse(path).map_err(|error| error.to_string())?;
            let note = read_note(
                &state.session.descriptor.id,
                &state.session.root,
                &relative,
            )
            .map_err(|error| error.to_string())?;
            let parsed = parse_note_markdown(path, &note.markdown);
            Ok(json!({
                "path": path,
                "title": parsed.title,
                "outline": parsed.headings,
            }))
        }
        "mcp.listTags" => {
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let mut tags = list_vault_tags(&cache, &state.session.descriptor.id)
                .map_err(|error| error.to_string())?;
            if let Some(prefix) = args.get("prefix").and_then(Value::as_str) {
                let prefix = prefix.trim_start_matches('#').to_lowercase();
                tags.retain(|entry| entry.tag.to_lowercase().starts_with(&prefix));
            }
            if let Some(limit) = args.get("limit").and_then(Value::as_u64) {
                let limit = limit as usize;
                if limit > 0 {
                    tags.truncate(limit);
                }
            }
            Ok(serde_json::to_value(tags).map_err(|error| error.to_string())?)
        }
        "mcp.searchByTag" => {
            let tag = args
                .get("tag")
                .and_then(Value::as_str)
                .ok_or_else(|| "tag is required".to_string())?
                .trim_start_matches('#');
            let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(50) as usize;
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let mut notes = notes_for_tag(&cache, &state.session.descriptor.id, tag)
                .map_err(|error| error.to_string())?;
            if limit > 0 {
                notes.truncate(limit);
            }
            Ok(serde_json::to_value(notes).map_err(|error| error.to_string())?)
        }
        "mcp.inspectGraphSummary" => {
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let orphans = list_orphan_notes(&cache, &state.session).map_err(|error| error.to_string())?;
            let dead_ends =
                list_dead_end_notes(&cache, &state.session).map_err(|error| error.to_string())?;
            let unresolved = list_unresolved_link_targets(&cache, &state.session)
                .map_err(|error| error.to_string())?;
            let tags = list_vault_tags(&cache, &state.session.descriptor.id)
                .map_err(|error| error.to_string())?;
            Ok(json!({
                "orphan_count": orphans.len(),
                "dead_end_count": dead_ends.len(),
                "unresolved_target_count": unresolved.len(),
                "tag_count": tags.len(),
                "top_tags": tags.iter().take(10).collect::<Vec<_>>(),
                "orphans": orphans.iter().take(25).collect::<Vec<_>>(),
                "dead_ends": dead_ends.iter().take(25).collect::<Vec<_>>(),
                "unresolved_targets": unresolved.iter().take(25).collect::<Vec<_>>(),
            }))
        }
        "mcp.traverseGraph" => {
            let focus_path = args
                .get("focusPath")
                .and_then(Value::as_str)
                .ok_or_else(|| "focusPath is required".to_string())?;
            let depth = args.get("depth").and_then(Value::as_u64).unwrap_or(2) as u32;
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let graph = traverse_graph(&cache, &state.session, focus_path, depth)
                .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(graph).map_err(|error| error.to_string())?)
        }
        "mcp.exportGraph" => {
            let focus_path = args.get("focusPath").and_then(Value::as_str);
            let depth = args.get("depth").and_then(Value::as_u64).unwrap_or(2) as u32;
            let cache = open_cache_for_session(&state.session).map_err(|error| error.to_string())?;
            let graph = query_focused_graph(&cache, &state.session, focus_path, depth, &[])
                .map_err(|error| error.to_string())?;
            Ok(serde_json::to_value(graph).map_err(|error| error.to_string())?)
        }
        "mcp.renderMarkdown" => {
            let markdown = args
                .get("markdown")
                .and_then(Value::as_str)
                .ok_or_else(|| "markdown is required".to_string())?;
            Ok(json!({ "html": render_markdown_html(markdown) }))
        }
        "mcp.proposePatch" => {
            if !state.trust_stdio {
                return Err("mcp.proposePatch requires --trust-stdio".into());
            }
            let path = args
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "path is required".to_string())?;
            let markdown = args
                .get("proposedMarkdown")
                .and_then(Value::as_str)
                .ok_or_else(|| "proposedMarkdown is required".to_string())?;
            let expected_hash = args
                .get("baseContentHash")
                .and_then(Value::as_str)
                .map(str::to_string);
            write_note_with_audit(
                state,
                "mcp.proposePatch",
                "mcp.proposePatch",
                path,
                markdown,
                expected_hash,
            )
        }
        "mcp.createNote" => {
            if !state.trust_stdio {
                return Err("mcp.createNote requires --trust-stdio".into());
            }
            let path = args
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "path is required".to_string())?;
            let title = args
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Untitled");
            let note_type = args.get("noteType").and_then(Value::as_str);
            let template_body = args.get("templateBody").and_then(Value::as_str);
            let markdown = args
                .get("markdown")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| build_note_markdown(title, note_type, template_body));
            write_note_with_audit(state, "mcp.createNote", "note.create", path, &markdown, None)
        }
        other => Err(format!("Unknown tool: {other}")),
    }
}

fn write_note_with_audit(
    state: &McpStdioState,
    tool_name: &str,
    command_id: &str,
    path: &str,
    markdown: &str,
    expected_content_hash: Option<String>,
) -> Result<Value, String> {
    let audit_id = Uuid::new_v4().to_string();
    append_mcp_mutation(
        &state.session.root,
        McpMutationAuditRecord {
            id: audit_id.clone(),
            tool_name: tool_name.into(),
            mode: "write-approved".into(),
            command_id: command_id.into(),
            requested_at: Utc::now().to_rfc3339(),
            approved_at: Some(Utc::now().to_rfc3339()),
            outcome: "allowed".into(),
            note_path: Some(path.into()),
            detail: None,
        },
    )
    .map_err(|error| error.to_string())?;

    let relative = RelativeVaultPath::parse(path).map_err(|error| error.to_string())?;
    let output = save_note_with_options(
        &state.session.descriptor.id,
        &state.session.root,
        &relative,
        markdown,
        expected_content_hash.as_deref(),
        SaveNoteOptions { dry_run: false },
    )
    .map_err(|error| error.to_string())?;
    Ok(serde_json::to_value(output).map_err(|error| error.to_string())?)
}

fn render_markdown_html(markdown: &str) -> String {
    use pulldown_cmark::{html, Options, Parser};

    let mut html_output = String::new();
    let parser = Parser::new_ext(markdown, Options::all());
    html::push_html(&mut html_output, parser);
    html_output
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn read_tools_include_graph_and_tag_inspectors() {
        let tools = list_tools(false);
        let names: Vec<_> = tools
            .iter()
            .filter_map(|tool| tool.get("name").and_then(Value::as_str))
            .collect();
        assert!(names.contains(&"mcp.inspectBacklinks"));
        assert!(names.contains(&"mcp.inspectGraphSummary"));
        assert!(names.contains(&"mcp.exportGraph"));
        assert!(names.contains(&"mcp.renderMarkdown"));
        assert!(names.len() >= 12);
    }

    #[test]
    fn mcp_write_appends_audit_before_disk_mutation() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write note");

        let session = open_vault(&dir.path().display().to_string()).expect("open vault");
        let state = McpStdioState {
            session,
            trust_stdio: true,
        };

        write_note_with_audit(
            &state,
            "mcp.proposePatch",
            "mcp.proposePatch",
            "alpha.md",
            "# Alpha\n\nPatched body\n",
            None,
        )
        .expect("write note");

        let audit_path = dir.path().join(".scriptor/audit/mcp-mutations.jsonl");
        assert!(audit_path.is_file(), "audit jsonl should exist");
        let audit = fs::read_to_string(&audit_path).expect("read audit");
        assert!(audit.contains("mcp.proposePatch"));
        assert!(audit.contains("alpha.md"));

        let note = fs::read_to_string(dir.path().join("alpha.md")).expect("read note");
        assert!(note.contains("Patched body"));
    }
}
