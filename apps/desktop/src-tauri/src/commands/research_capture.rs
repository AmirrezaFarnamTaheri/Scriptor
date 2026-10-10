//! Permissioned, read-only extraction and reference import previews.
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::AppState;
use serde::Serialize;
use std::io::Read;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::time::{Duration, Instant};

#[tauri::command]
pub fn reference_usage_preview(
    state: tauri::State<AppState>,
    expected_vault_id: String,
) -> Result<scriptor_indexer::bibliography::ReferenceUsageReport, String> {
    let session = crate::state::active_session(&state)?;
    crate::commands::vault::validate_expected_vault(
        &session.descriptor.id,
        Some(&expected_vault_id),
    )?;
    let cache =
        scriptor_indexer::open_cache_for_session(&session).map_err(|error| error.to_string())?;
    scriptor_indexer::bibliography::list_reference_usage(&cache).map_err(|error| error.to_string())
}

fn public_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(a == 0
                || a == 10
                || a == 127
                || a >= 224
                || (a == 100 && (64..128).contains(&b))
                || (a == 169 && b == 254)
                || (a == 172 && (16..32).contains(&b))
                || (a == 192 && (b == 168 || b == 0 || (b == 2)))
                || (a == 192 && b == 88 && c == 99)
                || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return public_address(IpAddr::V4(v4));
            }
            let segments = ip.segments();
            (segments[0] & 0xe000 == 0x2000)
                && !(segments[0] == 0x2001 && (segments[1] < 0x0200 || segments[1] == 0x0db8))
                && segments[0] != 0x2002
                && !(segments[0] == 0x3fff && segments[1] & 0xf000 == 0)
        }
    }
}
fn capture_url(value: &str) -> Result<reqwest::Url, String> {
    if value.len() > 4096 {
        return Err("Capture URL is too long".into());
    }
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid capture URL")?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
        || url.host_str().is_none()
    {
        return Err("Capture requires a public HTTPS URL without embedded credentials".into());
    }
    Ok(url)
}
fn bounded_body(
    mut response: reqwest::blocking::Response,
    limit: usize,
) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    response
        .by_ref()
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Failed reading preview response")?;
    if bytes.len() > limit {
        return Err("Preview response exceeds its size bound".into());
    }
    Ok(bytes)
}
#[derive(Serialize)]
pub struct CapturePreview {
    #[serde(flatten)]
    capture: scriptor_capture::CaptureResult,
    source_html: String,
}

fn capture_preview(html: String, url: &str) -> Result<CapturePreview, String> {
    if html.len() > 2 * 1024 * 1024 {
        return Err("Capture source exceeds its 2 MiB limit".into());
    }
    let capture = scriptor_capture::capture_html(
        &html,
        url,
        scriptor_capture::CaptureOptions {
            max_bytes: 2 * 1024 * 1024,
            timeout_secs: 20,
            include_tables: true,
            include_math: true,
        },
    )
    .map_err(|error| format!("Capture extraction failed: {error}"))?;
    if capture.markdown.len() > 2 * 1024 * 1024 {
        return Err("Extracted Markdown exceeds its 2 MiB limit".into());
    }
    let preview = CapturePreview {
        capture,
        source_html: html,
    };
    let response =
        serde_json::to_vec(&preview).map_err(|_| "Could not serialize capture preview")?;
    if response.len() > 8 * 1024 * 1024 {
        return Err("Capture response exceeds its 8 MiB limit".into());
    }
    Ok(preview)
}

