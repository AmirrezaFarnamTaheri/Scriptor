//! Length-prefixed postcard frames for local-first IPC between Scriptor surfaces.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const FRAME_MAGIC: u32 = 0x4152434c; // "ARCL"
pub const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RpcRequest {
    pub id: u64,
    pub method: RpcMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RpcResponse {
    pub id: u64,
    pub result: RpcResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RpcResult {
    Ok(RpcPayload),
    Err(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
    Unit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteSummary {
    pub path: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

fn decode_value<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, IpcError> {
    let body = decode_body(bytes)?;
    postcard::from_bytes(&body).map_err(|error| IpcError::Codec(error.to_string()))
}

fn decode_body(bytes: &[u8]) -> Result<Vec<u8>, IpcError> {
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
    Ok(bytes[8..8 + len].to_vec())
}

pub fn read_frame<R: std::io::Read>(reader: &mut R) -> Result<Vec<u8>, IpcError> {
    let mut header = [0u8; 8];
    reader.read_exact(&mut header)?;
    let magic = u32::from_le_bytes(header[0..4].try_into().expect("slice"));
    if magic != FRAME_MAGIC {
        return Err(IpcError::InvalidMagic);
    }
    let len = u32::from_le_bytes(header[4..8].try_into().expect("slice")) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(IpcError::FrameTooLarge(len));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    Ok(body)
}

pub fn write_frame<W: std::io::Write, T: Serialize>(writer: &mut W, message: &T) -> Result<(), IpcError> {
    let frame = encode_value(message)?;
    writer.write_all(&frame)?;
    writer.flush()?;
    Ok(())
}

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
}
