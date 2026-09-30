use scriptor_mobile_runtime::{EngineRuntime, MobileRuntime};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tauri::{Manager, State};

struct PendingRequest(Arc<AtomicUsize>);
impl Drop for PendingRequest {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
    }
}

#[derive(Default)]
struct RequestBudget(Arc<AtomicUsize>);

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Read {
        scope: u64,
        path: String,
    },
    Save {
        scope: u64,
        path: String,
        markdown: String,
        expected_hash: String,
    },
    Search {
        scope: u64,
        query: String,
    },
    History {
        scope: u64,
        path: String,
    },
    Revision {
        scope: u64,
        path: String,
        id: String,
    },
    Restore {
        scope: u64,
        path: String,
        id: String,
        expected_hash: String,
    },
}

/// Read/write authority is confined to the app's own vault; CAS is required for mutation.
#[tauri::command]
async fn mobile_request(
    runtime: State<'_, Arc<MobileRuntime>>,
    budget: State<'_, RequestBudget>,
    request: Request,
) -> Result<Value, String> {
    budget
        .0
        .fetch_update(Ordering::AcqRel, Ordering::Acquire, |count| {
            (count < 8).then_some(count + 1)
        })
        .map_err(|_| "mobile request queue is full; wait or cancel".to_string())?;
    let pending = PendingRequest(Arc::clone(&budget.0));
    let runtime = Arc::clone(runtime.inner());
    tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let _pending = pending;
        macro_rules! encode {
            ($result:expr) => {
                serde_json::to_value($result.map_err(|error| error.to_string())?)
                    .map_err(|error| error.to_string())
            };
        }
        match request {
            Request::Read { scope, path } => encode!(runtime.read(scope, &path)),
            Request::Save {
                scope,
                path,
                markdown,
                expected_hash,
            } => encode!(runtime.save(scope, &path, &markdown, &expected_hash)),
            Request::Search { scope, query } => encode!(runtime.search(scope, &query)),
            Request::History { scope, path } => encode!(runtime.history(scope, &path)),
            Request::Revision { scope, path, id } => encode!(runtime.revision(scope, &path, &id)),
            Request::Restore {
                scope,
                path,
                id,
                expected_hash,
            } => encode!(runtime.restore(scope, &path, &id, &expected_hash)),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Lifecycle control revokes work generations; it never grants a new storage root.
#[tauri::command]
fn mobile_lifecycle(
    runtime: State<'_, Arc<MobileRuntime>>,
    foreground: bool,
    cancel: bool,
) -> Value {
    runtime.set_foreground(foreground);
    if cancel {
        runtime.cancel();
    }
    json!({ "scope": runtime.scope(), "foreground": foreground })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("vault");
            app.manage(Arc::new(MobileRuntime::open(root)?));
            app.manage(RequestBudget::default());
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(mobile)]
            if let Some(runtime) = window.try_state::<Arc<MobileRuntime>>() {
                match event {
                    tauri::WindowEvent::Suspended => runtime.set_foreground(false),
                    tauri::WindowEvent::Resumed => runtime.set_foreground(true),
                    _ => {}
                }
            }
            #[cfg(not(mobile))]
            let _ = (window, event);
        })
        .invoke_handler(tauri::generate_handler![mobile_request, mobile_lifecycle])
        .run(tauri::generate_context!())
        .expect("mobile runtime initialization failed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_requests_reject_unknown_operations_and_fields() {
        assert!(
            serde_json::from_value::<Request>(json!({"operation":"execute","scope":1})).is_err()
        );
        assert!(
            serde_json::from_value::<Request>(
                json!({"operation":"read","scope":1,"path":"a.md","root":"C:/"})
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<Request>(
                json!({"operation":"save","scope":1,"path":"a.md","markdown":"draft"})
            )
            .is_err()
        );
    }

    #[test]
    fn dropping_a_request_releases_queue_capacity() {
        let count = Arc::new(AtomicUsize::new(1));
        {
            let _pending = PendingRequest(Arc::clone(&count));
        }
        assert_eq!(count.load(Ordering::Acquire), 0);
    }
}
