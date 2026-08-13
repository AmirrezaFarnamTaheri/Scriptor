use scriptor_ipc::{RpcError, RpcMethod};
use scriptor_vault::PluginState;

/// The only daemon authority map for capability-gated RPC and catalog paths.
/// `None` means the command is not capability-gated; unknown `scriptor.*`
/// values are intentionally never inferred from a renderer-supplied alias.
pub fn capability_for_method(method: &RpcMethod) -> Option<&'static str> {
    match method {
        RpcMethod::GraphSummary { .. } => Some("scriptor.graph"),
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
        "canvas_create" | "canvas_update" | "canvas_snapshot" => Some("scriptor.canvas"),
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
}
