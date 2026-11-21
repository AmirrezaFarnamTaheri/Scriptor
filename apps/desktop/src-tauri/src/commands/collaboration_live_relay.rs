//! Authenticated, opt-in WSS relay transport. The only signer is native and
//! its Ed25519 PKCS#8 secret stays in the OS keychain. This transport never
//! deletes the local journal on ACK: reconnect replays by message identity.
use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::Ordering;
use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::STANDARD};
use futures_util::{SinkExt, TryStreamExt};
use reqwest::Url;
use reqwest_websocket::{Message, Upgrade, WebSocket};
use serde::Serialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::collaboration_live::{LiveSessionLease, lease_for};
use super::collaboration_live_identity::sign_relay_challenge;
use super::collaboration_live_journal::JournalScope;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session, lock_recover};

const WIRE_EVENT: &str = "scriptor:collaboration:relay";
const SUBPROTOCOL: &str = "scriptor-live-v1";
const MAX_RELAY_FRAME_BYTES: usize = 512 * 1024;
const MAX_UPDATE_BYTES: usize = 256 * 1024;
const MAX_IN_FLIGHT: usize = 16;
const RELAY_PAGE_LIMIT: usize = 64;
const MAX_VERIFIED_INBOX_ITEMS: usize = 64;
const MAX_VERIFIED_INBOX_BYTES: usize = 4 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayConnectReceipt {
    session_id: String,
    role: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RelayEvent {
    session_id: String,
    room_id: String,
    document_id: String,
    epoch: u64,
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    peer_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    client_seq: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    /// This opaque receipt is the only content placed on the untrusted Tauri
    /// event bus; the canonical update remains inside the native inbox.
    #[serde(skip_serializing_if = "Option::is_none")]
    ticket: Option<String>,
}

/// In-process-only, bounded inbox of updates validated on the authenticated
/// WSS socket. Renderer event payloads cannot insert records. A take is
/// one-time, tied to the current connection generation.
#[derive(Default)]
pub(crate) struct VerifiedRemoteInbox {
    entries: HashMap<String, (u64, RelayEvent)>,
    bytes: usize,
}

impl VerifiedRemoteInbox {
    fn record(
        &mut self,
        ticket: String,
        generation: u64,
        update: RelayEvent,
    ) -> Result<(), String> {
        if update.kind != "remote_update" || update.payload.is_none() {
            return Err("Only authenticated remote updates may enter the native inbox".into());
        }
        let size = update.payload.as_deref().map(str::len).unwrap_or(0);
        if self.entries.len() >= MAX_VERIFIED_INBOX_ITEMS
            || self.bytes.saturating_add(size) > MAX_VERIFIED_INBOX_BYTES
            || self.entries.contains_key(&ticket)
        {
            return Err(
                "Authenticated remote inbox is full or duplicate; replay after reconnect".into(),
            );
        }
        self.entries.insert(ticket, (generation, update));
        self.bytes += size;
        Ok(())
    }

    fn take(&mut self, ticket: &str, generation: u64) -> Result<RelayEvent, String> {
        if self
            .entries
            .get(ticket)
            .map(|(stored_generation, _)| *stored_generation)
            != Some(generation)
        {
            return Err("Unknown or stale authenticated remote update receipt".into());
        }
        let (_, update) = self
            .entries
            .remove(ticket)
            .ok_or("Authenticated remote update already consumed")?;
        self.bytes = self
            .bytes
            .saturating_sub(update.payload.as_deref().map(str::len).unwrap_or(0));
        Ok(update)
    }

    pub(crate) fn clear(&mut self) {
        self.entries.clear();
        self.bytes = 0;
    }
}

fn event(session_id: &str, scope: &JournalScope, kind: &str) -> RelayEvent {
    RelayEvent {
        session_id: session_id.into(),
        room_id: scope.room_id.clone(),
        document_id: scope.document_id.clone(),
        epoch: scope.epoch,
        kind: kind.into(),
        peer_id: None,
        message_id: None,
        client_seq: None,
        cursor: None,
        payload: None,
        role: None,
        ticket: None,
    }
}

fn validate_endpoint(input: &str) -> Result<Url, String> {
    if input.len() > 2048 {
        return Err("Relay URL is too long".into());
    }
    let parsed = Url::parse(input).map_err(|_| "Invalid relay URL")?;
    if parsed.scheme() != "wss"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.fragment().is_some()
        || parsed.query().is_some()
        || parsed.path() != "/v1/live"
    {
        return Err(
            "Collaboration relay must use an explicit wss:// host and /v1/live endpoint".into(),
        );
    }
    Ok(parsed)
}

fn consent_scope(scope: &JournalScope, endpoint: &str) -> String {
    format!(
        "live-remote:{}:{}:{}:{}:{}",
        scope.room_id, scope.document_id, scope.epoch, scope.note_path, endpoint
    )
}

fn role_from_ready(value: &Value, scope: &JournalScope) -> Result<String, String> {
    if value.get("type").and_then(Value::as_str) != Some("ready") {
        return Err("Relay did not confirm authenticated membership".into());
    }
    let received = value
        .get("scope")
        .ok_or("Relay omitted authenticated scope")?;
    if received.get("roomId").and_then(Value::as_str) != Some(&scope.room_id)
        || received.get("documentId").and_then(Value::as_str) != Some(&scope.document_id)
        || received.get("peerId").and_then(Value::as_str) != Some(&scope.peer_id)
        || received.get("epoch").and_then(Value::as_u64) != Some(scope.epoch)
    {
        return Err("Relay authenticated a different collaboration identity".into());
    }
    let role = value
        .get("role")
        .and_then(Value::as_str)
        .ok_or("Relay omitted authenticated role")?;
    if !matches!(role, "owner" | "editor" | "viewer") {
        return Err("Relay returned an unrecognized role".into());
    }
    Ok(role.into())
}

fn take_authenticated_update(
    value: &Value,
    scope: &JournalScope,
    session_id: &str,
) -> Result<RelayEvent, String> {
    let peer = value
        .get("peerId")
        .and_then(Value::as_str)
        .ok_or("Relay update has no authenticated peer")?;
    let message = value
        .get("messageId")
        .and_then(Value::as_str)
        .ok_or("Relay update is missing identity")?;
    if peer.is_empty()
        || peer.len() > 160
        || !peer
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        || message.is_empty()
        || message.len() > 160
        || !message
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Malformed relay update identity".into());
    }
    let seq = value
        .get("clientSeq")
        .and_then(Value::as_u64)
        .filter(|n| *n > 0)
        .ok_or("Malformed relay author sequence")?;
    let cursor = value
        .get("cursor")
        .and_then(Value::as_u64)
        .filter(|n| *n > 0)
        .ok_or("Malformed relay journal cursor")?;
    let payload = value
        .get("payload")
        .and_then(Value::as_str)
        .ok_or("Relay update is missing content")?;
    if payload.len() > (MAX_UPDATE_BYTES / 3 + 1) * 4 + 4 {
        return Err("Oversized relay content".into());
    }
    let bytes = STANDARD
        .decode(payload.as_bytes())
        .map_err(|_| "Invalid relay base64")?;
    if bytes.is_empty() || bytes.len() > MAX_UPDATE_BYTES || STANDARD.encode(&bytes) != payload {
        return Err("Relay content is empty, oversized or not canonical".into());
    }
    let mut out = event(session_id, scope, "remote_update");
    out.peer_id = Some(peer.into());
    out.message_id = Some(message.into());
    out.client_seq = Some(seq);
    out.cursor = Some(cursor);
    out.payload = Some(payload.into());
    Ok(out)
}

