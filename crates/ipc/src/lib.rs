//! Length-prefixed postcard frames for local-first IPC between Scriptor surfaces.

pub mod fuzz_corpus;
pub mod rate_limit;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

pub const FRAME_MAGIC: u32 = 0x4152434c; // "ARCL"
pub const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub struct RpcRequest {
    pub id: u64,
    pub method: RpcMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub enum RpcMethod {
    Ping,
    OpenVault { path: String },
    ListNotes,
    SearchNotes { query: String, limit: u32 },
    ReadNote { path: String },
    RebuildIndex,
    HealthReport,
    HealthDiagnostics,
    GitStatus,
    Backlinks { path: String },
    GraphSummary { path: Option<String>, depth: u32 },
    ReloadConfig,
    SaveNote {
        path: String,
        markdown: String,
        expected_content_hash: Option<String>,
        dry_run: bool,
    },
    UpdateNoteIndex { path: String },
    RenameNoteApply {
        from_path: String,
        to_path: String,
        update_links: bool,
    },
    ExportRunNote {
        note_path: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    },
    ExportRunMarkdown {
        note_path: String,
        source_markdown: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    },
    ExportStartNote {
        note_path: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    },
    ExportStartMarkdown {
        note_path: String,
        source_markdown: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    },
    ExportJobStatus,
    ExportCancel {
        job_id: Option<String>,
    },
    IndexRebuildStatus,
    SubscribeEvents,
    Invoke {
        command: String,
        payload_json: String,
    },
    ListCommands,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub struct RpcResponse {
    pub id: u64,
    pub result: RpcResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub enum RpcResult {
    Ok(RpcPayload),
    Err(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub enum RpcPayload {
    Pong { version: String },
    VaultOpened { vault_id: String, name: String, root_path: String },
    NoteList { notes: Vec<NoteSummary> },
    SearchHits { hits: Vec<SearchHit> },
    NoteDocument { path: String, title: String, markdown: String },
    RebuildSummary {
        indexed_notes: u32,
        skipped_notes: u32,
        links_written: u32,
    },
    HealthReport { json: String },
    HealthDiagnostics { json: String },
    GitStatus { json: String },
    Backlinks { path: String, json: String },
    GraphSummary { json: String },
    NoteSaved { json: String },
    RenameApplied { json: String },
    ExportResult { json: String },
    ExportStarted { job_id: String },
    ExportJobStatus { json: String },
    IndexRebuildStatus { json: String },
    ConfigReloaded { json: String, generation: u64 },
    Unit,
    Json { json: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub struct RpcEvent {
    pub payload: RpcEventPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub enum RpcEventPayload {
    ConfigReloaded { json: String, generation: u64 },
}

/// Server → client frame: either an RPC response or an unsolicited event.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub enum ServerMessage {
    Response(RpcResponse),
    Event(RpcEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub struct NoteSummary {
    pub path: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../packages/core/src/contracts/ipc-generated.ts")]
pub struct SearchHit {
    pub path: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("frame too large: {0} bytes")]
    FrameTooLarge(usize),
    #[error("invalid frame magic")]
    InvalidMagic,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("codec error: {0}")]
    Codec(String),
}

pub fn encode_frame(message: &RpcRequest) -> Result<Vec<u8>, IpcError> {
    encode_value(message)
}

pub fn encode_response(response: &RpcResponse) -> Result<Vec<u8>, IpcError> {
    encode_value(response)
}

pub fn encode_server_message(message: &ServerMessage) -> Result<Vec<u8>, IpcError> {
    encode_value(message)
}

fn encode_value<T: Serialize>(message: &T) -> Result<Vec<u8>, IpcError> {
    let body = postcard::to_allocvec(message).map_err(|error| IpcError::Codec(error.to_string()))?;
    if body.len() > MAX_FRAME_BYTES {
        return Err(IpcError::FrameTooLarge(body.len()));
    }
    let mut frame = Vec::with_capacity(8 + body.len());
    frame.extend_from_slice(&FRAME_MAGIC.to_le_bytes());
    frame.extend_from_slice(&(body.len() as u32).to_le_bytes());
    frame.extend(body);
    Ok(frame)
}

pub fn decode_request(bytes: &[u8]) -> Result<RpcRequest, IpcError> {
    decode_value(bytes)
}

pub fn decode_response(bytes: &[u8]) -> Result<RpcResponse, IpcError> {
    decode_value(bytes)
}

pub fn decode_server_message(bytes: &[u8]) -> Result<ServerMessage, IpcError> {
    decode_value(bytes)
}

fn decode_value<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, IpcError> {
    let body = decode_body(bytes)?;
    postcard::from_bytes(body).map_err(|error| IpcError::Codec(error.to_string()))
}

fn decode_body(bytes: &[u8]) -> Result<&[u8], IpcError> {
    if bytes.len() < 8 {
        return Err(IpcError::Codec("frame shorter than header".into()));
    }
    let magic = u32::from_le_bytes(bytes[0..4].try_into().expect("slice"));
    if magic != FRAME_MAGIC {
        return Err(IpcError::InvalidMagic);
    }
    let len = u32::from_le_bytes(bytes[4..8].try_into().expect("slice")) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(IpcError::FrameTooLarge(len));
    }
    if bytes.len() < 8 + len {
        return Err(IpcError::Codec("truncated frame body".into()));
    }
    Ok(&bytes[8..8 + len])
}

pub fn read_frame<R: std::io::Read>(reader: &mut R) -> Result<Vec<u8>, IpcError> {
    read_frame_inner(reader, false)
}

/// Like [`read_frame`], but scans the byte stream for the next valid frame header when magic is corrupt.
pub fn read_frame_resyncing<R: std::io::Read>(reader: &mut R) -> Result<Vec<u8>, IpcError> {
    read_frame_inner(reader, true)
}

const RESYNC_SCAN_BUDGET: usize = 64 * 1024;
const INITIAL_CAPACITY: usize = 4096;

fn read_frame_inner<R: std::io::Read>(reader: &mut R, resync: bool) -> Result<Vec<u8>, IpcError> {
    let mut header = [0u8; 8];
    reader.read_exact(&mut header)?;

    let partial_len = if u32::from_le_bytes(header[0..4].try_into().expect("slice")) == FRAME_MAGIC {
        header[4..8].to_vec()
    } else if resync {
        let mut scan_buf = header.to_vec();
        sync_to_length_field(reader, &mut scan_buf)?
    } else {
        return Err(IpcError::InvalidMagic);
    };

    read_body_after_partial_length(reader, &partial_len, INITIAL_CAPACITY)
}

fn sync_to_length_field<R: std::io::Read>(reader: &mut R, scan_buf: &mut Vec<u8>) -> Result<Vec<u8>, IpcError> {
    loop {
        if let Some(len_start) = find_length_field_start(scan_buf) {
            return Ok(scan_buf[len_start..].to_vec());
        }
        if scan_buf.len() > RESYNC_SCAN_BUDGET {
            return Err(IpcError::Codec("resync scan budget exceeded".into()));
        }
        let mut byte = [0u8; 1];
        reader.read_exact(&mut byte)?;
        scan_buf.push(byte[0]);
    }
}

fn find_length_field_start(buf: &[u8]) -> Option<usize> {
    let magic = FRAME_MAGIC.to_le_bytes();
    (0..buf.len().saturating_sub(3)).find(|&start| buf[start..start + 4] == magic)
        .map(|start| start + 4)
}

fn read_body_after_partial_length<R: std::io::Read>(
    reader: &mut R,
    partial_len: &[u8],
    initial_capacity: usize,
) -> Result<Vec<u8>, IpcError> {
    use std::io::Read;

    if partial_len.len() > 4 {
        return Err(IpcError::Codec("length prefix longer than 4 bytes".into()));
    }

    let mut len_bytes = [0u8; 4];
    len_bytes[..partial_len.len()].copy_from_slice(partial_len);
    reader.read_exact(&mut len_bytes[partial_len.len()..])?;

    let len = u32::from_le_bytes(len_bytes) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(IpcError::FrameTooLarge(len));
    }

    let mut body = Vec::with_capacity(len.min(initial_capacity));
    reader
        .take(len as u64)
        .read_to_end(&mut body)
        .map_err(IpcError::from)?;
    if body.len() != len {
        return Err(IpcError::Codec("truncated frame body".into()));
    }
    Ok(body)
}

pub fn write_frame<W: std::io::Write, T: Serialize>(writer: &mut W, message: &T) -> Result<(), IpcError> {
    let frame = encode_value(message)?;
    writer.write_all(&frame)?;
    writer.flush()?;
    Ok(())
}

pub use rate_limit::RateLimiter;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_roundtrip() {
        let request = RpcRequest {
            id: 7,
            method: RpcMethod::SearchNotes {
                query: "daily".into(),
                limit: 25,
            },
        };
        let frame = encode_frame(&request).expect("encode");
        let decoded = decode_request(&frame).expect("decode");
        assert_eq!(decoded, request);
    }

    #[test]
    fn read_frame_rejects_oversized_length_without_large_allocation() {
        let mut header = Vec::new();
        header.extend_from_slice(&FRAME_MAGIC.to_le_bytes());
        header.extend_from_slice(&(MAX_FRAME_BYTES as u32 + 1).to_le_bytes());
        let mut cursor = std::io::Cursor::new(header);
        let error = read_frame(&mut cursor).expect_err("oversized len");
        assert!(matches!(error, IpcError::FrameTooLarge(_)));
    }

    #[test]
    fn read_frame_roundtrip_via_io() {
        let request = RpcRequest {
            id: 1,
            method: RpcMethod::Ping,
        };
        let frame = encode_frame(&request).expect("encode");
        let mut cursor = std::io::Cursor::new(frame);
        let body = read_frame(&mut cursor).expect("read");
        let decoded: RpcRequest = postcard::from_bytes(&body).expect("decode");
        assert_eq!(decoded.method, RpcMethod::Ping);
    }

    #[test]
    fn read_frame_resyncing_skips_leading_garbage() {
        let request = RpcRequest {
            id: 2,
            method: RpcMethod::Ping,
        };
        let mut frame = encode_frame(&request).expect("encode");
        let mut payload = b"GARB".to_vec();
        payload.append(&mut frame);
        let mut cursor = std::io::Cursor::new(payload);
        let body = read_frame_resyncing(&mut cursor).expect("resync read");
        let decoded: RpcRequest = postcard::from_bytes(&body).expect("decode");
        assert_eq!(decoded.id, 2);
        assert_eq!(decoded.method, RpcMethod::Ping);
    }

    #[test]
    fn read_frame_rejects_invalid_magic_without_resync() {
        let mut cursor = std::io::Cursor::new(b"NOPE0000");
        let error = read_frame(&mut cursor).expect_err("invalid magic");
        assert!(matches!(error, IpcError::InvalidMagic));
    }

    #[test]
    fn decode_body_returns_borrowed_slice_without_extra_allocation() {
        let request = RpcRequest {
            id: 3,
            method: RpcMethod::Ping,
        };
        let frame = encode_frame(&request).expect("encode");
        let body = decode_body(&frame).expect("decode body");
        let decoded: RpcRequest = postcard::from_bytes(body).expect("postcard");
        assert_eq!(decoded.id, 3);
    }

    #[test]
    fn invoke_and_list_commands_roundtrip() {
        let invoke = RpcRequest {
            id: 9,
            method: RpcMethod::Invoke {
                command: "health_check".into(),
                payload_json: "{}".into(),
            },
        };
        let frame = encode_frame(&invoke).expect("encode");
        let decoded = decode_request(&frame).expect("decode");
        assert_eq!(decoded, invoke);

        let list = RpcRequest {
            id: 10,
            method: RpcMethod::ListCommands,
        };
        let frame = encode_frame(&list).expect("encode");
        let decoded = decode_request(&frame).expect("decode");
        assert_eq!(decoded.method, RpcMethod::ListCommands);

        let json_payload = RpcResponse {
            id: 11,
            result: RpcResult::Ok(RpcPayload::Json {
                json: r#""ok""#.into(),
            }),
        };
        let frame = encode_response(&json_payload).expect("encode");
        let decoded = decode_response(&frame).expect("decode");
        assert_eq!(decoded, json_payload);
    }
}
