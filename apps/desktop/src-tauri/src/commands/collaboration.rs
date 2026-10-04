//! Explicitly authorized, folder-confined immutable Drive collaboration records.
use base64::Engine as _;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::google_calendar::{http_client, refresh_if_needed, start_google_auth};
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

const ACCOUNT: &str = "google.drive.collaboration.tokens";
const API: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
const MAX_BYTES: u64 = 4 * 1024 * 1024;
const DOCS_RECORD_PREFIX: &str = "scriptor.collaboration.docs.v1\n";

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CollaborationTransport {
    #[default]
    DriveJson,
    GoogleDocs,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct DocsEnvelope {
    schema: String,
    encoding: String,
    sha256: String,
    payload: String,
}

fn encode_docs_record(record: &CollaborationRecord) -> Result<String, String> {
    record.validate()?;
    let bytes = serde_json::to_vec(record).map_err(|error| error.to_string())?;
    let envelope = DocsEnvelope {
        schema: "scriptor.collaboration.docs.v1".into(),
        encoding: "base64".into(),
        sha256: Sha256::digest(&bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
        payload: base64::engine::general_purpose::STANDARD.encode(bytes),
    };
    let text = format!(
        "{DOCS_RECORD_PREFIX}{}",
        serde_json::to_string(&envelope).map_err(|error| error.to_string())?
    );
    if text.len() > 3_900_000 {
        return Err("Google Docs collaboration envelope exceeds its 3.9 MB transport limit".into());
    }
    Ok(text)
}

fn decode_docs_record(document: &Value) -> Result<Value, String> {
    let body = if let Some(tabs) = document.get("tabs") {
        let tabs = tabs.as_array().ok_or("Invalid Docs record tabs")?;
        if tabs.len() != 1 {
            return Err(
                "Opaque collaboration records must contain exactly one Google Docs tab".into(),
            );
        }
        if tabs[0]
            .get("childTabs")
            .is_some_and(|children| children.as_array().is_none_or(|values| !values.is_empty()))
        {
            return Err("Nested tabs cannot carry opaque collaboration records".into());
        }
        tabs[0]
            .pointer("/documentTab/body")
            .ok_or("Google Docs record body is missing")?
    } else {
        document
            .get("body")
            .ok_or("Google Docs record body is missing")?
    };
    let content = body
        .get("content")
        .and_then(Value::as_array)
        .ok_or("Invalid Docs record body")?;
    if content.len() > 32 {
        return Err("Google Docs revision envelope was edited or exceeds its block limit".into());
    }
    let mut text = String::new();
    for block in content {
        if block.get("sectionBreak").is_some() {
            continue;
        }
        let elements = block
            .pointer("/paragraph/elements")
            .and_then(Value::as_array)
            .ok_or("Google Docs record contains non-text content")?;
        if elements.len() > 256 {
            return Err("Google Docs record has too many text fragments".into());
        }
        for element in elements {
            let piece = element
                .pointer("/textRun/content")
                .and_then(Value::as_str)
                .ok_or("Google Docs record contains a non-text element")?;
            if text.len() + piece.len() > 3_900_001 {
                return Err("Google Docs record exceeds its envelope limit".into());
            }
            text.push_str(piece);
        }
    }
    // Docs adds one terminating paragraph newline. No other whitespace edits are ignored.
    let text = text.strip_suffix('\n').unwrap_or(&text);
    let encoded = text
        .strip_prefix(DOCS_RECORD_PREFIX)
        .ok_or("Google Docs revision schema marker is missing or edited")?;
    let envelope: DocsEnvelope = serde_json::from_str(encoded)
        .map_err(|_| "Google Docs revision envelope is invalid or edited")?;
    if serde_json::to_string(&envelope).map_err(|error| error.to_string())? != encoded {
        return Err("Google Docs revision envelope formatting was edited".into());
    }
    if envelope.schema != "scriptor.collaboration.docs.v1"
        || envelope.encoding != "base64"
        || envelope.sha256.len() != 64
    {
        return Err("Unsupported Google Docs revision envelope".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(envelope.payload)
        .map_err(|_| "Google Docs revision bytes are invalid or edited")?;
    if bytes.len() > 3 * 1024 * 1024 + 16 * 1024
        || Sha256::digest(&bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
            != envelope.sha256
    {
        return Err("Google Docs revision checksum does not match; no content was applied".into());
    }
    let record: CollaborationRecord = serde_json::from_slice(&bytes)
        .map_err(|_| "Google Docs revision is not a collaboration record")?;
    record.validate()?;
    serde_json::to_value(record).map_err(|error| error.to_string())
}

fn read_docs_record(
    client: &reqwest::blocking::Client,
    token: &str,
    folder_id: &str,
    file_id: &str,
) -> Result<Value, String> {
    let metadata = bounded_json(
        client
            .get(format!("{API}/{file_id}"))
            .bearer_auth(token)
            .query(&[("fields", "parents,mimeType,trashed,appProperties")])
            .send()
            .map_err(|error| error.to_string())?,
    )?;
    validate_docs_metadata(&metadata, folder_id)?;
    if metadata
        .pointer("/appProperties/scriptorCollaboration")
        .and_then(Value::as_str)
        != Some("1")
        || metadata
            .pointer("/appProperties/scriptorTransport")
            .and_then(Value::as_str)
            != Some("googleDocsOpaqueV1")
    {
        return Err("Google document is not a managed opaque collaboration record".into());
    }
    let document = bounded_json(
        client
            .get(format!(
                "https://docs.googleapis.com/v1/documents/{file_id}"
            ))
            .bearer_auth(token)
            .query(&[("includeTabsContent", "true")])
            .send()
            .map_err(|error| error.to_string())?,
    )?;
    decode_docs_record(&document)
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CollaborationRecord {
    schema: String,
    id: String,
    document: String,
    peer_id: String,
    base_markdown: String,
    markdown: String,
    created_at: String,
}

impl CollaborationRecord {
    fn validate(&self) -> Result<(), String> {
        validate_id(&self.id)?;
        validate_id(&self.peer_id)?;
        if self.schema != "scriptor.collaboration.v1"
            || self.document.is_empty()
            || self.document.len() > 1024
            || self.document.contains(['\\', '\0', ':'])
            || self.document.chars().any(char::is_control)
            || self.document.starts_with('/')
            || self
                .document
                .split('/')
                .any(|part| part.is_empty() || matches!(part, "." | ".."))
            || !self.document.ends_with(".md")
            || self.created_at.len() > 64
            || chrono::DateTime::parse_from_rfc3339(&self.created_at).is_err()
            || self.base_markdown.len() + self.markdown.len() > 3 * 1024 * 1024
        {
            return Err("invalid collaboration record".into());
        }
        Ok(())
    }
}

fn validate_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 200
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("invalid Google Drive identity".into());
    }
    Ok(())
}

fn bounded_json(response: reqwest::blocking::Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!(
            "Google Drive request failed ({})",
            response.status()
        ));
    }
    let mut bytes = Vec::new();
    response
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("Google Drive response exceeds its size limit".into());
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| "Google Drive returned invalid collaboration JSON".into())
}

fn existing_revision_file(response: &Value) -> Result<Option<&Value>, String> {
    // Drive may return partial or empty pages before the end of a listing.
    // A bounded first page cannot prove identity uniqueness in that case.
    if response
        .get("nextPageToken")
        .is_some_and(|value| value.as_str().is_none_or(|token| !token.is_empty()))
        || response
            .get("incompleteSearch")
            .is_some_and(|value| value.as_bool() != Some(false))
    {
        return Err("Shared revision identity search is incomplete; retry before sharing".into());
    }
    let files = response
        .get("files")
        .and_then(Value::as_array)
        .ok_or("Invalid collaboration revision duplicate check")?;
    if files.len() > 1 {
        return Err("Shared revision identity has multiple remote records; resolve duplicates before sharing".into());
    }
    Ok(files.first())
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum DriveRequest {
    List {
        folder_id: String,
        page_token: Option<String>,
        transport: Option<CollaborationTransport>,
    },
    Read {
        folder_id: String,
        file_id: String,
    },
    ReadDocs {
        folder_id: String,
        file_id: String,
    },
    ReadDocsRecord {
        folder_id: String,
        file_id: String,
    },
    AppendDocsRecord {
        folder_id: String,
        name: String,
        record: CollaborationRecord,
    },
    AppendDocs {
        folder_id: String,
        title: String,
        text: String,
    },
    Append {
        folder_id: String,
        name: String,
        record: CollaborationRecord,
    },
}

impl DriveRequest {
    fn validate(&self) -> Result<(), String> {
        validate_id(self.folder())?;
        match self {
            Self::List { page_token, .. }
                if page_token.as_ref().is_some_and(|value| value.len() > 2048) =>
            {
                Err("Drive page token exceeds its limit".into())
            }
            Self::Read { file_id, .. }
            | Self::ReadDocs { file_id, .. }
            | Self::ReadDocsRecord { file_id, .. } => validate_id(file_id),
            Self::AppendDocs { title, text, .. } => {
                if title.trim().is_empty()
                    || title.len() > 512
                    || title.chars().any(char::is_control)
                    || text.trim().is_empty()
                    || text.len() > 1_572_864
                {
                    return Err("Google Docs copy is empty or exceeds its text limits".into());
                }
                Ok(())
            }
            Self::Append { name, record, .. } | Self::AppendDocsRecord { name, record, .. } => {
                record.validate()?;
                if name != &format!("{}.json", record.id) {
                    return Err("record name must match its immutable identity".into());
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }
    fn folder(&self) -> &str {
        match self {
            Self::List { folder_id, .. }
            | Self::Read { folder_id, .. }
            | Self::ReadDocs { folder_id, .. }
            | Self::ReadDocsRecord { folder_id, .. }
            | Self::AppendDocsRecord { folder_id, .. }
            | Self::AppendDocs { folder_id, .. }
            | Self::Append { folder_id, .. } => folder_id,
        }
    }
    fn scope(&self) -> String {
        match self {
            Self::List {
                folder_id,
                transport,
                ..
            } => match transport.unwrap_or_default() {
                CollaborationTransport::DriveJson => format!("drive:list:{folder_id}"),
                CollaborationTransport::GoogleDocs => {
                    format!("drive:docs-records:list:{folder_id}")
                }
            },
            Self::Read { folder_id, file_id } => format!("drive:read:{folder_id}:{file_id}"),
            Self::ReadDocs { folder_id, file_id } => {
                format!("drive:docs:read:{folder_id}:{file_id}")
            }
            Self::AppendDocs { folder_id, .. } => format!("drive:docs:create:{folder_id}"),
            Self::ReadDocsRecord { folder_id, file_id } => {
                format!("drive:docs-record:read:{folder_id}:{file_id}")
            }
            Self::AppendDocsRecord {
                folder_id, name, ..
            } => format!("drive:docs-record:append:{folder_id}:{name}"),
            Self::Append {
                folder_id, name, ..
            } => format!("drive:append:{folder_id}:{name}"),
        }
    }
}

#[tauri::command]
pub fn collaboration_connect(
    state: tauri::State<AppState>,
    client_id: String,
    authorization_token: String,
) -> Result<String, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleDriveAuth,
        Some("google-drive-collaboration"),
        None,
    )?;
    if client_id.len() > 512 {
        return Err("Google client ID exceeds its limit".into());
    }
    start_google_auth(
        client_id,
        "openid email https://www.googleapis.com/auth/drive",
        ACCOUNT,
    )
}

#[tauri::command]
pub fn collaboration_disconnect(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::KeychainDelete,
        Some(ACCOUNT),
        None,
    )?;
    scriptor_system_bridge::keychain_delete(ACCOUNT).map_err(|error| error.to_string())?;
    POLL_LEASES
        .lock()
        .map_err(|_| "Polling session lock failed")?
        .clear();
    Ok(())
}

#[tauri::command]
pub fn collaboration_read(
    state: tauri::State<AppState>,
    request: DriveRequest,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<Value, String> {
    request.validate()?;
    if matches!(
        &request,
        DriveRequest::Append { .. }
            | DriveRequest::AppendDocs { .. }
            | DriveRequest::AppendDocsRecord { .. }
    ) {
        return Err("read authorization cannot append revisions".into());
    }
    let session = active_session(&state)?;
    validate_origin_vault(&session.descriptor.id, &expected_vault_id)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleDriveRead,
        Some(&request.scope()),
        Some(&session.descriptor.id),
    )?;
    exchange(request)
}

#[tauri::command]
pub fn collaboration_write(
    state: tauri::State<AppState>,
    request: DriveRequest,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<Value, String> {
    request.validate()?;
    if !matches!(
        &request,
        DriveRequest::Append { .. }
            | DriveRequest::AppendDocs { .. }
            | DriveRequest::AppendDocsRecord { .. }
    ) {
        return Err("write authorization requires an append request".into());
    }
    let session = active_session(&state)?;
    validate_origin_vault(&session.descriptor.id, &expected_vault_id)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleDriveWrite,
        Some(&request.scope()),
        Some(&session.descriptor.id),
    )?;
    exchange(request)
}

fn validate_origin_vault(active: &str, expected: &str) -> Result<(), String> {
    if expected.is_empty() || active != expected {
        return Err(
            "Vault changed since collaboration started; reopen the panel before reading or sharing"
                .into(),
        );
    }
    Ok(())
}

fn exchange(request: DriveRequest) -> Result<Value, String> {
    let client = http_client()?;
    let token = refresh_if_needed(&client, ACCOUNT)?;
    match request {
        DriveRequest::ReadDocsRecord { folder_id, file_id } => {
            read_docs_record(&client, &token, &folder_id, &file_id)
        }
        DriveRequest::AppendDocsRecord {
            folder_id,
            name,
            record,
        } => {
            let text = encode_docs_record(&record)?;
            let query = format!(
                "'{folder_id}' in parents and trashed=false and name='{name}' and appProperties has {{ key='scriptorTransport' and value='googleDocsOpaqueV1' }}"
            );
            let existing = bounded_json(
                client
                    .get(API)
                    .bearer_auth(&token)
                    .query(&[
                        ("q", query.as_str()),
                        ("pageSize", "2"),
                        ("fields", "nextPageToken,incompleteSearch,files(id,name)"),
                    ])
                    .send()
                    .map_err(|error| error.to_string())?,
            )?;
            if let Some(file) = existing_revision_file(&existing)? {
                let id = file
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or("Invalid Google Docs record identity")?;
                validate_id(id)?;
                if read_docs_record(&client, &token, &folder_id, id)?
                    != serde_json::to_value(&record).map_err(|error| error.to_string())?
                {
                    return Err(
                        "Shared Docs revision identity already has different content".into(),
                    );
                }
                return Ok(file.clone());
            }
            let metadata = json!({"name":name,"mimeType":"application/vnd.google-apps.document","parents":[folder_id],"appProperties":{"scriptorCollaboration":"1","scriptorTransport":"googleDocsOpaqueV1"}});
            let boundary = format!("scriptor-{}", uuid::Uuid::new_v4());
            let multipart = format!(
                "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n--{boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{text}\r\n--{boundary}--\r\n"
            );
            bounded_json(
                client
                    .post(UPLOAD)
                    .bearer_auth(&token)
                    .query(&[("uploadType", "multipart"), ("fields", "id,name")])
                    .header(
                        "Content-Type",
                        format!("multipart/related; boundary={boundary}"),
                    )
                    .body(multipart)
                    .send()
                    .map_err(|error| error.to_string())?,
            )
        }
        DriveRequest::ReadDocs { folder_id, file_id } => {
            let metadata = bounded_json(
                client
                    .get(format!("{API}/{file_id}"))
                    .bearer_auth(&token)
                    .query(&[("fields", "parents,mimeType,trashed")])
                    .send()
                    .map_err(|error| error.to_string())?,
            )?;
            validate_docs_metadata(&metadata, &folder_id)?;
            bounded_json(
                client
                    .get(format!(
                        "https://docs.googleapis.com/v1/documents/{file_id}"
                    ))
                    .bearer_auth(&token)
                    .query(&[("includeTabsContent", "true")])
                    .send()
                    .map_err(|error| error.to_string())?,
            )
        }
        DriveRequest::AppendDocs {
            folder_id,
            title,
            text,
        } => {
            let boundary = format!("scriptor-{}", uuid::Uuid::new_v4());
            let metadata = json!({"name":title,"mimeType":"application/vnd.google-apps.document","parents":[folder_id]});
            // Conversion creates a NEW document. Existing rich documents are never replaced.
            let multipart = format!(
                "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n--{boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{text}\r\n--{boundary}--\r\n"
            );
            bounded_json(
                client
                    .post(UPLOAD)
                    .bearer_auth(&token)
                    .query(&[("uploadType", "multipart"), ("fields", "id,name")])
                    .header(
                        "Content-Type",
                        format!("multipart/related; boundary={boundary}"),
                    )
                    .body(multipart)
                    .send()
                    .map_err(|error| error.to_string())?,
            )
        }
        DriveRequest::List {
            folder_id,
            page_token,
            transport,
        } => {
            let query = match transport.unwrap_or_default() {
                CollaborationTransport::DriveJson => format!(
                    "'{folder_id}' in parents and trashed=false and mimeType='application/json' and appProperties has {{ key='scriptorCollaboration' and value='1' }}"
                ),
                CollaborationTransport::GoogleDocs => format!(
                    "'{folder_id}' in parents and trashed=false and mimeType='application/vnd.google-apps.document' and appProperties has {{ key='scriptorCollaboration' and value='1' }} and appProperties has {{ key='scriptorTransport' and value='googleDocsOpaqueV1' }}"
                ),
            };
            let mut request = client.get(API).bearer_auth(&token).query(&[
                ("q", query.as_str()),
                ("pageSize", "100"),
                ("orderBy", "createdTime desc"),
                (
                    "fields",
                    "nextPageToken,files(id,name,parents,appProperties)",
                ),
            ]);
            if let Some(page_token) = page_token {
                request = request.query(&[("pageToken", page_token)]);
            }
            bounded_json(request.send().map_err(|error| error.to_string())?)
        }
        DriveRequest::Read { folder_id, file_id } => {
            let metadata = bounded_json(
                client
                    .get(format!("{API}/{file_id}"))
                    .bearer_auth(&token)
                    .query(&[("fields", "parents,appProperties,size")])
                    .send()
                    .map_err(|error| error.to_string())?,
            )?;
            let belongs = metadata
                .get("parents")
                .and_then(Value::as_array)
                .is_some_and(|parents| {
                    parents
                        .iter()
                        .any(|parent| parent.as_str() == Some(folder_id.as_str()))
                });
            if !belongs
                || metadata
                    .pointer("/appProperties/scriptorCollaboration")
                    .and_then(Value::as_str)
                    != Some("1")
            {
                return Err("Drive record is outside the approved collaboration scope".into());
            }
            bounded_json(
                client
                    .get(format!("{API}/{file_id}"))
                    .bearer_auth(&token)
                    .query(&[("alt", "media")])
                    .send()
                    .map_err(|error| error.to_string())?,
            )
        }
        DriveRequest::Append {
            folder_id,
            name,
            record,
        } => {
            let body = serde_json::to_string(&record).map_err(|error| error.to_string())?;
            if body.len() as u64 > MAX_BYTES {
                return Err("collaboration record exceeds its size limit".into());
            }
            let query = format!(
                "'{folder_id}' in parents and trashed=false and name='{name}' and appProperties has {{ key='scriptorCollaboration' and value='1' }}"
            );
            let existing = bounded_json(
                client
                    .get(API)
                    .bearer_auth(&token)
                    .query(&[
                        ("q", query.as_str()),
                        ("pageSize", "2"),
                        ("fields", "nextPageToken,incompleteSearch,files(id,name)"),
                    ])
                    .send()
                    .map_err(|error| error.to_string())?,
            )?;
            if let Some(file) = existing_revision_file(&existing)? {
                let id = file
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or("invalid Drive record identity")?;
                validate_id(id)?;
                let stored = bounded_json(
                    client
                        .get(format!("{API}/{id}"))
                        .bearer_auth(&token)
                        .query(&[("alt", "media")])
                        .send()
                        .map_err(|error| error.to_string())?,
                )?;
                if stored != serde_json::to_value(&record).map_err(|error| error.to_string())? {
                    return Err("shared revision identity already has different content".into());
                }
                return Ok(file.clone());
            }
            let boundary = format!("scriptor-{}", uuid::Uuid::new_v4());
            let metadata = json!({"name": name, "mimeType": "application/json", "parents": [folder_id], "appProperties": {"scriptorCollaboration": "1"}});
            let multipart = format!(
                "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n--{boundary}\r\nContent-Type: application/json\r\n\r\n{body}\r\n--{boundary}--\r\n"
            );
            bounded_json(
                client
                    .post(UPLOAD)
                    .bearer_auth(&token)
                    .query(&[("uploadType", "multipart"), ("fields", "id,name")])
                    .header(
                        "Content-Type",
                        format!("multipart/related; boundary={boundary}"),
                    )
                    .body(multipart)
                    .send()
                    .map_err(|error| error.to_string())?,
            )
        }
    }
}

fn validate_docs_metadata(metadata: &Value, folder_id: &str) -> Result<(), String> {
    if metadata.get("mimeType").and_then(Value::as_str)
        != Some("application/vnd.google-apps.document")
        || metadata.get("trashed").and_then(Value::as_bool) != Some(false)
        || !metadata
            .get("parents")
            .and_then(Value::as_array)
            .is_some_and(|parents| {
                parents
                    .iter()
                    .any(|parent| parent.as_str() == Some(folder_id))
            })
    {
        return Err("Google document is outside the approved folder or is unavailable".into());
    }
    Ok(())
}

struct PollLease {
    vault_id: String,
    folder_id: String,
    deadline: Instant,
    next_request: Instant,
    remaining: u32,
    transport: CollaborationTransport,
}
static POLL_LEASES: LazyLock<Mutex<HashMap<String, PollLease>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Serialize)]
pub struct PollSession {
    lease_id: String,
    expires_at: String,
    remaining_requests: u32,
}