fn checked_outbox_sequence(client_seq: i64) -> Result<u64, String> {
    u64::try_from(client_seq)
        .ok()
        .filter(|sequence| *sequence > 0)
        .ok_or_else(|| "Native collaboration journal returned an invalid author sequence".into())
}

fn acknowledge(
    value: &Value,
    in_flight: &mut BTreeMap<u64, String>,
    scope: &JournalScope,
    session_id: &str,
) -> Result<RelayEvent, String> {
    if value.get("durable").and_then(Value::as_bool) != Some(true) {
        return Err("Relay did not confirm durable persistence".into());
    }
    let seq = value
        .get("clientSeq")
        .and_then(Value::as_u64)
        .ok_or("Relay ACK omitted sequence")?;
    let message = value
        .get("messageId")
        .and_then(Value::as_str)
        .ok_or("Relay ACK omitted message identity")?;
    let cursor = value
        .get("cursor")
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
        .ok_or("Relay ACK omitted durable cursor")?;
    let Some(queued) = in_flight.remove(&seq) else {
        return Err("Unsolicited relay acknowledgement".into());
    };
    if queued != message {
        return Err("Relay ACK identity does not match the durable native outbox".into());
    }
    let mut receipt = event(session_id, scope, "ack");
    receipt.message_id = Some(message.into());
    receipt.client_seq = Some(seq);
    receipt.cursor = Some(cursor);
    Ok(receipt)
}