fn fetch_capture(mut url: reqwest::Url) -> Result<CapturePreview, String> {
    let deadline = Instant::now() + Duration::from_secs(30);
    for _ in 0..6 {
        let host = url.host_str().ok_or("Capture host is missing")?.to_string();
        let resolve_host = host.clone();
        let addresses = bounded_resolution(
            move || {
                (resolve_host.as_str(), 443)
                    .to_socket_addrs()
                    .map(|addresses| addresses.take(17).collect())
                    .map_err(|_| "Capture host could not be resolved".to_string())
            },
            capture_remaining(deadline)?.min(Duration::from_secs(3)),
        )?;
        if addresses.is_empty()
            || addresses.len() > 16
            || addresses
                .iter()
                .any(|address| !public_address(address.ip()))
        {
            return Err("Capture host must resolve exclusively to public addresses".into());
        }
        // Pin the validated resolution; redirects are revalidated before a new client is created.
        let client = reqwest::blocking::Client::builder()
            .timeout(capture_remaining(deadline)?.min(Duration::from_secs(20)))
            .connect_timeout(capture_remaining(deadline)?.min(Duration::from_secs(8)))
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .resolve_to_addrs(&host, &addresses)
            .build()
            .map_err(|_| "Could not create capture client")?;
        let response = client
            .get(url.clone())
            .timeout(capture_remaining(deadline)?)
            .header("User-Agent", "Scriptor capture")
            .send()
            .map_err(|_| "Capture network request failed")?;
        if response.status().is_redirection() {
            let target = response
                .headers()
                .get("Location")
                .and_then(|value| value.to_str().ok())
                .ok_or("Redirect has no valid target")?;
            url = capture_url(
                url.join(target)
                    .map_err(|_| "Invalid capture redirect")?
                    .as_str(),
            )?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!("Capture server returned {}", response.status()));
        }
        let content_type = response
            .headers()
            .get("Content-Type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .trim();
        if content_type != "text/html" && content_type != "application/xhtml+xml" {
            return Err("Capture supports HTML pages; import PDF files through the reader".into());
        }
        let bytes = bounded_body(response, 2 * 1024 * 1024)?;
        let html = String::from_utf8(bytes)
            .map_err(|_| "Capture page is not UTF-8; paste its text for review")?;
        return capture_preview(html, url.as_str());
    }
    Err("Capture exceeded its redirect bound".into())
}

fn capture_remaining(deadline: Instant) -> Result<Duration, String> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|remaining| !remaining.is_zero())
        .ok_or_else(|| "Capture exceeded its 30-second network deadline".to_string())
}

static RESOLUTION_SLOTS: std::sync::LazyLock<std::sync::Arc<std::sync::atomic::AtomicUsize>> =
    std::sync::LazyLock::new(|| std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)));

struct ResolutionSlot(std::sync::Arc<std::sync::atomic::AtomicUsize>);
impl Drop for ResolutionSlot {
    fn drop(&mut self) {
        self.0.fetch_sub(1, std::sync::atomic::Ordering::AcqRel);
    }
}

fn bounded_resolution(
    resolve: impl FnOnce() -> Result<Vec<SocketAddr>, String> + Send + 'static,
    wait: Duration,
) -> Result<Vec<SocketAddr>, String> {
    bounded_resolution_with_slots(resolve, wait, std::sync::Arc::clone(&RESOLUTION_SLOTS))
}

