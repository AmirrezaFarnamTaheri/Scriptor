//! Real-process probe for MAT-008 acceptance. This example is not a product command.
//! The runner owns two separately authenticated processes and interleaves RPCs
//! before and after restarting the actual daemon executable.

use std::io::{self, BufRead, Write};
use std::time::Duration;

use scriptor_daemon::DaemonRpcClient;
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use serde_json::{Value, json};

fn required_string(input: &Value, key: &str) -> Result<String, String> {
    input
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| format!("missing nonempty {key}"))
}

fn main() -> io::Result<()> {
    let client = DaemonRpcClient::new();
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout = stdout.lock();
    let mut next_id = 0u64;

    for line in stdin.lock().lines() {
        let input: Value = match serde_json::from_str(&line?) {
            Ok(value) => value,
            Err(error) => {
                writeln!(
                    stdout,
                    "{}",
                    json!({"kind": "probe_error", "message": error.to_string()})
                )?;
                stdout.flush()?;
                continue;
            }
        };
        let action = input.get("action").and_then(Value::as_str).unwrap_or("");
        if action == "exit" {
            writeln!(stdout, "{}", json!({"kind": "bye"}))?;
            stdout.flush()?;
            break;
        }
        let result = if action == "reset" {
            client.reset();
            json!({"kind": "reset"})
        } else {
            let method: Result<RpcMethod, String> = match action {
                "ping" => Ok(RpcMethod::Ping),
                "open" => required_string(&input, "path").map(|path| RpcMethod::OpenVault { path }),
                "status" => required_string(&input, "expected_vault_id")
                    .map(|expected_vault_id| RpcMethod::GitStatus { expected_vault_id }),
                _ => Err(format!("unsupported probe action: {action}")),
            };
            match method {
                Err(message) => json!({"kind": "probe_error", "message": message}),
                Ok(method) => {
                    next_id = next_id.saturating_add(1);
                    match client.call_with_timeout(
                        RpcRequest::new(next_id, method),
                        Duration::from_secs(12),
                    ) {
                        Ok(reply) => match reply.result {
                            RpcResult::Ok(RpcPayload::Pong { .. }) => json!({"kind": "pong"}),
                            RpcResult::Ok(RpcPayload::VaultOpened { vault_id, .. }) => {
                                json!({"kind": "opened", "vault_id": vault_id})
                            }
                            RpcResult::Ok(RpcPayload::GitStatus { .. }) => {
                                json!({"kind": "status_ok"})
                            }
                            RpcResult::Error(error) => {
                                json!({"kind": "rpc_error", "message": error.to_string()})
                            }
                            _ => json!({"kind": "unexpected_payload"}),
                        },
                        Err(error) => {
                            json!({"kind": "transport_error", "message": error.to_string()})
                        }
                    }
                }
            }
        };
        writeln!(stdout, "{result}")?;
        stdout.flush()?;
    }
    client.reset();
    Ok(())
}