async fn read_auth_frame(socket: &mut WebSocket) -> Result<Value, String> {
    let next = tokio::time::timeout(Duration::from_secs(15), socket.try_next())
        .await
        .map_err(|_| "Timed out authenticating collaboration relay")?
        .map_err(|_| "Relay connection ended during authentication")?
        .ok_or("Relay disconnected before authentication")?;
    parse_frame(next)
}

fn parse_frame(frame: Message) -> Result<Value, String> {
    let Message::Text(text) = frame else {
        return Err("Collaboration relay requires JSON text frames".into());
    };
    if text.is_empty() || text.len() > MAX_RELAY_FRAME_BYTES {
        return Err("Invalid or oversized relay frame".into());
    }
    let value: Value = serde_json::from_str(&text).map_err(|_| "Malformed relay JSON")?;
    if !value.is_object() || value.get("type").and_then(Value::as_str).is_none() {
        return Err("Relay returned an invalid message envelope".into());
    }
    Ok(value)
}

async fn send_json(socket: &mut WebSocket, value: Value) -> Result<(), String> {
    let encoded = value.to_string();
    if encoded.len() > MAX_RELAY_FRAME_BYTES {
        return Err("Outbound collaboration relay frame too large".into());
    }
    socket
        .send(Message::Text(encoded))
        .await
        .map_err(|_| "Unable to transmit collaboration relay data".into())
}

fn still_live(lease: &LiveSessionLease, generation: u64) -> bool {
    lease.relay_active.load(Ordering::Acquire)
        && lease.relay_generation.load(Ordering::Acquire) == generation
}

/// Publish only a one-use opaque receipt on the renderer-visible event bus.
/// Text bytes remain inside Rust until an active lease explicitly takes them.
fn publish_authenticated_update(
    app: &AppHandle,
    lease: &LiveSessionLease,
    session_id: &str,
    generation: u64,
    update: RelayEvent,
) -> Result<(), String> {
    if !still_live(lease, generation) {
        return Err("Collaboration relay generation was invalidated".into());
    }
    let ticket = Uuid::new_v4().to_string();
    {
        let mut inbox = lock_recover(&lease.relay_inbox, "collaboration verified inbox");
        inbox.record(ticket.clone(), generation, update)?;
    }
    let mut notification = event(session_id, &lease.scope, "remote_available");
    notification.ticket = Some(ticket);
    app.emit(WIRE_EVENT, notification)
        .map_err(|_| "Unable to deliver authenticated relay receipt".to_string())
}

/// Renderer-callable read must never trust a UI-emitted event's text bytes:
/// only an unguessable native ticket may consume exact authenticated data.
#[tauri::command]
pub fn collaboration_live_take_remote(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
    ticket: String,
) -> Result<RelayEvent, String> {
    if Uuid::parse_str(&ticket).is_err() || ticket.len() != 36 {
        return Err("Invalid authenticated remote update ticket".into());
    }
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    let generation = lease.relay_generation.load(Ordering::Acquire);
    if !still_live(&lease, generation) {
        return Err("Native collaboration relay is not currently authenticated".into());
    }
    lock_recover(&lease.relay_inbox, "collaboration verified inbox").take(&ticket, generation)
}

