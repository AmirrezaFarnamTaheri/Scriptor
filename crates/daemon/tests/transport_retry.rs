use std::path::Path;
use std::thread;
use std::time::Duration;

use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{GenericFilePath, GenericNamespaced, ListenerOptions, Name};
use scriptor_daemon::transport::{
    connect_authenticated_client, remove_endpoint_file, write_endpoint,
};
use uuid::Uuid;

fn test_socket_name() -> (String, Option<tempfile::TempDir>) {
    let unique = Uuid::new_v4().to_string();
    if cfg!(windows) {
        (format!("scriptor-retry-test-{unique}"), None)
    } else {
        let dir = tempfile::tempdir().expect("tempdir");
        let socket = dir
            .path()
            .join(format!("ipc-{unique}.sock"))
            .display()
            .to_string();
        (socket, Some(dir))
    }
}

fn resolve_name(path: &str) -> Name<'_> {
    if cfg!(windows) {
        path.to_ns_name::<GenericNamespaced>().expect("resolve socket name")
    } else {
        Path::new(path)
            .to_fs_name::<GenericFilePath>()
            .expect("resolve socket path")
    }
}

#[test]
fn authenticated_connect_refreshes_endpoint_after_daemon_restart() {
    let _ = remove_endpoint_file();
    let (old_socket, _old_dir) = test_socket_name();
    let (new_socket, _new_dir) = test_socket_name();

    let old_endpoint = write_endpoint(&old_socket).expect("write old endpoint");
    let client = thread::spawn(connect_authenticated_client);

    // Give the client time to read the old endpoint and enter its bounded retry loop.
    thread::sleep(Duration::from_millis(75));

    let new_endpoint = write_endpoint(&new_socket).expect("write restarted endpoint");
    let name = resolve_name(&new_socket);
    let listener = ListenerOptions::new()
        .name(name.borrow())
        .create_sync()
        .expect("bind restarted daemon socket");

    let (_stream, connected_endpoint) = client
        .join()
        .expect("client thread")
        .expect("client should follow the restarted daemon endpoint");

    assert_eq!(connected_endpoint.socket_name, new_socket);
    assert_eq!(connected_endpoint.nonce, new_endpoint.nonce);
    assert_ne!(connected_endpoint.nonce, old_endpoint.nonce);

    drop(listener);
    let _ = remove_endpoint_file();
    if !cfg!(windows) {
        let _ = std::fs::remove_file(new_socket);
    }
}
