//! Git command handlers (status, commit, pull, push, conflict resolution).

use std::path::PathBuf;

use scriptor_daemon::rpc_call;
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use scriptor_native_git::{
    PullStrategy, git_commit_selected, git_pull, git_push, git_resolve_conflict, git_status,
};

use crate::daemon_client;

type CommandResult = Result<(), Box<dyn std::error::Error>>;

pub(crate) fn run_status(path: PathBuf, in_process: bool) -> CommandResult {
    if in_process {
        daemon_client::warn_in_process_deprecated();
        let status = git_status(&path)?;
        println!("{}", serde_json::to_string_pretty(&status)?);
    } else {
        daemon_client::ensure_vault_open(&path)?;
        let response = rpc_call(RpcRequest::new(9, RpcMethod::GitStatus))?;
        match response.result {
            RpcResult::Ok(RpcPayload::GitStatus { json }) => println!("{json}"),
            RpcResult::Error(error) => return Err(error.to_string().into()),
            _ => return Err("unexpected daemon git status response".into()),
        }
    }
    Ok(())
}

pub(crate) fn run_commit(path: PathBuf, message: String, file: Vec<String>) -> CommandResult {
    let output = git_commit_selected(&path, &file, &message)?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub(crate) fn run_pull(path: PathBuf) -> CommandResult {
    let output = git_pull(&path, default_pull_strategy())?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub(crate) fn run_push(path: PathBuf) -> CommandResult {
    let output = git_push(&path)?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub(crate) fn run_resolve_conflict(path: PathBuf, file: String, strategy: String) -> CommandResult {
    let resolved = git_resolve_conflict(&path, &file, &strategy)?;
    println!("{}", serde_json::to_string_pretty(&resolved)?);
    Ok(())
}

fn default_pull_strategy() -> PullStrategy {
    PullStrategy::FastForward
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cli_pull_defaults_to_fast_forward() {
        assert_eq!(default_pull_strategy(), PullStrategy::FastForward);
    }
}