async fn relay_background(
    mut socket: WebSocket,
    app: AppHandle,
    lease: LiveSessionLease,
    session_id: String,
    generation: u64,
    role: String,
) -> Result<(), String> {
    let mut active = event(&session_id, &lease.scope, "connected");
    active.role = Some(role.clone());
    let _ = app.emit(WIRE_EVENT, active);

    let mut cursor = 0u64;
    let mut sent_through = 0u64;
    let mut in_flight = BTreeMap::<u64, String>::new();
    let mut ticker = tokio::time::interval(Duration::from_millis(250));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    send_json(
        &mut socket,
        json!({"type":"sync","afterCursor":0,"limit":RELAY_PAGE_LIMIT}),
    )
    .await?;

    loop {
        if !still_live(&lease, generation) {
            break;
        }
        tokio::select! {
            _ = ticker.tick() => {
                if !still_live(&lease, generation) {
                    break;
                }
                if role != "viewer" && in_flight.len() < MAX_IN_FLIGHT {
                    let pending = {
                        let journal = lock_recover(&lease.journal, "collaboration local journal");
                        journal.pending(&lease.scope, sent_through)?
                    };
                    for record in pending {
                        if !still_live(&lease, generation) || in_flight.len() >= MAX_IN_FLIGHT {
                            break;
                        }
                        let client_seq = checked_outbox_sequence(record.client_seq)?;
                        let update = json!({
                            "version":1, "kind":"LOCAL_UPDATE",
                            "vaultId":"remote_scoped", "roomId":lease.scope.room_id,
                            "documentId":lease.scope.document_id, "epoch":lease.scope.epoch,
                            "peerId":lease.scope.peer_id,
                            "messageId":record.message_id,
                            "clientSeq":client_seq,
                            "payload":STANDARD.encode(&record.payload)
                        });
                        send_json(&mut socket, json!({"type":"update","update":update})).await?;
                        sent_through = client_seq;
                        in_flight.insert(client_seq, record.message_id);
                    }
                }
            }
            incoming = socket.try_next() => {
                let received = incoming
                    .map_err(|_| "Authenticated relay connection failed")?
                    .ok_or("Authenticated relay disconnected")?;
                let frame = parse_frame(received)?;
                match frame.get("type").and_then(Value::as_str) {
                    Some("update") => {
                        let verified = take_authenticated_update(&frame, &lease.scope, &session_id)?;
                        publish_authenticated_update(&app, &lease, &session_id, generation, verified)?;
                    }
                    Some("updates") => {
                        let list = frame.get("updates").and_then(Value::as_array)
                            .ok_or("Invalid relay synchronization page")?;
                        if list.len() > RELAY_PAGE_LIMIT {
                            return Err("Relay synchronization page exceeds the bound".into());
                        }
                        let mut page_end = cursor;
                        for item in list {
                            let verified = take_authenticated_update(item, &lease.scope, &session_id)?;
                            let next = verified.cursor.ok_or("Missing remote cursor")?;
                            if next <= page_end {
                                return Err("Relay returned an out-of-order synchronization cursor".into());
                            }
                            page_end = next;
                            publish_authenticated_update(&app, &lease, &session_id, generation, verified)?;
                        }
                        let next_cursor = frame.get("nextCursor").and_then(Value::as_u64)
                            .ok_or("Relay synchronization page omitted its cursor")?;
                        if next_cursor != page_end {
                            return Err("Relay synchronization page cursor mismatch".into());
                        }
                        cursor = page_end;
                        if list.len() == RELAY_PAGE_LIMIT {
                            send_json(&mut socket, json!({
                                "type":"sync","afterCursor":cursor,"limit":RELAY_PAGE_LIMIT
                            })).await?;
                        }
                    }
                    Some("ack") => {
                        let receipt = acknowledge(&frame, &mut in_flight, &lease.scope, &session_id)?;
                        let _ = app.emit(WIRE_EVENT, receipt);
                    }
                    Some("revoked") => {
                        return Err("Authenticated collaboration membership was revoked".into());
                    }
                    Some("awareness") => {
                        // Ephemeral awareness is deliberately not persisted or used to
                        // mutate canonical text. Future native validation is separate.
                    }
                    _ => {
                        return Err("Unknown authenticated collaboration relay frame".into());
                    }
                }
            }
        }
    }
    let _ = send_json(&mut socket, json!({"type":"leave"})).await;
    Ok(())
}

