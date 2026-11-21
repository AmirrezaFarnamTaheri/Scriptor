use std::sync::{Arc, Mutex};

use scriptor_ipc::{RpcError, RpcRequest};

use crate::handler::DaemonState;
use crate::locks::lock_recover;

/// Reject a vault-scoped request whose caller did not name the open vault, or
/// named a different one. With no vault open the handler reports that itself.
pub(crate) fn check_vault_binding(
    state: &Arc<Mutex<DaemonState>>,
    request: &RpcRequest,
) -> Result<(), RpcError> {
    let current = lock_recover(state)
        .session
        .as_ref()
        .map(|session| session.descriptor.id.clone());
    let Some(current) = current else {
        return Ok(());
    };
    match request.expected_vault_id.as_deref() {
        Some(expected) if expected == current => Ok(()),
        Some(_) => Err(RpcError::with_code(
            "rpc.vault_mismatch",
            "the daemon has a different vault open than this client expects; reopen the vault",
            true,
        )),
        None => Err(RpcError::with_code(
            "rpc.vault_required",
            "vault-scoped requests must name the vault they expect (expected_vault_id)",
            true,
        )),
    }
}
