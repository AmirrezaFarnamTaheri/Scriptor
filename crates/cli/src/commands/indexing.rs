//! Index, search, and graph command handlers (daemon-routed with in-process fallback).

use std::path::PathBuf;

use scriptor_daemon::rpc_call;
use scriptor_indexer::{
    backlinks_for_path, health_diagnostics_json, health_report_json, open_cache_for_session,
    query_focused_graph, rebuild_index, search_notes, traverse_graph,
};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use scriptor_vault::open_vault;

use crate::commands::print_rpc_response;
use crate::daemon_client;

type CommandResult = Result<(), Box<dyn std::error::Error>>;

pub(crate) fn run_rebuild_index(path: PathBuf, in_process: bool) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let summary = rebuild_index(&session, &[])?;
        println!("{}", serde_json::to_string_pretty(&summary)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(3, RpcMethod::RebuildIndex))?;
        print_rpc_response(&response)?;
    }
    Ok(())
}

pub(crate) fn run_health(path: PathBuf, in_process: bool) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let _ = rebuild_index(&session, &[])?;
        let cache = open_cache_for_session(&session)?;
        println!("{}", health_report_json(&cache, &session)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(4, RpcMethod::HealthReport))?;
        match response.result {
            RpcResult::Ok(RpcPayload::HealthReport { json }) => println!("{json}"),
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon health response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_health_diagnostics(path: PathBuf, in_process: bool) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let _ = rebuild_index(&session, &[])?;
        let cache = open_cache_for_session(&session)?;
        println!("{}", health_diagnostics_json(&cache, &session)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(5, RpcMethod::HealthDiagnostics))?;
        match response.result {
            RpcResult::Ok(RpcPayload::HealthDiagnostics { json }) => println!("{json}"),
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon health diagnostics response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_search(
    path: PathBuf,
    query: String,
    limit: u32,
    in_process: bool,
) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let _ = rebuild_index(&session, &[])?;
        let cache = open_cache_for_session(&session)?;
        let hits = search_notes(&cache, &session.descriptor.id, &query, limit)?;
        println!("{}", serde_json::to_string_pretty(&hits)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(
            6,
            RpcMethod::SearchNotes {
                query: query.clone(),
                limit,
            },
        ))?;
        match response.result {
            RpcResult::Ok(RpcPayload::SearchHits { hits }) => {
                println!("{}", serde_json::to_string_pretty(&hits)?);
            }
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon search response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_backlinks(path: PathBuf, note: String, in_process: bool) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let _ = rebuild_index(&session, &[])?;
        let cache = open_cache_for_session(&session)?;
        let hits = backlinks_for_path(&cache, &session, &note)?;
        println!("{}", serde_json::to_string_pretty(&hits)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(
            7,
            RpcMethod::Backlinks { path: note.clone() },
        ))?;
        match response.result {
            RpcResult::Ok(RpcPayload::Backlinks { json, .. }) => println!("{json}"),
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon backlinks response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_graph(
    path: PathBuf,
    note: Option<String>,
    depth: u32,
    in_process: bool,
) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let session = open_vault(&path)?;
        let _ = rebuild_index(&session, &[])?;
        let cache = open_cache_for_session(&session)?;
        let graph = query_focused_graph(&cache, &session, note.as_deref(), depth, &[])?;
        println!("{}", serde_json::to_string_pretty(&graph)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(
            8,
            RpcMethod::GraphSummary {
                path: note.clone(),
                depth,
            },
        ))?;
        match response.result {
            RpcResult::Ok(RpcPayload::GraphSummary { json }) => println!("{json}"),
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon graph response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_traverse_graph(
    path: PathBuf,
    note: String,
    depth: u32,
    in_process: bool,
) -> CommandResult {
    if !in_process {
        return Err(
            "traverse-graph has no daemon RPC yet; pass --in-process for this command".into(),
        );
    }
    daemon_client::warn_in_process_deprecated();
    let session = open_vault(&path)?;
    let _ = rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let steps = traverse_graph(&cache, &session, &note, depth)?;
    println!("{}", serde_json::to_string_pretty(&steps)?);
    Ok(())
}
