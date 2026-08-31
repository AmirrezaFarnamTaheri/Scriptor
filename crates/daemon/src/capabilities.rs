use scriptor_ipc::{RpcError, RpcMethod};
use scriptor_vault::PluginState;

/// The only daemon authority map for capability-gated RPC and catalog paths.
/// `None` means the command is not capability-gated; unknown `scriptor.*`
/// values are intentionally never inferred from a renderer-supplied alias.
pub fn capability_for_method(method: &RpcMethod) -> Option<&'static str> {
    match method {
        RpcMethod::GraphSummary { .. } => Some("scriptor.graph"),
        RpcMethod::EmbeddingsSearch { .. } | RpcMethod::EmbeddingsSync { .. } => {
            Some("scriptor.semantic")
        }
        RpcMethod::ExportRunNote { .. }
        | RpcMethod::ExportRunMarkdown { .. }
        | RpcMethod::ExportStartNote { .. }
        | RpcMethod::ExportStartMarkdown { .. }
        | RpcMethod::ExportJobStatus
        | RpcMethod::ExportCancel { .. } => Some("scriptor.export"),
        RpcMethod::Invoke { command, .. } => capability_for_command(command),
        _ => None,
    }
}

pub fn capability_for_command(command: &str) -> Option<&'static str> {
    match command {
        "indexer_graph" | "indexer_traverse_graph" => Some("scriptor.graph"),
        "export_run_note"
        | "export_run_markdown"
        | "export_start_note"
        | "export_start_markdown"
        | "export_cancel" => Some("scriptor.export"),
        // Keep this exhaustive with `command_gateway::catalog::COMMAND_IDS`.
        // Capability disablement applies to the whole Canvas surface, not only
        // to its mutating commands: otherwise an untrusted client can still
        // invoke an unreviewed Canvas entry point directly over daemon IPC.
        "canvas_hit_test"
        | "canvas_render_svg"
        | "canvas_template_dry_run"
        | "canvas_apply_template"
        | "canvas_restore_template"
        | "canvas_query_blocks"
        | "canvas_list_templates"
        | "canvas_snapshot"
        | "canvas_save_document"
        | "canvas_load_document"
        | "canvas_list_documents" => Some("scriptor.canvas"),
        _ => None,
    }
}

pub fn enforce(state: &PluginState, method: &RpcMethod) -> Result<(), RpcError> {
    let Some(capability_id) = capability_for_method(method) else {
        return Ok(());
    };
    if state.is_enabled(capability_id) {
        Ok(())
    } else {
        Err(RpcError::PluginDisabled {
            capability_id: capability_id.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_graph_and_export_fail_before_dispatch() {
        let state = PluginState {
            disabled_plugins: ["scriptor.graph".into(), "scriptor.export".into()]
                .into_iter()
                .collect(),
            ..Default::default()
        };
        assert!(
            matches!(enforce(&state, &RpcMethod::GraphSummary { path: None, depth: 1 }), Err(RpcError::PluginDisabled { capability_id }) if capability_id == "scriptor.graph")
        );
        assert!(matches!(
            enforce(&state, &RpcMethod::Invoke {
                command: "export_run_note".into(),
                payload_json: "{}".into(),
            }),
            Err(RpcError::PluginDisabled { capability_id }) if capability_id == "scriptor.export"
        ));
    }

    #[test]
    fn disabled_canvas_rejects_every_catalog_command() {
        let state = PluginState {
            disabled_plugins: ["scriptor.canvas".into()].into_iter().collect(),
            ..Default::default()
        };
        for command in crate::command_gateway::list_commands()
            .into_iter()
            .filter(|command| command.starts_with("canvas_"))
        {
            assert!(
                matches!(
                    enforce(&state, &RpcMethod::Invoke { command: command.into(), payload_json: "{}".into() }),
                    Err(RpcError::PluginDisabled { capability_id }) if capability_id == "scriptor.canvas"
                ),
                "{command} must be capability-gated"
            );
        }
    }
}