fn bounded_resolution_with_slots(
    resolve: impl FnOnce() -> Result<Vec<SocketAddr>, String> + Send + 'static,
    wait: Duration,
    slots: std::sync::Arc<std::sync::atomic::AtomicUsize>,
) -> Result<Vec<SocketAddr>, String> {
    use std::sync::atomic::Ordering;
    if wait.is_zero() {
        return Err("Capture DNS deadline expired".into());
    }
    slots
        .fetch_update(Ordering::AcqRel, Ordering::Acquire, |active| {
            (active < 4).then_some(active + 1)
        })
        .map_err(|_| {
            "Capture DNS workers are busy; retry after existing lookups finish".to_string()
        })?;
    let slot = ResolutionSlot(slots);
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    // OS DNS calls cannot be interrupted portably. A timed-out worker retains
    // its permit until it exits, bounding even stalled lookups to four threads.
    std::thread::Builder::new()
        .name("scriptor-capture-dns".into())
        .spawn(move || {
            let _slot = slot;
            let _ = send.send(resolve());
        })
        .map_err(|_| "Could not start capture DNS worker".to_string())?;
    receive
        .recv_timeout(wait)
        .map_err(|_| "Capture DNS resolution exceeded its deadline".to_string())?
}
#[tauri::command]
pub async fn capture_extract_preview(
    state: tauri::State<'_, AppState>,
    url: String,
    authorization_token: String,
) -> Result<CapturePreview, String> {
    let parsed = capture_url(&url)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::WebClip,
        Some(&url),
        None,
    )?;
    tauri::async_runtime::spawn_blocking(move || fetch_capture(parsed))
        .await
        .map_err(|_| "Capture worker failed".to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoteroPreview {
    items: Vec<serde_json::Value>,
    next_start: Option<u32>,
}
fn fetch_zotero(key: String, start: u32) -> Result<ZoteroPreview, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not create Zotero client")?;
    let request = |url: String| {
        client
            .get(url)
            .header("Zotero-API-Key", &key)
            .header("Zotero-API-Version", "3")
            .send()
            .map_err(|_| "Zotero read request failed")
    };
    let account = request("https://api.zotero.org/keys/current".into())?;
    if !account.status().is_success() {
        return Err("Zotero rejected this read key".into());
    }
    let account: serde_json::Value = serde_json::from_slice(&bounded_body(account, 64 * 1024)?)
        .map_err(|_| "Invalid Zotero account response")?;
    let user = account
        .get("userID")
        .and_then(|value| value.as_u64())
        .filter(|value| *value > 0)
        .ok_or("Zotero did not identify a user library")?;
    let response = request(format!(
        "https://api.zotero.org/users/{user}/items?format=json&limit=100&start={start}&itemType=-attachment%20%7C%7C%20note"
    ))?;
    if !response.status().is_success() {
        return Err(format!(
            "Zotero library read failed ({})",
            response.status()
        ));
    }
    let rows: Vec<serde_json::Value> =
        serde_json::from_slice(&bounded_body(response, 2 * 1024 * 1024)?)
            .map_err(|_| "Invalid Zotero items response")?;
    if rows.len() > 100 {
        return Err("Zotero exceeded its page bound".into());
    }
    let next_start = (rows.len() == 100 && start < 10000).then_some(start + 100);
    let mut items = Vec::new();
    for row in rows {
        let data = row.get("data").ok_or("Zotero item is missing data")?;
        if !data.is_object()
            || data.get("key").and_then(|value| value.as_str()).is_none()
            || data.get("title").and_then(|value| value.as_str()).is_none()
        {
            return Err("Invalid Zotero item metadata".into());
        }
        if data
            .get("itemType")
            .and_then(|value| value.as_str())
            .is_some_and(|kind| kind == "attachment" || kind == "note")
        {
            continue;
        }
        items.push(data.clone());
    }
    Ok(ZoteroPreview { items, next_start })
}
#[tauri::command]
pub async fn zotero_import_preview(
    state: tauri::State<'_, AppState>,
    api_key: String,
    start: u32,
    authorization_token: String,
) -> Result<ZoteroPreview, String> {
    if api_key.is_empty()
        || api_key.len() > 128
        || !api_key.bytes().all(|byte| byte.is_ascii_alphanumeric())
        || start > 10000
        || !start.is_multiple_of(100)
    {
        return Err("Invalid Zotero read key or page offset".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ZoteroRead,
        Some("Zotero user library preview"),
        None,
    )?;
    tauri::async_runtime::spawn_blocking(move || fetch_zotero(api_key, start))
        .await
        .map_err(|_| "Zotero preview worker failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capture_dns_wait_respects_its_deadline() {
        let result = bounded_resolution(
            || {
                std::thread::sleep(Duration::from_millis(30));
                Ok(vec!["93.184.216.34:443".parse().unwrap()])
            },
            Duration::from_millis(1),
        );
        assert!(
            result.is_err(),
            "a stalled resolver must not hold the capture caller"
        );
        assert!(
            bounded_resolution(
                || Ok(vec!["93.184.216.34:443".parse().unwrap()]),
                Duration::from_secs(1)
            )
            .is_ok()
        );
    }
    #[test]
    fn capture_dns_worker_budget_and_expired_network_deadline_fail_closed() {
        let slots = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(4));
        assert!(
            bounded_resolution_with_slots(
                || panic!("exhausted pool must not run"),
                Duration::from_secs(1),
                slots
            )
            .unwrap_err()
            .contains("busy")
        );
        assert!(capture_remaining(Instant::now() - Duration::from_secs(1)).is_err());
        assert!(
            bounded_resolution(|| panic!("expired wait must not run"), Duration::ZERO).is_err()
        );
    }
    #[test]
    fn capture_rejects_credentials_non_https_and_custom_ports() {
        for url in [
            "http://example.org",
            "https://user:pass@example.org",
            "https://example.org:8080",
        ] {
            assert!(capture_url(url).is_err());
        }
        assert!(capture_url("https://example.org/article").is_ok());
    }
    #[test]
    fn capture_address_filter_blocks_private_mapped_and_reserved_destinations() {
        for address in [
            "127.0.0.1",
            "10.0.0.1",
            "192.168.2.4",
            "100.64.0.1",
            "169.254.169.254",
            "::1",
            "fc00::1",
            "::ffff:127.0.0.1",
            "2001:db8::1",
            "2001::1",
            "2001:2::1",
            "2002:7f00:1::1",
            "3fff::1",
            "192.88.99.1",
        ] {
            assert!(!public_address(address.parse().unwrap()), "{address}");
        }
        assert!(public_address("93.184.216.34".parse().unwrap()));
        assert!(public_address("2606:4700::1111".parse().unwrap()));
    }
}