/// A separately approved network connection, unlike the local journal lease.
/// Refuses insecure WS, redirects and unregistered membership; identity proof
/// stays within Rust. The returned role comes from the verified relay.
#[tauri::command]
pub async fn collaboration_live_connect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    expected_vault_id: String,
    session_id: String,
    endpoint_url: String,
    authorization_token: String,
) -> Result<RelayConnectReceipt, String> {
    let endpoint = validate_endpoint(&endpoint_url)?;
    let lease = {
        let session = active_session(&state)?;
        super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LiveCollaborationConnect,
        Some(&consent_scope(&lease.scope, &endpoint_url)),
        Some(&lease.scope.vault_id),
    )?;
    if lease
        .relay_active
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Native collaboration relay is already active for this note".into());
    }
    let generation = lease.relay_generation.fetch_add(1, Ordering::AcqRel) + 1;
    lock_recover(&lease.relay_inbox, "collaboration verified inbox").clear();
    let authentication = async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| "Unable to configure secure collaboration relay")?;
        let upgrade = client
            .get(endpoint)
            .upgrade()
            .protocols([SUBPROTOCOL])
            .send()
            .await
            .map_err(|_| "Unable to connect to the trusted WSS collaboration relay")?;
        let mut socket = upgrade
            .into_websocket()
            .await
            .map_err(|_| "Relay did not complete the authenticated WebSocket handshake")?;
        if socket.protocol() != Some(SUBPROTOCOL) {
            return Err("Relay did not negotiate the required collaboration subprotocol".into());
        }
        if !still_live(&lease, generation) {
            return Err("Collaboration session ended before relay authentication".into());
        }
        send_json(
            &mut socket,
            json!({"type":"hello","scope":{
                "roomId":lease.scope.room_id,
                "documentId":lease.scope.document_id,
                "epoch":lease.scope.epoch,
                "peerId":lease.scope.peer_id
            }}),
        )
        .await?;
        let challenge = read_auth_frame(&mut socket).await?;
        if challenge.get("type").and_then(Value::as_str) != Some("challenge") {
            return Err("Relay refused authenticated challenge".into());
        }
        let challenge_id = challenge
            .get("challengeId")
            .and_then(Value::as_str)
            .ok_or("Missing relay challenge identity")?;
        let signed_challenge = challenge
            .get("challenge")
            .and_then(Value::as_str)
            .ok_or("Missing scoped relay challenge")?;
        let signature = sign_relay_challenge(&lease.scope, signed_challenge)?;
        send_json(
            &mut socket,
            json!({
                "type":"proof", "challengeId":challenge_id, "signature":signature
            }),
        )
        .await?;
        let ready = read_auth_frame(&mut socket).await?;
        let role = role_from_ready(&ready, &lease.scope)?;
        if !still_live(&lease, generation) {
            return Err("Collaboration session ended before relay joined".into());
        }
        Ok::<_, String>((socket, role))
    }
    .await;
    let (socket, role) = match authentication {
        Ok(ready) => ready,
        Err(error) => {
            if lease.relay_generation.load(Ordering::Acquire) == generation {
                lease.relay_active.store(false, Ordering::Release);
            }
            return Err(error);
        }
    };
    let background_lease = lease.clone();
    let background_session_id = session_id.clone();
    let background_role = role.clone();
    tauri::async_runtime::spawn(async move {
        let result = relay_background(
            socket,
            app.clone(),
            background_lease.clone(),
            background_session_id.clone(),
            generation,
            background_role,
        )
        .await;
        if still_live(&background_lease, generation) {
            background_lease
                .relay_active
                .store(false, Ordering::Release);
            lock_recover(
                &background_lease.relay_inbox,
                "collaboration verified inbox",
            )
            .clear();
            let kind = if result.is_ok() {
                "disconnected"
            } else {
                "error"
            };
            let _ = app.emit(
                WIRE_EVENT,
                event(&background_session_id, &background_lease.scope, kind),
            );
        }
    });
    Ok(RelayConnectReceipt { session_id, role })
}

