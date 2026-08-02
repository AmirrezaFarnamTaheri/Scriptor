use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, atomic::{AtomicU64, Ordering}};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value, json};
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::subscriber::Interest;
use tracing::{Event, Level, Metadata, Subscriber};

const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const MAX_LOG_SEGMENTS: usize = 5;

/// Installs a small structured subscriber without introducing a vendor SDK.
///
/// Logs are written as bounded JSONL to stderr and, when available, to the
/// application log directory. Calling this more than once is harmless.
pub fn init_observability(component: &'static str) -> Result<Option<PathBuf>, String> {
    let path = log_path(component);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    rotate_if_needed(&path).map_err(|error| error.to_string())?;
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map(BufWriter::new)
        .map_err(|error| error.to_string())?;

    let subscriber = JsonSubscriber {
        component,
        next_span_id: AtomicU64::new(1),
        file: Mutex::new(file),
        minimum_level: configured_level(),
    };

    match tracing::subscriber::set_global_default(subscriber) {
        Ok(()) => Ok(Some(path)),
        Err(_) => Ok(None),
    }
}

fn log_path(component: &str) -> PathBuf {
    if let Some(root) = std::env::var_os("SCRIPTOR_LOG_DIR") {
        return PathBuf::from(root).join(format!("{component}.jsonl"));
    }
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    home.join(".scriptor").join("logs").join(format!("{component}.jsonl"))
}

fn configured_level() -> Level {
    match std::env::var("SCRIPTOR_LOG_LEVEL")
        .unwrap_or_else(|_| "info".into())
        .to_ascii_lowercase()
        .as_str()
    {
        "trace" => Level::TRACE,
        "debug" => Level::DEBUG,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    }
}

fn level_rank(level: &Level) -> u8 {
    match *level {
        Level::ERROR => 1,
        Level::WARN => 2,
        Level::INFO => 3,
        Level::DEBUG => 4,
        Level::TRACE => 5,
    }
}

fn rotate_if_needed(path: &Path) -> std::io::Result<()> {
    if fs::metadata(path).map(|meta| meta.len()).unwrap_or(0) < MAX_LOG_BYTES {
        return Ok(());
    }
    for index in (1..MAX_LOG_SEGMENTS).rev() {
        let source = path.with_extension(format!("jsonl.{index}"));
        let target = path.with_extension(format!("jsonl.{}", index + 1));
        if source.exists() {
            let _ = fs::rename(source, target);
        }
    }
    if path.exists() {
        fs::rename(path, path.with_extension("jsonl.1"))?;
    }
    Ok(())
}

struct JsonSubscriber {
    component: &'static str,
    next_span_id: AtomicU64,
    file: Mutex<BufWriter<File>>,
    minimum_level: Level,
}

impl Subscriber for JsonSubscriber {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        level_rank(metadata.level()) <= level_rank(&self.minimum_level)
    }

    fn new_span(&self, _span: &Attributes<'_>) -> Id {
        Id::from_u64(self.next_span_id.fetch_add(1, Ordering::Relaxed).max(1))
    }

    fn record(&self, _span: &Id, _values: &Record<'_>) {}

    fn record_follows_from(&self, _span: &Id, _follows: &Id) {}

    fn event(&self, event: &Event<'_>) {
        let metadata = event.metadata();
        if !self.enabled(metadata) {
            return;
        }

        let mut visitor = JsonVisitor::default();
        event.record(&mut visitor);
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let mut record = json!({
            "timestamp_ms": timestamp_ms,
            "component": self.component,
            "level": metadata.level().as_str(),
            "target": metadata.target(),
            "event": metadata.name(),
            "thread": format!("{:?}", std::thread::current().id()),
            "fields": visitor.fields,
        });
        redact_sensitive_fields(&mut record);

        let Ok(mut encoded) = serde_json::to_vec(&record) else {
            return;
        };
        encoded.push(b'\n');
        let _ = std::io::stderr().write_all(&encoded);
        if let Ok(mut file) = self.file.lock() {
            let _ = file.write_all(&encoded);
            let _ = file.flush();
        }
    }

    fn enter(&self, _span: &Id) {}

    fn exit(&self, _span: &Id) {}

    fn register_callsite(&self, metadata: &'static Metadata<'static>) -> Interest {
        if self.enabled(metadata) {
            Interest::always()
        } else {
            Interest::never()
        }
    }

    fn max_level_hint(&self) -> Option<tracing::metadata::LevelFilter> {
        Some(self.minimum_level.into())
    }
}

#[derive(Default)]
struct JsonVisitor {
    fields: BTreeMap<String, Value>,
}

impl Visit for JsonVisitor {
    fn record_i64(&mut self, field: &Field, value: i64) {
        self.fields.insert(field.name().into(), value.into());
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.fields.insert(field.name().into(), value.into());
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        self.fields.insert(field.name().into(), value.into());
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        self.fields.insert(field.name().into(), value.into());
    }

    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        self.fields
            .insert(field.name().into(), format!("{value:?}").into());
    }
}

fn redact_sensitive_fields(value: &mut Value) {
    let sensitive = ["password", "secret", "token", "authorization", "api_key", "content"];
    let Some(fields) = value.get_mut("fields").and_then(Value::as_object_mut) else {
        return;
    };
    for (key, field_value) in fields.iter_mut() {
        if sensitive.iter().any(|needle| key.to_ascii_lowercase().contains(needle)) {
            *field_value = Value::String("[REDACTED]".into());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sensitive_fields_are_redacted() {
        let mut value = json!({"fields": {"api_key": "abc", "note_path": "notes/a.md"}});
        redact_sensitive_fields(&mut value);
        assert_eq!(value["fields"]["api_key"], "[REDACTED]");
        assert_eq!(value["fields"]["note_path"], "notes/a.md");
    }

    #[test]
    fn rotation_keeps_a_bounded_number_of_segments() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("test.jsonl");
        std::fs::write(&path, vec![b'x'; MAX_LOG_BYTES as usize]).expect("seed log");
        rotate_if_needed(&path).expect("rotate");
        assert!(!path.exists());
        assert!(path.with_extension("jsonl.1").exists());
    }
}
