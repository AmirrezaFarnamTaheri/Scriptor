//! Explicitly authorized, folder-confined immutable Drive collaboration records.
use std::io::Read;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::google_calendar::{http_client, refresh_if_needed, start_google_auth};
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

const ACCOUNT: &str = "google.drive.collaboration.tokens";
const API: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
const MAX_BYTES: u64 = 4 * 1024 * 1024;

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

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum DriveRequest {
    List {
        folder_id: String,
        page_token: Option<String>,
    },
    Read {
        folder_id: String,
        file_id: String,
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
            Self::Read { file_id, .. } => validate_id(file_id),
            Self::Append { name, record, .. } => {
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
            | Self::Append { folder_id, .. } => folder_id,
        }
    }
    fn scope(&self) -> String {
        match self {
            Self::List { folder_id, .. } => format!("drive:list:{folder_id}"),
            Self::Read { folder_id, file_id } => format!("drive:read:{folder_id}:{file_id}"),
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
    scriptor_system_bridge::keychain_delete(ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn collaboration_read(
    state: tauri::State<AppState>,
    request: DriveRequest,
    authorization_token: String,
) -> Result<Value, String> {
    request.validate()?;
    if matches!(&request, DriveRequest::Append { .. }) {
        return Err("read authorization cannot append revisions".into());
    }
    let session = active_session(&state)?;
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
    authorization_token: String,
) -> Result<Value, String> {
    request.validate()?;
    if !matches!(&request, DriveRequest::Append { .. }) {
        return Err("write authorization requires an append request".into());
    }
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleDriveWrite,
        Some(&request.scope()),
        Some(&session.descriptor.id),
    )?;
    exchange(request)
}

fn exchange(request: DriveRequest) -> Result<Value, String> {
    let client = http_client()?;
    let token = refresh_if_needed(&client, ACCOUNT)?;
    match request {
        DriveRequest::List {
            folder_id,
            page_token,
        } => {
            let query = format!(
                "'{folder_id}' in parents and trashed=false and mimeType='application/json' and appProperties has {{ key='scriptorCollaboration' and value='1' }}"
            );
            let mut request = client.get(API).bearer_auth(&token).query(&[
                ("q", query.as_str()),
                ("pageSize", "100"),
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
                        ("fields", "files(id,name)"),
                    ])
                    .send()
                    .map_err(|error| error.to_string())?,
            )?;
            if let Some(files) = existing.get("files").and_then(Value::as_array) {
                if let Some(file) = files.first() {
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
            } else {
                return Err("invalid Drive duplicate check".into());
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

#[cfg(test)]
mod tests {
    use super::*;
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