#[tauri::command]
pub fn collaboration_poll_start(
    state: tauri::State<AppState>,
    folder_id: String,
    expected_vault_id: String,
    authorization_token: String,
    transport: Option<CollaborationTransport>,
) -> Result<PollSession, String> {
    validate_id(&folder_id)?;
    let session = active_session(&state)?;
    if session.descriptor.id != expected_vault_id {
        return Err("Vault changed; reopen collaboration".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleDriveRead,
        Some(&match transport.unwrap_or_default() {
            CollaborationTransport::DriveJson => format!("drive:poll:{folder_id}"),
            CollaborationTransport::GoogleDocs => format!("drive:docs-records:poll:{folder_id}"),
        }),
        Some(&expected_vault_id),
    )?;
    let now = Instant::now();
    let mut leases = POLL_LEASES
        .lock()
        .map_err(|_| "Polling session lock failed")?;
    leases.retain(|_, lease| lease.deadline > now && lease.remaining > 0);
    if leases.len() >= 8 {
        return Err("Too many active collaboration polling sessions".into());
    }
    let lease_id = uuid::Uuid::new_v4().to_string();
    leases.insert(
        lease_id.clone(),
        PollLease {
            vault_id: expected_vault_id,
            folder_id,
            deadline: now + Duration::from_secs(900),
            next_request: now,
            remaining: 30,
            transport: transport.unwrap_or_default(),
        },
    );
    Ok(PollSession {
        lease_id,
        expires_at: (chrono::Utc::now() + chrono::Duration::minutes(15)).to_rfc3339(),
        remaining_requests: 30,
    })
}

fn take_poll_request(
    lease: &mut PollLease,
    vault_id: &str,
    now: Instant,
) -> Result<String, String> {
    if lease.vault_id != vault_id {
        return Err("Polling session belongs to another vault".into());
    }
    if lease.deadline <= now || lease.remaining == 0 {
        return Err("Polling session ended. Start a new session explicitly.".into());
    }
    if lease.next_request > now {
        return Err("Polling requests must be at least 30 seconds apart".into());
    }
    lease.remaining -= 1;
    lease.next_request = now + Duration::from_secs(30);
    Ok(lease.folder_id.clone())
}

#[tauri::command]
pub fn collaboration_poll_read(
    state: tauri::State<AppState>,
    lease_id: String,
    expected_vault_id: String,
) -> Result<Value, String> {
    validate_id(&lease_id)?;
    let session = active_session(&state)?;
    if session.descriptor.id != expected_vault_id {
        return Err("Vault changed; polling stopped".into());
    }
    let (folder_id, transport) = {
        let mut leases = POLL_LEASES
            .lock()
            .map_err(|_| "Polling session lock failed")?;
        let lease = leases.get_mut(&lease_id).ok_or("Polling session ended")?;
        (
            take_poll_request(lease, &expected_vault_id, Instant::now())?,
            lease.transport,
        )
    };
    exchange(DriveRequest::List {
        folder_id,
        page_token: None,
        transport: Some(transport),
    })
}

#[tauri::command]
pub fn collaboration_poll_stop(lease_id: String, expected_vault_id: String) -> Result<(), String> {
    validate_id(&lease_id)?;
    let mut leases = POLL_LEASES
        .lock()
        .map_err(|_| "Polling session lock failed")?;
    if let Some(lease) = leases.get(&lease_id)
        && lease.vault_id != expected_vault_id
    {
        return Err("Polling session belongs to another vault".into());
    }
    leases.remove(&lease_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn immutable_revision_identity_rejects_ambiguous_existing_records() {
        assert!(
            existing_revision_file(&json!({"files":[]}))
                .unwrap()
                .is_none()
        );
        let unique = json!({"files":[{"id":"one","name":"event.json"}]});
        assert_eq!(
            existing_revision_file(&unique).unwrap(),
            unique["files"].as_array().unwrap().first()
        );
        assert!(existing_revision_file(&json!({"files":[{"id":"one"},{"id":"two"}]})).is_err());
        assert!(existing_revision_file(&json!({"files":"invalid"})).is_err());
        for files in [json!([]), json!([{"id":"one"}])] {
            assert!(
                existing_revision_file(&json!({
                    "files": files,
                    "nextPageToken": "another-page"
                }))
                .is_err()
            );
            assert!(
                existing_revision_file(&json!({
                    "files": files,
                    "incompleteSearch": true
                }))
                .is_err()
            );
        }
    }
    #[test]
    fn stale_origin_is_rejected_before_collaboration_exchange() {
        assert!(validate_origin_vault("vault-a", "vault-a").is_ok());
        assert!(validate_origin_vault("vault-b", "vault-a").is_err());
        assert!(validate_origin_vault("vault-a", "").is_err());
    }
    #[test]
    fn opaque_docs_records_preserve_markdown_bytes_and_reject_edits_and_multiple_tabs() {
        let value = json!({"schema":"scriptor.collaboration.v1","id":"event-1","document":"notes/a.md","peer_id":"peer-1","base_markdown":"base\r\nفارسی\n","markdown":"# Text\r\n\r\ne\u{301} 🌱\n\t[asset](a.png)\n","created_at":"2026-10-02T00:00:00Z"});
        let record: CollaborationRecord = serde_json::from_value(value.clone()).unwrap();
        let encoded = encode_docs_record(&record).unwrap();
        let doc = |text: String| json!({"tabs":[{"documentTab":{"body":{"content":[{"paragraph":{"elements":[{"textRun":{"content":text}}]}}]}},"childTabs":[]}]});
        assert_eq!(
            decode_docs_record(&doc(format!("{encoded}\n"))).unwrap(),
            value
        );
        assert!(decode_docs_record(&doc(format!("{encoded}\n\n"))).is_err());
        assert!(
            decode_docs_record(&doc(
                encoded.replace("scriptor.collaboration.docs.v1", "edited.schema")
            ))
            .is_err()
        );
        let mut envelope: DocsEnvelope =
            serde_json::from_str(encoded.strip_prefix(DOCS_RECORD_PREFIX).unwrap()).unwrap();
        envelope.sha256 = "0".repeat(64);
        let encoded_bad_checksum = serde_json::to_string(&envelope).unwrap();
        assert!(
            decode_docs_record(&doc(format!(
                "{DOCS_RECORD_PREFIX}{encoded_bad_checksum}\n"
            )))
            .unwrap_err()
            .contains("checksum")
        );
        assert!(decode_docs_record(&json!({"tabs":[{},{}]})).is_err());
        assert!(
            decode_docs_record(
                &json!({"tabs":[{"documentTab":{"body":{"content":[]}},"childTabs":[{}]}]})
            )
            .is_err()
        );
        assert!(decode_docs_record(&json!({"body":{"content":[{"table":{}}]}})).is_err());
    }
    #[test]
    fn polling_lease_is_vault_bound_rate_limited_and_finite() {
        let now = Instant::now();
        let mut lease = PollLease {
            vault_id: "vault-a".into(),
            folder_id: "folder".into(),
            deadline: now + Duration::from_secs(900),
            next_request: now,
            remaining: 2,
            transport: CollaborationTransport::DriveJson,
        };
        assert!(take_poll_request(&mut lease, "vault-b", now).is_err());
        assert_eq!(lease.remaining, 2);
        assert_eq!(
            take_poll_request(&mut lease, "vault-a", now).unwrap(),
            "folder"
        );
        assert!(take_poll_request(&mut lease, "vault-a", now + Duration::from_secs(29)).is_err());
        assert!(take_poll_request(&mut lease, "vault-a", now + Duration::from_secs(30)).is_ok());
        assert!(take_poll_request(&mut lease, "vault-a", now + Duration::from_secs(60)).is_err());
        lease.remaining = 1;
        assert!(take_poll_request(&mut lease, "vault-a", now + Duration::from_secs(900)).is_err());
    }
    #[test]
    fn docs_reads_require_live_document_in_exact_folder_and_creates_are_bounded() {
        let valid = json!({"mimeType":"application/vnd.google-apps.document","parents":["folder"],"trashed":false});
        assert!(validate_docs_metadata(&valid, "folder").is_ok());
        assert!(validate_docs_metadata(&valid, "other").is_err());
        assert!(
            validate_docs_metadata(
                &json!({"mimeType":"text/html","parents":["folder"],"trashed":false}),
                "folder"
            )
            .is_err()
        );
        assert!(validate_docs_metadata(&json!({"mimeType":"application/vnd.google-apps.document","parents":["folder"],"trashed":true}),"folder").is_err());
        assert!(
            DriveRequest::AppendDocs {
                folder_id: "folder".into(),
                title: "Copy".into(),
                text: "# Literal Markdown".into()
            }
            .validate()
            .is_ok()
        );
        assert!(
            DriveRequest::AppendDocs {
                folder_id: "folder".into(),
                title: "Copy".into(),
                text: "x".repeat(1_572_865)
            }
            .validate()
            .is_err()
        );
    }
    #[test]
    fn identities_cannot_inject_urls_or_queries() {
        assert!(validate_id("folder_123-abc").is_ok());
        for value in ["", "../x", "x' or trashed=true", "https://evil.example"] {
            assert!(validate_id(value).is_err());
        }
    }
    #[test]
    fn exchange_schema_rejects_extra_fields() {
        assert!(serde_json::from_value::<DriveRequest>(json!({"kind":"list","folder_id":"valid","page_token":null,"url":"https://elsewhere"})).is_err());
    }
    #[test]
    fn revision_schema_confines_paths_and_rejects_oversized_text() {
        let valid = json!({"schema":"scriptor.collaboration.v1","id":"event-1","document":"notes/a.md","peer_id":"peer-1","base_markdown":"","markdown":"a","created_at":"2026-10-01T00:00:00Z"});
        let record = serde_json::from_value::<CollaborationRecord>(valid.clone()).unwrap();
        assert!(record.validate().is_ok());
        for path in [
            "../a.md",
            "C:/a.md",
            "/a.md",
            "notes\\a.md",
            "notes/line\nbreak.md",
        ] {
            let mut invalid = valid.clone();
            invalid["document"] = json!(path);
            assert!(
                serde_json::from_value::<CollaborationRecord>(invalid)
                    .unwrap()
                    .validate()
                    .is_err()
            );
        }
        let mut invalid = valid;
        invalid["markdown"] = json!("x".repeat(3 * 1024 * 1024 + 1));
        assert!(
            serde_json::from_value::<CollaborationRecord>(invalid)
                .unwrap()
                .validate()
                .is_err()
        );
    }
}