/// Disconnect transport without deleting the native outbox or revoking the
/// local document lease. The worker is generation-cancelled at its next tick.
#[tauri::command]
pub fn collaboration_live_disconnect(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
) -> Result<bool, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    let was_active = lease.relay_active.swap(false, Ordering::AcqRel);
    lease.relay_generation.fetch_add(1, Ordering::AcqRel);
    lock_recover(&lease.relay_inbox, "collaboration verified inbox").clear();
    Ok(was_active)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope() -> JournalScope {
        JournalScope {
            vault_id: "private".into(),
            room_id: "room".into(),
            document_id: "doc".into(),
            epoch: 2,
            peer_id: "alice".into(),
            note_path: "notes/owned.md".into(),
        }
    }

    #[test]
    fn only_explicit_wss_relay_endpoints_are_allowed() {
        assert!(validate_endpoint("wss://relay.example.com/v1/live").is_ok());
        assert!(validate_endpoint("ws://relay.example.com/v1/live").is_err());
        assert!(validate_endpoint("https://relay.example.com/v1/live").is_err());
        assert!(validate_endpoint("***relay.example.com/v1/live").is_err());
        assert!(validate_endpoint("wss://relay.example.com/v1/live?token=secret").is_err());
        assert!(validate_endpoint("wss://relay.example.com/v1/other").is_err());
    }

    #[test]
    fn authenticated_ready_cannot_rebind_to_another_room_or_role() {
        let expected = scope();
        let good = json!({"type":"ready","role":"editor","scope":{
            "roomId":"room","documentId":"doc","epoch":2,"peerId":"alice"
        }});
        assert_eq!(role_from_ready(&good, &expected).unwrap(), "editor");
        assert!(
            role_from_ready(
                &json!({"type":"ready","role":"admin","scope":good["scope"]}),
                &expected
            )
            .is_err()
        );
        assert!(
            role_from_ready(
                &json!({"type":"ready","role":"editor","scope":{
                    "roomId":"elsewhere","documentId":"doc","epoch":2,"peerId":"alice"
                }}),
                &expected
            )
            .is_err()
        );
    }

    #[test]
    fn native_remote_inbox_rejects_forged_guesses_and_one_time_replays() {
        let bound = scope();
        let mut inbox = VerifiedRemoteInbox::default();
        let mut trusted = event("native-session", &bound, "remote_update");
        trusted.peer_id = Some("bob".into());
        trusted.message_id = Some("update_1".into());
        trusted.client_seq = Some(3);
        trusted.cursor = Some(5);
        trusted.payload = Some("AQID".into());
        inbox.record("ticket_1".into(), 7, trusted).unwrap();
        assert!(inbox.take("guessed_ticket", 7).is_err());
        assert!(
            inbox.take("ticket_1", 8).is_err(),
            "stale generations must fail"
        );
        let received = inbox.take("ticket_1", 7).unwrap();
        assert_eq!(received.peer_id.as_deref(), Some("bob"));
        assert_eq!(received.payload.as_deref(), Some("AQID"));
        assert!(
            inbox.take("ticket_1", 7).is_err(),
            "a renderer cannot replay one ticket"
        );
    }

    #[test]
    fn native_remote_inbox_refuses_unbounded_buffering_instead_of_dropping_edits() {
        let bound = scope();
        let mut inbox = VerifiedRemoteInbox::default();
        let mut update = event("native-session", &bound, "remote_update");
        update.payload = Some("AAAA".repeat(100));
        for id in 0..MAX_VERIFIED_INBOX_ITEMS {
            inbox
                .record(format!("trusted_{id}"), 1, update.clone())
                .unwrap();
        }
        assert!(inbox.record("overflow".into(), 1, update).is_err());
        inbox.clear();
        assert!(
            inbox.take("trusted_1", 1).is_err(),
            "disconnect revokes queued tickets"
        );
    }

    #[test]
    fn sqlite_outbox_sequences_must_not_wrap_or_be_nonpositive_on_the_wire() {
        assert_eq!(checked_outbox_sequence(1).unwrap(), 1);
        assert_eq!(checked_outbox_sequence(i64::MAX).unwrap(), i64::MAX as u64);
        assert!(checked_outbox_sequence(0).is_err());
        assert!(checked_outbox_sequence(-1).is_err());
    }

    #[test]
    fn durable_acks_must_match_exact_native_outbox_messages() {
        let mut in_flight = BTreeMap::from([(7, "msg_007".into())]);
        assert!(
            acknowledge(
                &json!({
                    "type":"ack","messageId":"msg_else","clientSeq":7,"durable":true,"cursor":8
                }),
                &mut in_flight,
                &scope(),
                "session"
            )
            .is_err()
        );
        let mut in_flight = BTreeMap::from([(7, "msg_007".into())]);
        assert!(
            acknowledge(
                &json!({
                    "type":"ack","messageId":"msg_007","clientSeq":7,"durable":false,"cursor":8
                }),
                &mut in_flight,
                &scope(),
                "session"
            )
            .is_err()
        );
        assert!(
            acknowledge(
                &json!({
                    "type":"ack","messageId":"msg_007","clientSeq":7,"durable":true,"cursor":8
                }),
                &mut in_flight,
                &scope(),
                "session"
            )
            .is_ok()
        );
        assert!(in_flight.is_empty());
    }
}
