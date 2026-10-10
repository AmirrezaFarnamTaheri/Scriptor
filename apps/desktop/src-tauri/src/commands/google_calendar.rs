//! Google Calendar (API v3) and Google Tasks (API v1) integration.
//!
//! Authentication uses the OAuth2 PKCE loopback flow (no client secret stored
//! on device): a `TcpListener` binds an ephemeral loopback port, the system
//! browser is opened at Google's consent screen, and the redirect carrying the
//! `?code=` is captured locally and exchanged for tokens. Tokens are persisted
//! in the OS keychain via the system bridge and refreshed transparently before
//! each API call. All mutating/auth commands are gated through the
//! authorization broker.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use scriptor_system_bridge::{keychain_delete, keychain_get, keychain_set};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{ActiveSession, AppState, active_session};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Keychain account under which the token bundle JSON is stored.
const CALENDAR_TOKEN_KEYCHAIN_ACCOUNT: &str = "google.calendar.tokens";
const GMAIL_TOKEN_KEYCHAIN_ACCOUNT: &str = "google.gmail.tokens";
const DRIVE_TOKEN_KEYCHAIN_ACCOUNT: &str = "google.drive.collaboration.tokens";
/// Broker scope shared by all task mutations.
const TASK_SCOPE: &str = "google-task";
/// Broker scope for the auth flow.
const AUTH_SCOPE: &str = "google-calendar-auth";
/// Broker scope for the Gmail Manager OAuth grant.
const GMAIL_AUTH_SCOPE: &str = "google-gmail-auth";
const GOOGLE_AUTH_REQUIRED_PREFIX: &str = "GOOGLE_AUTH_REQUIRED:";

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_EVENTS_ENDPOINT: &str = "https://www.googleapis.com/calendar/v3/calendars";
const CALENDAR_LIST_ENDPOINT: &str = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const TASK_LISTS_ENDPOINT: &str = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
const TASKS_ENDPOINT: &str = "https://tasks.googleapis.com/tasks/v1/lists";
const GMAIL_MESSAGES_ENDPOINT: &str = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
/// Gmail batch endpoint: one multipart request carries up to
/// `GMAIL_BATCH_MAX_CALLS` inner GETs (Google recommends staying at or
/// below 50 parts per batch to avoid rate limiting). Gmail's discovery
/// document declares `batch/gmail/v1` as the batch path.
const GMAIL_BATCH_ENDPOINT: &str = "https://gmail.googleapis.com/batch/gmail/v1";
const GMAIL_BATCH_MAX_CALLS: usize = 50;
const GMAIL_SEND_ENDPOINT: &str = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_MAX_BODY_BYTES: usize = 5 * 1024 * 1024;
const GOOGLE_CALENDAR_EVENT_PAGE_SIZE: &str = "250";
const GOOGLE_CALENDAR_EVENT_MAX_PAGES: usize = 40;
const GOOGLE_TASK_PAGE_SIZE: &str = "100";
const GOOGLE_TASK_SYNC_MAX_MUTATIONS: usize = 1000;
/// Bound provider pagination so a pathological/looping response cannot turn a
/// refresh into unbounded network work. Crossing the bound fails closed: the
/// frontend will not treat a partial remote task list as authoritative.
const GOOGLE_TASK_MAX_PAGES: usize = 100;
const GOOGLE_RESOURCE_MAX_PAGES: usize = 10;
const GOOGLE_RESOURCE_MAX_ITEMS: usize = 1000;
const GOOGLE_PROVIDER_PAGE_MAX_BYTES: u64 = 2 * 1024 * 1024;

/// `openid`/`email` are appended so the authed email can be resolved.
const OAUTH_SCOPES: &str = "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/tasks";
/// Gmail scopes are requested only from the dedicated Gmail manager flow.
const GMAIL_OAUTH_SCOPES: &str = "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send";

const HTTP_TIMEOUT_SECS: u64 = 30;
/// Serializes token refreshes process-wide: two concurrent commands hitting
/// an expired token would otherwise both POST a refresh and race the
/// keychain write (last-write-wins is benign, but Google may also hand out
/// a new refresh token to the loser, invalidating the stored one).
static TOKEN_REFRESH_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
static GOOGLE_ACCOUNT_GENERATIONS: std::sync::Mutex<Vec<(String, u64)>> =
    std::sync::Mutex::new(Vec::new());
/// How long to wait for the browser redirect before giving up.
const AUTH_CAPTURE_TIMEOUT_SECS: u64 = 300;
/// Refresh the access token this many seconds before its stated expiry.
const EXPIRY_SKEW_SECS: u64 = 60;

fn require_gmail_capability<'a>(
    state: &'a tauri::State<'a, AppState>,
) -> Result<ActiveSession<'a>, String> {
    let session = active_session(state)?;
    let plugin_state = scriptor_vault::load_plugin_state(session.root.root())
        .map_err(|error| error.to_string())?;
    if plugin_state.is_explicitly_enabled("scriptor.gmail-manager") {
        Ok(session)
    } else {
        Err("Plugin capability 'scriptor.gmail-manager' is disabled in active vault".into())
    }
}

// ---------------------------------------------------------------------------
// Frontend-facing shapes (must match useGoogleCalendarSync.ts)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventReminder {
    method: String,
    minutes_before: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    id: String,
    etag: Option<String>,
    summary: String,
    description: Option<String>,
    start: String,
    end: String,
    all_day: bool,
    location: Option<String>,
    meeting_link: Option<String>,
    calendar_id: String,
    status: String,
    attendees: Vec<String>,
    reminders: Vec<EventReminder>,
    linked_note_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleTask {
    id: String,
    etag: Option<String>,
    title: String,
    notes: Option<String>,
    status: String,
    due: Option<String>,
    completed: Option<String>,
    subtasks: Vec<GoogleTask>,
    from_vault: bool,
    source_path: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GoogleCalendarAccessRole {
    Owner,
    Writer,
    Reader,
    FreeBusyReader,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarResource {
    id: String,
    summary: String,
    access_role: GoogleCalendarAccessRole,
    #[serde(default)]
    primary: bool,
    #[serde(default)]
    writable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTaskListResource {
    id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleResourcePage<T> {
    items: Option<Vec<T>>,
    next_page_token: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailMessagePage {
    messages: Vec<GmailMessagePreview>,
    next_page_token: Option<String>,
}

/// Gmail message metadata returned to the manager's message list.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailMessagePreview {
    id: String,
    thread_id: String,
    subject: String,
    from: String,
    date: String,
    snippet: String,
}

/// Gmail message content returned to the manager and its Markdown import flow.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailMessageContent {
    id: String,
    thread_id: String,
    subject: String,
    from: String,
    date: String,
    snippet: String,
    plain_text: String,
}

// ---------------------------------------------------------------------------
// Persisted token bundle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredTokens {
    client_id: String,
    access_token: String,
    refresh_token: Option<String>,
    /// Unix epoch milliseconds at which the access token expires.
    expiry_ms: u64,
    email: String,
}

/// Poison-recovering lock acquisition for the process-wide refresh mutex.
fn lock_refresh_guard() -> std::sync::MutexGuard<'static, ()> {
    match TOKEN_REFRESH_LOCK.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!(
                lock = "google token refresh",
                "recovering poisoned refresh lock"
            );
            TOKEN_REFRESH_LOCK.clear_poison();
            poisoned.into_inner()
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn load_tokens(keychain_account: &str) -> Result<Option<StoredTokens>, String> {
    let raw = keychain_get(keychain_account).map_err(|error| error.to_string())?;
    match raw.filter(|value| !value.is_empty()) {
        Some(json) => parse_stored_tokens(&json).map(Some),
        None => Ok(None),
    }
}

fn validate_google_client_id(client_id: &str) -> Result<(), String> {
    if client_id.is_empty()
        || client_id.len() > 512
        || !client_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err("Invalid Google OAuth client ID".into());
    }
    Ok(())
}

fn validate_google_email(email: &str) -> Result<(), String> {
    if email.is_empty()
        || email.len() > 320
        || !email.contains('@')
        || email
            .chars()
            .any(|value| value.is_control() || value.is_whitespace())
    {
        return Err("Google returned an invalid account email".into());
    }
    Ok(())
}

fn parse_stored_tokens(json: &str) -> Result<StoredTokens, String> {
    if json.len() > 16 * 1024 {
        return Err(google_auth_required(
            "Stored Google credentials exceed the size limit. Reconnect.",
        ));
    }
    let tokens: StoredTokens = serde_json::from_str(json)
        .map_err(|_| google_auth_required("Stored Google credentials are invalid. Reconnect."))?;
    validate_google_client_id(&tokens.client_id)
        .map_err(|_| google_auth_required("Stored Google client ID is invalid. Reconnect."))?;
    validate_google_email(&tokens.email).map_err(|_| {
        google_auth_required("Stored Google account identity is invalid. Reconnect.")
    })?;
    for token in std::iter::once(&tokens.access_token).chain(tokens.refresh_token.iter()) {
        if token.is_empty() || token.len() > 4096 || token.chars().any(char::is_control) {
            return Err(google_auth_required(
                "Stored Google token values are invalid. Reconnect.",
            ));
        }
    }
    if tokens.expiry_ms == 0 {
        return Err(google_auth_required(
            "Stored Google token lifetime is invalid. Reconnect.",
        ));
    }
    Ok(tokens)
}

/// Reads only the validated public account identity from the native keychain.
pub(super) fn stored_google_email(account: &str) -> Result<Option<String>, String> {
    load_tokens(account).map(|tokens| tokens.map(|tokens| tokens.email))
}

/// Bind sensitive Google writes to the account and credential lifecycle that
/// was present when the user reviewed the native authorization prompt.
pub(crate) fn authorization_account_binding(
    operation: SensitiveOperation,
) -> Result<Option<String>, String> {
    let keychain_account = match operation {
        SensitiveOperation::GoogleCalendarWrite | SensitiveOperation::GoogleTaskWrite => {
            CALENDAR_TOKEN_KEYCHAIN_ACCOUNT
        }
        SensitiveOperation::GoogleGmailWrite | SensitiveOperation::GoogleGmailSend => {
            GMAIL_TOKEN_KEYCHAIN_ACCOUNT
        }
        SensitiveOperation::GoogleDriveWrite => DRIVE_TOKEN_KEYCHAIN_ACCOUNT,
        _ => return Ok(None),
    };
    let tokens = require_tokens(keychain_account)?;
    let generation = google_account_generation(keychain_account, false)?;
    Ok(Some(format!("{keychain_account}:{}:{generation}", tokens.email)))
}

fn google_account_generation(account: &str, advance: bool) -> Result<u64, String> {
    let mut generations = GOOGLE_ACCOUNT_GENERATIONS
        .lock()
        .map_err(|_| "Google account lifecycle lock is unavailable".to_string())?;
    let index = match generations.iter().position(|(stored, _)| stored == account) {
        Some(index) => index,
        None => {
            if generations.len() >= 8 {
                return Err("Google account lifecycle bound exceeded".into());
            }
            generations.push((account.to_owned(), 0));
            generations.len() - 1
        }
    };
    if advance {
        generations[index].1 = generations[index]
            .1
            .checked_add(1)
            .ok_or("Google account lifecycle counter exhausted")?;
    }
    Ok(generations[index].1)
}

/// Clears one credential bundle and invalidates pending auth/refresh writes.
/// Call only after the service-specific disconnect authorization is consumed.
pub(super) fn disconnect_google_account(account: &str) -> Result<(), String> {
    let _guard = lock_refresh_guard();
    google_account_generation(account, true)?;
    // Google grant revocation may revoke other services sharing this client.
    // Unlink only this service locally; grant revocation is a separate action.
    keychain_delete(account).map_err(|error| error.to_string())
}

fn save_tokens(keychain_account: &str, tokens: &StoredTokens) -> Result<(), String> {
    let json = serde_json::to_string(tokens)
        .map_err(|error| format!("failed to serialize Google tokens: {error}"))?;
    keychain_set(keychain_account, &json).map_err(|error| error.to_string())
}

fn google_auth_required(message: impl AsRef<str>) -> String {
    format!("{GOOGLE_AUTH_REQUIRED_PREFIX} {}", message.as_ref())
}

fn require_tokens(keychain_account: &str) -> Result<StoredTokens, String> {
    load_tokens(keychain_account)?
        .ok_or_else(|| google_auth_required("Google account is not connected."))
}

// ---------------------------------------------------------------------------
// PKCE + small encoding helpers
// ---------------------------------------------------------------------------

/// URL-safe base64 without padding (RFC 4648 §5), used for the PKCE challenge.
fn base64url_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(ALPHABET[((n >> 18) & 0x3f) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[((n >> 6) & 0x3f) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(n & 0x3f) as usize] as char);
        }
    }
    out
}

/// Percent-encode a value for use in a query string (conservative allow-list).
fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// A high-entropy PKCE verifier built from concatenated UUIDs (hex chars are
/// all within the allowed `[A-Za-z0-9-._~]` verifier set).
fn generate_code_verifier() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn code_challenge_for(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(verifier.as_bytes());
    base64url_encode(&digest)
}

/// Open a URL in the user's default browser using the platform opener.
fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        // Do not route the OAuth URL through cmd.exe: authorization URLs contain
        // '&' separators, which are shell metacharacters and can truncate the
        // command or execute unintended fragments. rundll32 receives the URL as
        // a direct argv value and delegates it to the registered protocol handler.
        // PROCESS_BROKER_EXCEPTION(oauth-browser-open-windows): fixed OS URL handler, URL-only argument.
        let mut c = std::process::Command::new("rundll32.exe");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        // PROCESS_BROKER_EXCEPTION(oauth-browser-open-macos): fixed OS opener, URL-only argument.
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        // PROCESS_BROKER_EXCEPTION(oauth-browser-open-unix): fixed OS opener, URL-only argument.
        let mut c = std::process::Command::new("xdg-open");
        c.arg(url);
        c
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to open the system browser: {error}"))
}

// ---------------------------------------------------------------------------
// Loopback redirect capture
// ---------------------------------------------------------------------------

#[derive(Debug, Default, PartialEq, Eq)]
struct OAuthRedirectQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

/// Parse the OAuth redirect query from an HTTP request line. Google returns
/// `error`/`error_description` when consent is denied; treating that redirect
/// as a favicon/probe would otherwise leave the app waiting for five minutes.
fn parse_redirect_query(request_line: &str) -> OAuthRedirectQuery {
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
    let mut parsed = OAuthRedirectQuery::default();
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        let decoded = percent_decode(value);
        match key {
            "code" => parsed.code = Some(decoded),
            "state" => parsed.state = Some(decoded),
            "error" => parsed.error = Some(decoded),
            "error_description" => parsed.error_description = Some(decoded),
            _ => {}
        }
    }
    parsed
}

fn hex_nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let (Some(high), Some(low)) = (hex_nibble(bytes[i + 1]), hex_nibble(bytes[i + 2]))
        {
            out.push((high << 4) | low);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Block on the loopback listener until the redirect arrives, returning the
/// captured authorization `code`. Verifies the `state` echo before declaring
/// success. The deadline is enforced on `accept()` itself via non-blocking
/// polling, so an abandoned consent (tab closed, no redirect) times out and
/// releases the worker thread and bound port instead of blocking forever.
fn capture_authorization_code(
    listener: &TcpListener,
    expected_state: &str,
) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let deadline = SystemTime::now() + Duration::from_secs(AUTH_CAPTURE_TIMEOUT_SECS);

    loop {
        if SystemTime::now() >= deadline {
            return Err("timed out waiting for Google authorization".into());
        }
        let (mut stream, _addr) = match listener.accept() {
            Ok(accepted) => accepted,
            Err(ref error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
            Err(error) => return Err(error.to_string()),
        };
        // The accepted stream inherits non-blocking mode; restore blocking so
        // the short-lived read/write below behaves synchronously.
        stream.set_nonblocking(false).ok();
        stream.set_read_timeout(Some(Duration::from_secs(10))).ok();

        let mut buffer = [0u8; 4096];
        let read = stream.read(&mut buffer).unwrap_or(0);
        if read == 0 {
            continue;
        }
        let request = String::from_utf8_lossy(&buffer[..read]);
        let request_line = request.lines().next().unwrap_or("");
        let redirect = parse_redirect_query(request_line);

        // Validate the state echo before composing the response so a bad
        // `state` yields an error page rather than the success page.
        let state_ok = redirect.state.as_deref() == Some(expected_state);
        let has_code = redirect
            .code
            .as_deref()
            .map(|value| !value.is_empty())
            .unwrap_or(false);
        let has_oauth_error = redirect
            .error
            .as_deref()
            .map(|value| !value.is_empty())
            .unwrap_or(false);

        // A request that carries no OAuth fields is not part of the redirect
        // (favicon probes, prefetches, or a plain reload of the loopback URL).
        if redirect.state.is_none() && !has_code && !has_oauth_error {
            let probe_response = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(probe_response.as_bytes());
            let _ = stream.flush();
            continue;
        }

        let body = if state_ok && has_code && !has_oauth_error {
            "<html><body style=\"font-family:sans-serif;padding:2rem\"><h2>Scriptor is now connected to Google.</h2><p>You can close this tab and return to the app.</p></body></html>"
        } else {
            "<html><body style=\"font-family:sans-serif;padding:2rem\"><h2>Authorization could not be completed.</h2><p>You can close this tab and return to Scriptor for details.</p></body></html>"
        };
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        let _ = stream.flush();

        if !state_ok {
            return Err("Google authorization state mismatch (possible CSRF)".into());
        }
        if let Some(error) = redirect.error.filter(|value| !value.is_empty()) {
            let detail = redirect
                .error_description
                .filter(|value| !value.is_empty())
                .map(|value| value.chars().take(240).collect::<String>());
            return Err(match detail {
                Some(detail) => format!("Google authorization failed: {error} — {detail}"),
                None => format!("Google authorization failed: {error}"),
            });
        }
        if has_code {
            return Ok(redirect.code.unwrap_or_default());
        }
    }
}

// ---------------------------------------------------------------------------
// Token exchange + refresh
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct UserInfoResponse {
    email: Option<String>,
}

pub(super) fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("failed to initialize Google HTTP client: {error}"))
}

fn provider_failure(status: reqwest::StatusCode, operation: &str) -> String {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        google_auth_required("Google authorization expired. Reconnect the account.")
    } else if status == reqwest::StatusCode::FORBIDDEN {
        format!(
            "{operation} was denied. Check resource access and reconnect to grant the required service scope."
        )
    } else {
        format!("{operation} failed ({status}). Try again later.")
    }
}

fn read_provider_json<T: serde::de::DeserializeOwned>(
    reader: impl Read,
    operation: &str,
) -> Result<T, String> {
    read_provider_json_bounded(reader, operation, GOOGLE_PROVIDER_PAGE_MAX_BYTES)
}

fn read_provider_json_bounded<T: serde::de::DeserializeOwned>(
    reader: impl Read,
    operation: &str,
    limit: u64,
) -> Result<T, String> {
    let mut bytes = Vec::new();
    reader
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| format!("Could not read {operation} response"))?;
    if bytes.len() as u64 > limit {
        return Err(format!(
            "{operation} response exceeds the supported size limit"
        ));
    }
    serde_json::from_slice(&bytes).map_err(|_| format!("Invalid {operation} response"))
}

fn refresh_failure(status: reqwest::StatusCode, body: &[u8]) -> String {
    let permanent = serde_json::from_slice::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.as_str())
                .map(str::to_owned)
        })
        .is_some_and(|error| matches!(error.as_str(), "invalid_grant" | "invalid_client"));
    if permanent
        && matches!(
            status,
            reqwest::StatusCode::BAD_REQUEST | reqwest::StatusCode::UNAUTHORIZED
        )
    {
        google_auth_required("Google session can no longer be refreshed. Reconnect the account.")
    } else {
        format!("Google token refresh failed ({status}). Try again later.")
    }
}

fn read_token_body(reader: impl Read) -> Result<Vec<u8>, String> {
    const MAX_TOKEN_RESPONSE_BYTES: u64 = 16 * 1024;
    let mut bytes = Vec::new();
    reader
        .take(MAX_TOKEN_RESPONSE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read Google token response.".to_string())?;
    if bytes.len() as u64 > MAX_TOKEN_RESPONSE_BYTES {
        return Err("Google token response exceeds the size limit.".to_string());
    }
    Ok(bytes)
}

fn token_expiry_ms(issued_at_ms: u64, expires_in: Option<u64>) -> Result<u64, String> {
    expires_in
        .unwrap_or(3600)
        .checked_mul(1000)
        .filter(|lifetime| *lifetime > 0)
        .and_then(|lifetime| issued_at_ms.checked_add(lifetime))
        .ok_or_else(|| "Google returned an invalid token lifetime.".to_string())
}

fn parse_token_body(body: &[u8]) -> Result<TokenResponse, String> {
    let tokens: TokenResponse = serde_json::from_slice(body)
        .map_err(|_| "Google returned an invalid token response.".to_string())?;
    for token in std::iter::once(&tokens.access_token).chain(tokens.refresh_token.iter()) {
        if token.is_empty() || token.len() > 4096 || token.chars().any(char::is_control) {
            return Err("Google returned an invalid token value.".to_string());
        }
    }
    token_expiry_ms(now_ms(), tokens.expires_in)?;
    Ok(tokens)
}

fn exchange_code_for_tokens(
    client: &reqwest::blocking::Client,
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<TokenResponse, String> {
    let response = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("client_id", client_id),
            ("code", code),
            ("code_verifier", verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ])
        .send()
        .map_err(|error| format!("Google token exchange failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "Google token exchange failed ({status}). Check the account configuration and try again."
        ));
    }
    parse_token_body(&read_token_body(response)?)
}

fn fetch_email(client: &reqwest::blocking::Client, access_token: &str) -> Result<String, String> {
    let response = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(access_token)
        .send()
        .map_err(|error| format!("failed to fetch Google account email: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to fetch Google account email",
        ));
    }
    let info: UserInfoResponse = read_provider_json(response, "Google account identity")?;
    let email = info
        .email
        .ok_or("Google account response did not include an email")?;
    validate_google_email(&email)?;
    Ok(email)
}

pub(super) fn refresh_if_needed(
    client: &reqwest::blocking::Client,
    keychain_account: &str,
) -> Result<String, String> {
    let tokens = require_tokens(keychain_account)?;
    if now_ms() + EXPIRY_SKEW_SECS * 1000 < tokens.expiry_ms {
        return Ok(tokens.access_token);
    }
    let _refresh_guard = lock_refresh_guard();
    let mut tokens = require_tokens(keychain_account)?;
    if now_ms() + EXPIRY_SKEW_SECS * 1000 < tokens.expiry_ms {
        return Ok(tokens.access_token);
    }
    let refresh_token = tokens
        .refresh_token
        .clone()
        .ok_or_else(|| google_auth_required("Google session expired. Reconnect the account."))?;

    let response = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("client_id", tokens.client_id.as_str()),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(|error| format!("Google token refresh failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = read_token_body(response)?;
        return Err(refresh_failure(status, &body));
    }
    let refreshed = parse_token_body(&read_token_body(response)?)?;

    tokens.access_token = refreshed.access_token.clone();
    tokens.expiry_ms = token_expiry_ms(now_ms(), refreshed.expires_in)?;
    if let Some(new_refresh) = refreshed.refresh_token {
        tokens.refresh_token = Some(new_refresh);
    }
    save_tokens(keychain_account, &tokens)?;
    Ok(refreshed.access_token)
}

// ---------------------------------------------------------------------------
// Google API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct EventDateTime {
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GcalAttendee {
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GcalReminderOverride {
    method: Option<String>,
    minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct GcalReminders {
    overrides: Option<Vec<GcalReminderOverride>>,
}

#[derive(Debug, Deserialize)]
struct GcalEvent {
    id: Option<String>,
    etag: Option<String>,
    summary: Option<String>,
    description: Option<String>,
    location: Option<String>,
    #[serde(rename = "hangoutLink")]
    hangout_link: Option<String>,
    status: Option<String>,
    start: Option<EventDateTime>,
    end: Option<EventDateTime>,
    attendees: Option<Vec<GcalAttendee>>,
    reminders: Option<GcalReminders>,
}

#[derive(Debug, Deserialize)]
struct GcalEventList {
    items: Option<Vec<GcalEvent>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GTask {
    id: Option<String>,
    etag: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    status: Option<String>,
    due: Option<String>,
    completed: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GTaskList {
    items: Option<Vec<GTask>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GmailMessageRef {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GmailMessageList {
    messages: Option<Vec<GmailMessageRef>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GmailHeader {
    name: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GmailBody {
    data: Option<String>,
    #[serde(rename = "attachmentId")]
    attachment_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GmailPayload {
    headers: Option<Vec<GmailHeader>>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    body: Option<GmailBody>,
    parts: Option<Vec<GmailPayload>>,
}

#[derive(Debug, Deserialize)]
struct GmailMessage {
    id: Option<String>,
    #[serde(rename = "threadId")]
    thread_id: Option<String>,
    snippet: Option<String>,
    payload: Option<GmailPayload>,
}

#[derive(Debug, Deserialize)]
struct GmailAttachmentResponse {
    data: Option<String>,
}

#[derive(Debug, Serialize)]
struct GmailModifyRequest {
    #[serde(rename = "addLabelIds", skip_serializing_if = "Vec::is_empty")]
    add_label_ids: Vec<String>,
    #[serde(rename = "removeLabelIds", skip_serializing_if = "Vec::is_empty")]
    remove_label_ids: Vec<String>,
}

fn map_event(event: GcalEvent, calendar_id: &str) -> CalendarEvent {
    let (start, all_day_start) = resolve_datetime(event.start);
    let (end, _all_day_end) = resolve_datetime(event.end);
    let reminders = event
        .reminders
        .and_then(|r| r.overrides)
        .map(|overrides| {
            overrides
                .into_iter()
                .map(|o| EventReminder {
                    method: o.method.unwrap_or_else(|| "popup".into()),
                    minutes_before: o.minutes.unwrap_or(0),
                })
                .collect()
        })
        .unwrap_or_default();
    let attendees = event
        .attendees
        .map(|list| list.into_iter().filter_map(|a| a.email).collect())
        .unwrap_or_default();

    CalendarEvent {
        id: event.id.unwrap_or_default(),
        etag: event.etag,
        summary: event.summary.unwrap_or_default(),
        description: event.description,
        start,
        end,
        all_day: all_day_start,
        location: event.location,
        meeting_link: event.hangout_link,
        calendar_id: calendar_id.to_string(),
        status: event.status.unwrap_or_else(|| "confirmed".into()),
        attendees,
        reminders,
        linked_note_path: None,
    }
}

fn resolve_datetime(value: Option<EventDateTime>) -> (String, bool) {
    match value {
        Some(EventDateTime {
            date_time: Some(dt),
            ..
        }) => (dt, false),
        Some(EventDateTime {
            date: Some(date), ..
        }) => (date, true),
        _ => (String::new(), false),
    }
}

fn map_task(task: GTask) -> GoogleTask {
    GoogleTask {
        id: task.id.unwrap_or_default(),
        etag: task.etag,
        title: task.title.unwrap_or_default(),
        notes: task.notes,
        status: task.status.unwrap_or_else(|| "needsAction".into()),
        due: task.due,
        completed: task.completed,
        subtasks: Vec::new(),
        from_vault: false,
        source_path: None,
    }
}

fn validate_google_task_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 1024
        || id.chars().any(|ch| ch.is_control() || ch.is_whitespace())
    {
        return Err("Invalid Google Task identity".into());
    }
    Ok(())
}

fn validate_task_fields(
    title: &str,
    notes: Option<&str>,
    due: Option<&str>,
    status: Option<&str>,
) -> Result<(), String> {
    if title.trim().is_empty()
        || title.len() > 4096
        || title.chars().count() > 1024
        || title.chars().any(char::is_control)
    {
        return Err("Task title must be one bounded nonempty line".into());
    }
    if notes.is_some_and(|notes| {
        notes.len() > 32 * 1024 || notes.chars().count() > 8192 || notes.contains('\0')
    }) {
        return Err("Task notes exceed the supported text bound".into());
    }
    if let Some(due) = due {
        chrono::DateTime::parse_from_rfc3339(due).map_err(|_| "Task due must be RFC3339")?;
    }
    if status.is_some_and(|status| !matches!(status, "needsAction" | "completed")) {
        return Err("Task status must be needsAction or completed".into());
    }
    Ok(())
}

fn validate_provider_task(task: GTask) -> Result<GTask, String> {
    validate_google_task_id(
        task.id
            .as_deref()
            .ok_or("Google returned a task without an ID")?,
    )?;
    let title = task
        .title
        .as_deref()
        .ok_or("Google returned a task without a title")?;
    let status = task
        .status
        .as_deref()
        .ok_or("Google returned a task without a status")?;
    validate_task_fields(
        title,
        task.notes.as_deref(),
        task.due.as_deref(),
        Some(status),
    )?;
    Ok(task)
}

fn validate_task_etag(etag: &str) -> Result<(), String> {
    if etag.is_empty() || etag.len() > 512 || etag.chars().any(char::is_control) {
        return Err("Google Task revision missing or invalid. Refresh tasks before writing.".into());
    }
    Ok(())
}

fn validate_task_sync_mutation(mutation: &GoogleTaskSyncMutation) -> Result<(), String> {
    match mutation.kind.as_str() {
        "create" => validate_task_fields(
            mutation.title.as_deref().unwrap_or_default(),
            mutation.notes.as_deref(),
            mutation.due.as_deref(),
            None,
        ),
        "update" => {
            validate_google_task_id(mutation.task_id.as_deref().unwrap_or_default())?;
            validate_task_etag(mutation.etag.as_deref().unwrap_or_default())?;
            validate_task_fields(
                mutation.title.as_deref().unwrap_or_default(),
                mutation.notes.as_deref(),
                mutation.due.as_deref(),
                mutation.status.as_deref(),
            )
        }
        "complete" => {
            validate_google_task_id(mutation.task_id.as_deref().unwrap_or_default())?;
            validate_task_etag(mutation.etag.as_deref().unwrap_or_default())
        },
        _ => Err("Unsupported Google Task sync mutation kind".into()),
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

pub(super) fn start_google_auth(
    client_id: String,
    scopes: &str,
    keychain_account: &str,
) -> Result<String, String> {
    let client_id = client_id.trim().to_owned();
    validate_google_client_id(&client_id)?;
    let generation = {
        let _guard = lock_refresh_guard();
        google_account_generation(keychain_account, true)?
    };

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("failed to bind loopback listener: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let verifier = generate_code_verifier();
    let challenge = code_challenge_for(&verifier);
    let csrf_state = uuid::Uuid::new_v4().to_string();
    let auth_url = format!(
        "{AUTH_ENDPOINT}?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=offline&prompt=consent",
        percent_encode(&client_id),
        percent_encode(&redirect_uri),
        percent_encode(scopes),
        percent_encode(&challenge),
        percent_encode(&csrf_state),
    );
    open_in_browser(&auth_url)?;
    let code = capture_authorization_code(&listener, &csrf_state)?;
    let client = http_client()?;
    let token = exchange_code_for_tokens(&client, &client_id, &code, &verifier, &redirect_uri)?;
    let email = fetch_email(&client, &token.access_token)?;
    let tokens = StoredTokens {
        client_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_ms: token_expiry_ms(now_ms(), token.expires_in)?,
        email: email.clone(),
    };
    let _guard = lock_refresh_guard();
    if google_account_generation(keychain_account, false)? != generation {
        return Err("Google connection was superseded or disconnected. Connect again.".into());
    }
    save_tokens(keychain_account, &tokens)?;
    Ok(email)
}

/// Hash length-prefixed UTF-8 fields so authorization covers exact content.
fn google_write_digest(parts: &[&str]) -> String {
    let mut hash = Sha256::new();
    for value in parts {
        hash.update(value.len().to_string().as_bytes());
        hash.update(b":");
        hash.update(value.as_bytes());
    }
    hex::encode(hash.finalize())
}
fn gmail_modify_scope(id: &str, add: &[String], remove: &[String]) -> String {
    let a = add.len().to_string();
    let r = remove.len().to_string();
    let mut parts = vec![id, a.as_str()];
    parts.extend(add.iter().map(String::as_str));
    parts.push(r.as_str());
    parts.extend(remove.iter().map(String::as_str));
    format!("gmail-modify:{id}:{}", google_write_digest(&parts))
}
fn gmail_send_scope(raw: &str) -> String {
    format!("gmail-send:{}", google_write_digest(&[raw]))
}

fn gmail_header(headers: &[GmailHeader], name: &str) -> String {
    headers
        .iter()
        .find(|header| {
            header
                .name
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(name))
        })
        .and_then(|header| header.value.clone())
        .unwrap_or_default()
}

fn base64url_decode(value: &str) -> Result<Vec<u8>, String> {
    let mut normalized = value.replace('-', "+").replace('_', "/");
    while !normalized.len().is_multiple_of(4) {
        normalized.push('=');
    }
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(normalized)
        .map_err(|error| format!("Gmail returned an invalid message body: {error}"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GmailBodySource<'a> {
    Inline(&'a str),
    Attachment(&'a str),
}

fn find_body_source<'a>(payload: &'a GmailPayload, mime_type: &str) -> Option<GmailBodySource<'a>> {
    if payload.mime_type.as_deref() == Some(mime_type)
        && let Some(body) = payload.body.as_ref()
    {
        if let Some(data) = body.data.as_deref().filter(|value| !value.is_empty()) {
            return Some(GmailBodySource::Inline(data));
        }
        if let Some(attachment_id) = body
            .attachment_id
            .as_deref()
            .filter(|value| !value.is_empty())
        {
            return Some(GmailBodySource::Attachment(attachment_id));
        }
    }
    if let Some(parts) = &payload.parts {
        for part in parts {
            if let Some(source) = find_body_source(part, mime_type) {
                return Some(source);
            }
        }
    }
    None
}

fn validate_gmail_attachment_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 4096 || !id.bytes().all(|byte| byte.is_ascii_graphic()) {
        return Err("invalid Gmail attachment identifier".into());
    }
    Ok(())
}

fn decode_gmail_text(data: &str) -> Result<String, String> {
    let bytes = base64url_decode(data)?;
    if bytes.len() > GMAIL_MAX_BODY_BYTES {
        return Err("Gmail message body exceeds the 5 MiB text limit".into());
    }
    String::from_utf8(bytes)
        .map_err(|error| format!("Gmail returned a non-UTF-8 text body: {error}"))
}

fn fetch_gmail_attachment_text(
    client: &reqwest::blocking::Client,
    access_token: &str,
    message_id: &str,
    attachment_id: &str,
) -> Result<String, String> {
    validate_gmail_message_id(message_id)?;
    validate_gmail_attachment_id(attachment_id)?;
    let url = format!(
        "{GMAIL_MESSAGES_ENDPOINT}/{}/attachments/{}",
        percent_encode(message_id),
        percent_encode(attachment_id)
    );
    let response = client
        .get(url)
        .bearer_auth(access_token)
        .send()
        .map_err(|error| format!("failed to fetch Gmail message attachment: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to fetch Gmail message attachment",
        ));
    }
    let attachment: GmailAttachmentResponse = read_provider_json_bounded(
        response,
        "Gmail text attachment",
        (GMAIL_MAX_BODY_BYTES * 2) as u64,
    )?;
    let data = attachment
        .data
        .as_deref()
        .ok_or_else(|| "Gmail attachment response did not contain body data".to_string())?;
    decode_gmail_text(data)
}

fn resolve_gmail_body_source(
    client: &reqwest::blocking::Client,
    access_token: &str,
    message_id: &str,
    source: GmailBodySource<'_>,
) -> Result<String, String> {
    match source {
        GmailBodySource::Inline(data) => decode_gmail_text(data),
        GmailBodySource::Attachment(attachment_id) => {
            fetch_gmail_attachment_text(client, access_token, message_id, attachment_id)
        }
    }
}

fn html_to_plain_text(html: &str) -> String {
    let mut output = String::with_capacity(html.len());
    let mut tag = String::new();
    let mut in_tag = false;
    let mut suppressed: Option<&'static str> = None;

    for ch in html.chars() {
        if in_tag {
            if ch == '>' {
                in_tag = false;
                let normalized = tag.trim().to_ascii_lowercase();
                let name = normalized
                    .trim_start_matches('/')
                    .split_whitespace()
                    .next()
                    .unwrap_or_default()
                    .trim_end_matches('/');
                let closing = normalized.starts_with('/');
                match (closing, name) {
                    (false, "script") => suppressed = Some("script"),
                    (false, "style") => suppressed = Some("style"),
                    (true, "script") if suppressed == Some("script") => suppressed = None,
                    (true, "style") if suppressed == Some("style") => suppressed = None,
                    _ => {}
                }
                if suppressed.is_none()
                    && matches!(
                        name,
                        "br" | "p" | "div" | "li" | "tr" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
                    )
                {
                    output.push('\n');
                }
                tag.clear();
            } else {
                tag.push(ch);
            }
            continue;
        }
        if ch == '<' {
            in_tag = true;
            tag.clear();
        } else if suppressed.is_none() {
            output.push(ch);
        }
    }

    let decoded = output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    let mut normalized = String::new();
    for line in decoded.lines() {
        let collapsed = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if collapsed.is_empty() {
            if !normalized.ends_with("\n\n") && !normalized.is_empty() {
                normalized.push('\n');
            }
        } else {
            if !normalized.is_empty() && !normalized.ends_with('\n') {
                normalized.push('\n');
            }
            normalized.push_str(&collapsed);
        }
    }
    normalized.trim().to_string()
}

fn gmail_message_text(
    client: &reqwest::blocking::Client,
    access_token: &str,
    message_id: &str,
    payload: &GmailPayload,
) -> Result<Option<String>, String> {
    if let Some(source) = find_body_source(payload, "text/plain") {
        return resolve_gmail_body_source(client, access_token, message_id, source).map(Some);
    }
    if let Some(source) = find_body_source(payload, "text/html") {
        let html = resolve_gmail_body_source(client, access_token, message_id, source)?;
        return Ok(Some(html_to_plain_text(&html)));
    }
    Ok(None)
}

fn gmail_preview(message: GmailMessage) -> GmailMessagePreview {
    let headers = message
        .payload
        .as_ref()
        .and_then(|payload| payload.headers.as_deref())
        .unwrap_or_default();
    GmailMessagePreview {
        id: message.id.unwrap_or_default(),
        thread_id: message.thread_id.unwrap_or_default(),
        subject: gmail_header(headers, "Subject"),
        from: gmail_header(headers, "From"),
        date: gmail_header(headers, "Date"),
        snippet: message.snippet.unwrap_or_default(),
    }
}

#[tauri::command]
pub fn google_calendar_start_auth(
    state: tauri::State<AppState>,
    client_id: String,
    calendar_id: String,
    task_list_id: String,
    authorization_token: String,
) -> Result<String, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleCalendarAuth,
        Some(AUTH_SCOPE),
        None,
    )?;
    // Validate the resources the user is connecting before opening a browser.
    // The auth command used to accept these fields and intentionally ignore them,
    // which let malformed values survive until the first background refresh.
    validate_calendar_id(&calendar_id)?;
    validate_task_list_id(&task_list_id)?;

    start_google_auth(client_id, OAUTH_SCOPES, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)
}

#[tauri::command]
pub fn google_gmail_start_auth(
    state: tauri::State<AppState>,
    client_id: String,
    authorization_token: String,
) -> Result<String, String> {
    require_gmail_capability(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleGmailAuth,
        Some(GMAIL_AUTH_SCOPE),
        None,
    )?;
    start_google_auth(client_id, GMAIL_OAUTH_SCOPES, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)
}

#[tauri::command]
pub fn google_gmail_get_authed_email(state: tauri::State<AppState>) -> Result<String, String> {
    require_gmail_capability(&state)?;
    Ok(require_tokens(GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?.email)
}

#[tauri::command]
pub fn google_gmail_disconnect(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<(), String> {
    require_gmail_capability(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleGmailDisconnect,
        Some(GMAIL_AUTH_SCOPE),
        None,
    )?;
    disconnect_google_account(GMAIL_TOKEN_KEYCHAIN_ACCOUNT)
}

fn validate_gmail_message_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 256
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("invalid Gmail message identifier".into());
    }
    Ok(())
}

fn validate_calendar_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 255 {
        return Err(format!(
            "invalid Google Calendar ID (length {}): must be 1–255 characters",
            id.len()
        ));
    }
    if !id.bytes().all(|b| b.is_ascii_graphic()) {
        return Err(
            "invalid Google Calendar ID: contains non-printable or non-ASCII characters".into(),
        );
    }
    Ok(())
}

fn validate_task_list_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 255 {
        return Err(format!(
            "invalid Google Tasks list ID (length {}): must be 1–255 characters",
            id.len()
        ));
    }
    if !id.bytes().all(|b| b.is_ascii_graphic()) {
        return Err(
            "invalid Google Tasks list ID: contains non-printable or non-ASCII characters".into(),
        );
    }
    Ok(())
}

fn validate_provider_page_token(token: Option<&str>) -> Result<(), String> {
    if token.is_some_and(|token| {
        token.is_empty()
            || token.len() > 2048
            || token
                .chars()
                .any(|value| value.is_control() || value.is_whitespace())
    }) {
        return Err("Google returned an invalid pagination token".into());
    }
    Ok(())
}

fn validate_next_page(
    next: Option<String>,
    current: Option<&str>,
    seen: &mut std::collections::HashSet<String>,
    page_index: usize,
) -> Result<Option<String>, String> {
    validate_provider_page_token(next.as_deref())?;
    if let Some(token) = &next {
        if Some(token.as_str()) == current || !seen.insert(token.clone()) {
            return Err("Google returned a repeated pagination token".into());
        }
        if page_index + 1 >= GOOGLE_RESOURCE_MAX_PAGES {
            return Err("Google resource discovery exceeds the supported 10-page bound. No partial list was accepted.".into());
        }
    }
    Ok(next)
}

fn validate_resource_title(title: &str) -> Result<(), String> {
    if title.trim().is_empty() || title.len() > 1024 || title.chars().any(char::is_control) {
        return Err("Google returned an invalid resource name".into());
    }
    Ok(())
}

fn validate_calendar_resource(
    mut calendar: GoogleCalendarResource,
) -> Result<GoogleCalendarResource, String> {
    validate_calendar_id(&calendar.id)?;
    validate_resource_title(&calendar.summary)?;
    calendar.writable = matches!(
        calendar.access_role,
        GoogleCalendarAccessRole::Owner | GoogleCalendarAccessRole::Writer
    );
    Ok(calendar)
}

trait GoogleDiscoveredResource: serde::de::DeserializeOwned {
    fn validate(self) -> Result<Self, String>
    where
        Self: Sized;
    fn id(&self) -> &str;
}

impl GoogleDiscoveredResource for GoogleCalendarResource {
    fn validate(self) -> Result<Self, String> {
        validate_calendar_resource(self)
    }
    fn id(&self) -> &str {
        &self.id
    }
}

impl GoogleDiscoveredResource for GoogleTaskListResource {
    fn validate(self) -> Result<Self, String> {
        validate_task_list_id(&self.id)?;
        validate_resource_title(&self.title)?;
        Ok(self)
    }
    fn id(&self) -> &str {
        &self.id
    }
}

fn discover_google_resources<T: GoogleDiscoveredResource>(
    endpoint: &str,
    service: &str,
) -> Result<Vec<T>, String> {
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    let mut resources = Vec::new();
    let mut page_token: Option<String> = None;
    let mut seen_tokens = std::collections::HashSet::new();
    let mut seen_ids = std::collections::HashSet::new();
    for page_index in 0..GOOGLE_RESOURCE_MAX_PAGES {
        let mut request = client
            .get(endpoint)
            .bearer_auth(&access_token)
            .query(&[("maxResults", "100")]);
        if let Some(token) = page_token.as_deref() {
            request = request.query(&[("pageToken", token)]);
        }
        let response = request
            .send()
            .map_err(|_| format!("Could not discover {service}"))?;
        if !response.status().is_success() {
            return Err(provider_failure(response.status(), service));
        }
        let page: GoogleResourcePage<T> = read_provider_json(response, service)?;
        let items = page.items.unwrap_or_default();
        if items.len() > 100 || resources.len() + items.len() > GOOGLE_RESOURCE_MAX_ITEMS {
            return Err(format!("{service} exceeds the supported resource bound"));
        }
        for item in items {
            let item = item.validate()?;
            if !seen_ids.insert(item.id().to_owned()) {
                return Err(format!("{service} returned duplicate resource IDs"));
            }
            resources.push(item);
        }
        page_token = validate_next_page(
            page.next_page_token,
            page_token.as_deref(),
            &mut seen_tokens,
            page_index,
        )?;
        if page_token.is_none() {
            return Ok(resources);
        }
    }
    Err(format!("{service} pagination did not terminate"))
}

#[tauri::command]
pub fn google_calendar_list_calendars() -> Result<Vec<GoogleCalendarResource>, String> {
    discover_google_resources(CALENDAR_LIST_ENDPOINT, "Google Calendar discovery")
}

#[tauri::command]
pub fn google_calendar_list_task_lists() -> Result<Vec<GoogleTaskListResource>, String> {
    discover_google_resources(TASK_LISTS_ENDPOINT, "Google Tasks list discovery")
}

fn validate_gmail_list_request(
    query: &str,
    max_results: u32,
    page_token: Option<&str>,
) -> Result<(), String> {
    if !(1..=50).contains(&max_results) {
        return Err("Gmail page size must be between 1 and 50".into());
    }
    if query.len() > 512 || query.chars().any(char::is_control) {
        return Err(
            "Gmail search query must be at most 512 bytes and contain no control characters".into(),
        );
    }
    validate_provider_page_token(page_token)
}

fn validate_gmail_listing(
    list: GmailMessageList,
    max_results: u32,
    current_token: Option<&str>,
) -> Result<(Vec<String>, Option<String>), String> {
    validate_provider_page_token(list.next_page_token.as_deref())?;
    if list.next_page_token.is_some() && list.next_page_token.as_deref() == current_token {
        return Err("Gmail returned a repeated pagination token".into());
    }
    let messages = list.messages.unwrap_or_default();
    if messages.len() > max_results as usize {
        return Err("Gmail returned an over-limit message page".into());
    }
    let mut ids = Vec::with_capacity(messages.len());
    let mut seen = std::collections::HashSet::new();
    for message in messages {
        let id = message.id.ok_or("Gmail returned a message without an ID")?;
        validate_gmail_message_id(&id)?;
        if !seen.insert(id.clone()) {
            return Err("Gmail returned a duplicate message ID".into());
        }
        ids.push(id);
    }
    Ok((ids, list.next_page_token))
}

fn gmail_message_url(id: &str) -> Result<String, String> {
    validate_gmail_message_id(id)?;
    Ok(format!("{GMAIL_MESSAGES_ENDPOINT}/{id}"))
}

fn gmail_get_message(
    client: &reqwest::blocking::Client,
    access_token: &str,
    id: &str,
) -> Result<GmailMessage, String> {
    gmail_fetch_message(client, access_token, id, "full")
}

fn gmail_fetch_message(
    client: &reqwest::blocking::Client,
    access_token: &str,
    id: &str,
    format: &str,
) -> Result<GmailMessage, String> {
    let url = gmail_message_url(id)?;
    let response = client
        .get(url)
        .bearer_auth(access_token)
        .query(&[("format", format)])
        .send()
        .map_err(|error| format!("failed to fetch Gmail message: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to fetch Gmail message",
        ));
    }
    if format == "metadata" {
        read_provider_json(response, "Gmail message metadata")
    } else {
        let mut bytes = Vec::new();
        response
            .take((GMAIL_MAX_BODY_BYTES * 2 + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| "Could not read Gmail message response".to_string())?;
        if bytes.len() > GMAIL_MAX_BODY_BYTES * 2 {
            return Err("Gmail message response exceeds the supported size limit".into());
        }
        serde_json::from_slice(&bytes)
            .map_err(|_| "Gmail returned an invalid message response".into())
    }
}

fn gmail_batch_get_messages(
    client: &reqwest::blocking::Client,
    access_token: &str,
    ids: &[String],
) -> Result<Vec<GmailMessage>, String> {
    let mut messages = Vec::with_capacity(ids.len());
    for chunk in ids.chunks(GMAIL_BATCH_MAX_CALLS) {
        messages.extend(gmail_batch_get_chunk(client, access_token, chunk)?);
    }
    Ok(messages)
}

fn gmail_batch_get_chunk(
    client: &reqwest::blocking::Client,
    access_token: &str,
    ids: &[String],
) -> Result<Vec<GmailMessage>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let (boundary, body) = gmail_batch_request_body(ids)?;
    let response = client
        .post(GMAIL_BATCH_ENDPOINT)
        .bearer_auth(access_token)
        .header(
            "Content-Type",
            format!("multipart/mixed; boundary={boundary}"),
        )
        .body(body)
        .send()
        .map_err(|error| format!("failed to send Gmail batch request: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "Gmail batch request failed",
        ));
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let mut bytes = Vec::new();
    response
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read Gmail batch response".to_string())?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("Gmail metadata batch exceeds the supported size limit".into());
    }
    let payload = String::from_utf8(bytes).map_err(|_| "Invalid Gmail batch response encoding")?;
    let boundary = parse_multipart_boundary(&content_type)
        .ok_or_else(|| "Gmail batch response lacks a multipart boundary".to_string())?;
    gmail_parse_batch_response(&payload, &boundary, ids.len())
}

fn gmail_batch_request_body(ids: &[String]) -> Result<(String, String), String> {
    let boundary = format!("scriptor_batch_{}", uuid::Uuid::new_v4().simple());
    let mut body = String::new();
    for (index, id) in ids.iter().enumerate() {
        validate_gmail_message_id(id)?;
        body.push_str("--");
        body.push_str(&boundary);
        body.push_str("\r\n");
        body.push_str("Content-Type: application/http\r\n");
        body.push_str("Content-Transfer-Encoding: binary\r\n");
        body.push_str(&format!("Content-ID: <scriptor+{index}>\r\n\r\n"));
        body.push_str(&format!(
            "GET /gmail/v1/users/me/messages/{id}?format=metadata\r\n\r\n"
        ));
    }
    body.push_str("--");
    body.push_str(&boundary);
    body.push_str("--\r\n");
    Ok((boundary, body))
}

fn parse_multipart_boundary(content_type: &str) -> Option<String> {
    for parameter in content_type.split(';').skip(1) {
        let parameter = parameter.trim();
        if let Some(value) = parameter.strip_prefix("boundary=") {
            let value = value.trim_matches('"');
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn gmail_parse_batch_response(
    payload: &str,
    boundary: &str,
    expected: usize,
) -> Result<Vec<GmailMessage>, String> {
    let normalized = payload.replace("\r\n", "\n");
    let delimiter = format!("--{boundary}");
    let mut slots: Vec<Option<GmailMessage>> = (0..expected).map(|_| None).collect();
    for (position, segment) in normalized.split(delimiter.as_str()).enumerate() {
        if position == 0 {
            continue;
        }
        let segment = segment.trim();
        if segment.is_empty() || segment.starts_with("--") {
            continue;
        }
        let (index, message) = gmail_parse_batch_part(segment)?;
        let slot = index as usize;
        if slot >= expected {
            return Err("Gmail batch response referenced an unknown request index".into());
        }
        if slots[slot].replace(message).is_some() {
            return Err("Gmail batch response repeated a message part".into());
        }
    }
    let mut messages = Vec::with_capacity(expected);
    for slot in slots {
        messages.push(
            slot.ok_or_else(|| "Gmail batch response is missing a message part".to_string())?,
        );
    }
    Ok(messages)
}

fn gmail_parse_batch_part(part: &str) -> Result<(u32, GmailMessage), String> {
    let part = part.replace("\r\n", "\n");
    let (headers, inner) = part
        .split_once("\n\n")
        .ok_or_else(|| "Gmail batch part has no inner response".to_string())?;
    let mut index = None;
    for line in headers.lines().map(str::trim_start) {
        if let Some(value) = line.strip_prefix("Content-ID:") {
            let value = value.trim().trim_start_matches('<').trim_end_matches('>');
            if let Some(number) = value.strip_prefix("response-scriptor+") {
                index = number.parse::<u32>().ok();
            }
        }
    }
    let index =
        index.ok_or_else(|| "Gmail batch part lacks a recognizable Content-ID".to_string())?;
    let status_line = inner
        .lines()
        .next()
        .ok_or_else(|| "Gmail batch part has an empty inner response".to_string())?;
    let status_code = status_line.split_whitespace().nth(1).unwrap_or_default();
    if !status_code.starts_with('2') {
        return Err(format!("Gmail batch part failed with status {status_code}"));
    }
    let json = inner
        .split_once("\n\n")
        .map(|(_, body)| body)
        .unwrap_or_default();
    let message = serde_json::from_str::<GmailMessage>(json.trim())
        .map_err(|error| format!("Gmail batch part returned an invalid message: {error}"))?;
    Ok((index, message))
}

#[tauri::command]
pub fn google_gmail_list_messages(
    state: tauri::State<AppState>,
    query: Option<String>,
    max_results: u32,
) -> Result<Vec<GmailMessagePreview>, String> {
    require_gmail_capability(&state)?;
    google_gmail_list_messages_page(state, query, max_results.clamp(1, 50), None)
        .map(|page| page.messages)
}

#[tauri::command]
pub fn google_gmail_list_messages_page(
    state: tauri::State<AppState>,
    query: Option<String>,
    max_results: u32,
    page_token: Option<String>,
) -> Result<GmailMessagePage, String> {
    require_gmail_capability(&state)?;
    let query = query.unwrap_or_default();
    validate_gmail_list_request(&query, max_results, page_token.as_deref())?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?;
    let mut request = client
        .get(GMAIL_MESSAGES_ENDPOINT)
        .bearer_auth(&access_token)
        .query(&[("maxResults", max_results.to_string())]);
    if !query.trim().is_empty() {
        request = request.query(&[("q", query.trim())]);
    }
    if let Some(token) = page_token.as_deref() {
        request = request.query(&[("pageToken", token)]);
    }
    let response = request
        .send()
        .map_err(|error| format!("failed to list Gmail messages: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(response.status(), "Gmail message listing"));
    }
    let list = read_provider_json(response, "Gmail message listing")?;
    let (ids, next_page_token) = validate_gmail_listing(list, max_results, page_token.as_deref())?;
    if ids.is_empty() {
        return Ok(GmailMessagePage {
            messages: Vec::new(),
            next_page_token,
        });
    }
    let messages = match gmail_batch_get_messages(&client, &access_token, &ids) {
        Ok(messages) => messages,
        Err(batch_error) => {
            tracing::warn!(
                error = %batch_error,
                message_count = ids.len(),
                "Gmail batch fetch failed; falling back to parallel per-message GETs"
            );
            gmail_fetch_messages_parallel(&client, &access_token, &ids)?
        }
    };
    if messages.len() != ids.len() {
        return Err("Gmail metadata response was incomplete".into());
    }
    for (message, expected_id) in messages.iter().zip(&ids) {
        if message.id.as_deref() != Some(expected_id.as_str()) {
            return Err("Gmail metadata response did not match the requested message".into());
        }
        validate_gmail_message_id(
            message
                .thread_id
                .as_deref()
                .ok_or("Gmail returned a message without a thread ID")?,
        )?;
    }
    let messages = messages.into_iter().map(gmail_preview).collect::<Vec<_>>();
    for message in &messages {
        for value in [&message.subject, &message.from, &message.snippet] {
            if value.len() > 16 * 1024
                || value
                    .chars()
                    .any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
            {
                return Err("Gmail returned invalid message metadata".into());
            }
        }
        if message.date.len() > 1024 {
            return Err("Gmail returned an invalid message date".into());
        }
    }
    Ok(GmailMessagePage {
        messages,
        next_page_token,
    })
}

fn gmail_fetch_messages_parallel(
    client: &reqwest::blocking::Client,
    access_token: &str,
    ids: &[String],
) -> Result<Vec<GmailMessage>, String> {
    const FETCH_CONCURRENCY: usize = 8;
    let mut messages = Vec::with_capacity(ids.len());
    for chunk in ids.chunks(FETCH_CONCURRENCY) {
        let results: Vec<Result<GmailMessage, String>> = std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|id| scope.spawn(|| gmail_fetch_message(client, access_token, id, "metadata")))
                .collect();
            handles
                .into_iter()
                .map(|handle| {
                    handle
                        .join()
                        .unwrap_or_else(|_| Err("Gmail message fetch worker panicked".into()))
                })
                .collect()
        });
        for result in results {
            messages.push(result?);
        }
    }
    Ok(messages)
}

#[tauri::command]
pub fn google_gmail_get_message(
    state: tauri::State<AppState>,
    id: String,
) -> Result<GmailMessageContent, String> {
    require_gmail_capability(&state)?;
    validate_gmail_message_id(&id)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?;
    let message = gmail_get_message(&client, &access_token, &id)?;
    let message_id = message
        .id
        .clone()
        .ok_or("Gmail returned a message without an ID")?;
    if message_id != id {
        return Err("Gmail detail did not match the requested message".into());
    }
    validate_gmail_message_id(
        message
            .thread_id
            .as_deref()
            .ok_or("Gmail returned a message without a thread ID")?,
    )?;
    let headers = message
        .payload
        .as_ref()
        .and_then(|payload| payload.headers.as_deref())
        .unwrap_or_default();
    let subject = gmail_header(headers, "Subject");
    let from = gmail_header(headers, "From");
    let date = gmail_header(headers, "Date");
    let plain_text = message
        .payload
        .as_ref()
        .map(|payload| gmail_message_text(&client, &access_token, &message_id, payload))
        .transpose()?
        .flatten()
        .unwrap_or_default();
    Ok(GmailMessageContent {
        id: message_id,
        thread_id: message.thread_id.unwrap_or_default(),
        subject,
        from,
        date,
        snippet: message.snippet.unwrap_or_default(),
        plain_text,
    })
}

#[tauri::command]
pub fn google_gmail_modify_message(
    state: tauri::State<AppState>,
    id: String,
    add_label_ids: Vec<String>,
    remove_label_ids: Vec<String>,
    authorization_token: String,
) -> Result<(), String> {
    require_gmail_capability(&state)?;
    validate_gmail_message_id(&id)?;
    if add_label_ids.is_empty() && remove_label_ids.is_empty() {
        return Err("select at least one Gmail label change".into());
    }
    if add_label_ids
        .iter()
        .chain(remove_label_ids.iter())
        .any(|label| label.is_empty() || label.len() > 256 || label.chars().any(char::is_control))
    {
        return Err("invalid Gmail label identifier".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleGmailWrite,
        Some(&gmail_modify_scope(&id, &add_label_ids, &remove_label_ids)),
        None,
    )?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?;
    let url = format!("{}/modify", gmail_message_url(&id)?);
    let response = client
        .post(url)
        .bearer_auth(&access_token)
        .json(&GmailModifyRequest {
            add_label_ids,
            remove_label_ids,
        })
        .send()
        .map_err(|error| format!("failed to modify Gmail message: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to modify Gmail message",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn google_gmail_trash_message(
    state: tauri::State<AppState>,
    id: String,
    authorization_token: String,
) -> Result<(), String> {
    require_gmail_capability(&state)?;
    validate_gmail_message_id(&id)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleGmailWrite,
        Some(&format!("gmail-trash:{id}")),
        None,
    )?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?;
    let response = client
        .post(format!("{}/trash", gmail_message_url(&id)?))
        .bearer_auth(&access_token)
        .send()
        .map_err(|error| format!("failed to move Gmail message to trash: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to move Gmail message to trash",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn google_gmail_send_message(
    state: tauri::State<AppState>,
    raw_message: String,
    authorization_token: String,
) -> Result<(), String> {
    require_gmail_capability(&state)?;
    if raw_message.is_empty() || raw_message.len() > 2_800_000 {
        return Err("encoded email must contain between 1 and 2,800,000 characters".into());
    }
    let decoded = base64url_decode(&raw_message)?;
    if decoded.len() > 2_000_000 || !decoded.windows(2).any(|window| window == b"\r\n") {
        return Err("email must be a bounded RFC 5322 message".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleGmailSend,
        Some(&gmail_send_scope(&raw_message)),
        None,
    )?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, GMAIL_TOKEN_KEYCHAIN_ACCOUNT)?;
    let response = client
        .post(GMAIL_SEND_ENDPOINT)
        .bearer_auth(&access_token)
        .json(&serde_json::json!({ "raw": raw_message }))
        .send()
        .map_err(|error| format!("failed to send Gmail message: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to send Gmail message",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn google_calendar_disconnect(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleCalendarDisconnect,
        Some(AUTH_SCOPE),
        None,
    )?;
    disconnect_google_account(CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)
}

#[tauri::command]
pub fn google_calendar_list_events(
    calendar_id: String,
    lookahead_days: i64,
) -> Result<Vec<CalendarEvent>, String> {
    validate_calendar_id(&calendar_id)?;
    let lookahead_days = lookahead_days.clamp(1, 365);
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;

    let now = chrono::Utc::now();
    let time_min = now.to_rfc3339();
    let time_max = (now + chrono::Duration::days(lookahead_days)).to_rfc3339();

    let url = format!(
        "{CALENDAR_EVENTS_ENDPOINT}/{}/events",
        percent_encode(&calendar_id)
    );
    let mut events = Vec::new();
    let mut page_token: Option<String> = None;
    let mut seen_page_tokens = std::collections::HashSet::new();

    for page_index in 0..GOOGLE_CALENDAR_EVENT_MAX_PAGES {
        let mut request = client.get(&url).bearer_auth(&access_token).query(&[
            ("timeMin", time_min.as_str()),
            ("timeMax", time_max.as_str()),
            ("singleEvents", "true"),
            ("orderBy", "startTime"),
            ("maxResults", GOOGLE_CALENDAR_EVENT_PAGE_SIZE),
        ]);
        if let Some(token) = page_token.as_deref() {
            request = request.query(&[("pageToken", token)]);
        }

        let response = request
            .send()
            .map_err(|error| format!("failed to list Google Calendar events: {error}"))?;
        if !response.status().is_success() {
            return Err(provider_failure(
                response.status(),
                "failed to list Google Calendar events",
            ));
        }

        let list: GcalEventList = read_provider_json(response, "Google Calendar events")?;
        events.extend(
            list.items
                .unwrap_or_default()
                .into_iter()
                .map(|event| map_event(event, &calendar_id)),
        );

        let Some(next_token) = list.next_page_token.filter(|token| !token.is_empty()) else {
            return Ok(events);
        };
        if !seen_page_tokens.insert(next_token.clone()) {
            return Err("Google Calendar returned a repeated pagination token".into());
        }
        if page_index + 1 == GOOGLE_CALENDAR_EVENT_MAX_PAGES {
            return Err(format!(
                "Google Calendar result exceeds the supported {}-page sync bound",
                GOOGLE_CALENDAR_EVENT_MAX_PAGES
            ));
        }
        page_token = Some(next_token);
    }

    Err("Google Calendar pagination terminated unexpectedly".into())
}

#[tauri::command]
pub fn google_calendar_list_tasks(task_list_id: String) -> Result<Vec<GoogleTask>, String> {
    validate_task_list_id(&task_list_id)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;

    let url = format!("{TASKS_ENDPOINT}/{}/tasks", percent_encode(&task_list_id));
    let mut tasks = Vec::new();
    let mut page_token: Option<String> = None;
    let mut seen_page_tokens = std::collections::HashSet::new();
    let mut seen_task_ids = std::collections::HashSet::new();

    for page_index in 0..GOOGLE_TASK_MAX_PAGES {
        let mut request = client.get(&url).bearer_auth(&access_token).query(&[
            ("showCompleted", "true"),
            ("showHidden", "true"),
            ("maxResults", GOOGLE_TASK_PAGE_SIZE),
        ]);
        if let Some(token) = page_token.as_deref() {
            request = request.query(&[("pageToken", token)]);
        }

        let response = request
            .send()
            .map_err(|error| format!("failed to list Google Tasks: {error}"))?;
        if !response.status().is_success() {
            return Err(provider_failure(
                response.status(),
                "failed to list Google Tasks",
            ));
        }

        let list: GTaskList = read_provider_json(response, "Google Tasks")?;
        let items = list.items.unwrap_or_default();
        if items.len() > 100 {
            return Err("Google Tasks returned an over-limit task page".into());
        }
        for task in items {
            let task = validate_provider_task(task)?;
            if !seen_task_ids.insert(task.id.clone().unwrap_or_default()) {
                return Err("Google Tasks returned duplicate task identities".into());
            }
            tasks.push(map_task(task));
        }

        validate_provider_page_token(list.next_page_token.as_deref())?;
        let Some(next_token) = list.next_page_token else {
            return Ok(tasks);
        };
        if !seen_page_tokens.insert(next_token.clone()) {
            return Err("Google Tasks returned a repeated pagination token".into());
        }
        if page_index + 1 == GOOGLE_TASK_MAX_PAGES {
            return Err(format!(
                "Google Tasks result exceeds the supported {}-page sync bound",
                GOOGLE_TASK_MAX_PAGES
            ));
        }
        page_token = Some(next_token);
    }

    Err("Google Tasks pagination terminated unexpectedly".into())
}

#[tauri::command]
pub fn google_calendar_get_authed_email() -> Result<String, String> {
    Ok(require_tokens(CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?.email)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleTaskSyncMutation {
    kind: String,
    task_id: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    due: Option<String>,
    status: Option<String>,
    etag: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleTaskSyncMutationResult {
    kind: String,
    success: bool,
    error: Option<String>,
}

#[derive(Debug)]
struct GoogleTaskUpdateInput {
    task_id: String,
    title: String,
    notes: String,
    due: Option<String>,
    status: Option<String>,
    etag: String,
}

fn google_task_sync_scope(count: usize) -> String {
    format!("Sync {count} vault task changes")
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum PlannerWrite {
    Event {
        #[serde(rename = "calendarId")]
        calendar_id: String,
        #[serde(rename = "eventId")]
        event_id: String,
        etag: Option<String>,
        title: String,
        start: String,
        end: String,
        create: bool,
    },
    Task {
        #[serde(rename = "taskListId")]
        task_list_id: String,
        #[serde(rename = "taskId")]
        task_id: String,
        etag: String,
        title: String,
        due: Option<String>,
        done: bool,
    },
}

fn validate_planner_write(request: &PlannerWrite) -> Result<(), String> {
    let (id, title, etag) = match request {
        PlannerWrite::Event {
            calendar_id,
            event_id,
            title,
            start,
            end,
            create,
            etag,
        } => {
            validate_calendar_id(calendar_id)?;
            let begin = chrono::DateTime::parse_from_rfc3339(start)
                .map_err(|_| "Event start must include a UTC offset")?;
            let finish = chrono::DateTime::parse_from_rfc3339(end)
                .map_err(|_| "Event end must include a UTC offset")?;
            if finish <= begin || finish - begin > chrono::Duration::days(7) {
                return Err("Event duration must be positive and no longer than seven days".into());
            }
            if *create
                && (event_id.len() < 5
                    || !event_id
                        .bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'v').contains(&b)))
            {
                return Err("New event identity must be base32hex".into());
            }
            if !create && etag.is_none() {
                return Err("Refresh the event before changing it".into());
            }
            (event_id, title, etag.as_deref())
        }
        PlannerWrite::Task {
            task_list_id,
            task_id,
            title,
            due,
            etag,
            ..
        } => {
            validate_task_list_id(task_list_id)?;
            validate_task_fields(title, None, due.as_deref(), None)?;
            (task_id, title, Some(etag.as_str()))
        }
    };
    if id.is_empty() || id.len() > 1024 || id.chars().any(char::is_control) {
        return Err("Invalid provider identity".into());
    }
    if title.trim().is_empty() || title.len() > 4096 || title.contains(['\r', '\n']) {
        return Err("Title must be one bounded nonempty line".into());
    }
    if let Some(etag) = etag
        && (etag.is_empty() || etag.len() > 512 || etag.chars().any(char::is_control))
    {
        return Err("Invalid provider revision".into());
    }
    Ok(())
}

/// One reviewed planner change per grant. Provider preconditions protect remote revisions.
#[tauri::command]
pub fn google_planner_write_event(
    state: tauri::State<AppState>,
    request: PlannerWrite,
    authorization_token: Option<String>,
) -> Result<serde_json::Value, String> {
    validate_planner_write(&request)?;
    let scope = match &request {
        PlannerWrite::Event {
            calendar_id,
            event_id,
            ..
        } => format!("Google Calendar event {calendar_id}:{event_id}"),
        _ => return Err("Event command requires an event change".into()),
    };
    require_sensitive_operation(
        &state,
        authorization_token
            .as_deref()
            .ok_or("Planner authorization is required")?,
        SensitiveOperation::GoogleCalendarWrite,
        Some(&scope),
        None,
    )?;
    apply_planner_write(request)
}

#[tauri::command]
pub fn google_planner_write_task(
    state: tauri::State<AppState>,
    request: PlannerWrite,
    authorization_token: Option<String>,
) -> Result<serde_json::Value, String> {
    validate_planner_write(&request)?;
    let scope = match &request {
        PlannerWrite::Task {
            task_list_id,
            task_id,
            ..
        } => format!("Google Task {task_list_id}:{task_id}"),
        _ => return Err("Task command requires a task change".into()),
    };
    require_sensitive_operation(
        &state,
        authorization_token
            .as_deref()
            .ok_or("Planner authorization is required")?,
        SensitiveOperation::GoogleTaskWrite,
        Some(&scope),
        None,
    )?;
    apply_planner_write(request)
}

fn apply_planner_write(request: PlannerWrite) -> Result<serde_json::Value, String> {
    let client = http_client()?;
    let token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    let builder = match request {
        PlannerWrite::Event {
            calendar_id,
            event_id,
            etag,
            title,
            start,
            end,
            create,
        } => {
            let url = format!(
                "{CALENDAR_EVENTS_ENDPOINT}/{}/events",
                percent_encode(&calendar_id)
            );
            let mut body = serde_json::json!({"summary":title,"start":{"dateTime":start},"end":{"dateTime":end}});
            if create {
                body["id"] = serde_json::Value::String(event_id);
                client.post(url).bearer_auth(&token).json(&body)
            } else {
                client
                    .patch(format!("{url}/{}", percent_encode(&event_id)))
                    .bearer_auth(&token)
                    .header("If-Match", etag.unwrap_or_default())
                    .json(&body)
            }
        }
        PlannerWrite::Task {
            task_list_id,
            task_id,
            etag,
            title,
            due,
            done,
        } => {
            let url = format!(
                "{TASKS_ENDPOINT}/{}/tasks/{}",
                percent_encode(&task_list_id),
                percent_encode(&task_id)
            );
            let mut body = serde_json::json!({"title":title,"due":due,"status":if done {"completed"} else {"needsAction"}});
            if !done {
                body["completed"] = serde_json::Value::Null;
            }
            client
                .patch(url)
                .bearer_auth(&token)
                .header("If-Match", etag)
                .json(&body)
        }
    };
    let mut response = builder
        .send()
        .map_err(|error| format!("Planner provider request failed: {error}"))?;
    if response.status().as_u16() == 412 || response.status().as_u16() == 409 {
        return Err("Provider changed since review. Refresh and resolve the conflict.".into());
    }
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "Planner provider change",
        ));
    }
    let mut bytes = Vec::new();
    response
        .by_ref()
        .take(256 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Unable to read planner provider result")?;
    if bytes.len() > 256 * 1024 {
        return Err("Planner response exceeds its size bound".into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid planner provider response".into())
}

#[cfg(test)]
mod planner_tests {
    use super::*;
    #[test]
    fn planner_event_requires_positive_offset_aware_duration_and_revision() {
        let mut value = serde_json::json!({"kind":"event","calendarId":"primary","eventId":"scriptorabc123","etag":null,"title":"Draft","start":"2026-10-01T09:00:00Z","end":"2026-10-01T10:00:00Z","create":true});
        assert!(validate_planner_write(&serde_json::from_value(value.clone()).unwrap()).is_ok());
        value["end"] = serde_json::json!("2026-10-01T08:00:00Z");
        assert!(validate_planner_write(&serde_json::from_value(value.clone()).unwrap()).is_err());
        value["end"] = serde_json::json!("2026-10-01T10:00:00Z");
        value["create"] = serde_json::json!(false);
        assert!(validate_planner_write(&serde_json::from_value(value).unwrap()).is_err());
    }
    #[test]
    fn planner_task_rejects_multiline_title_bad_revision_and_unknown_fields() {
        let mut value = serde_json::json!({"kind":"task","taskListId":"@default","taskId":"abc","etag":"\"rev1\"","title":"Draft","due":null,"done":false});
        assert!(validate_planner_write(&serde_json::from_value(value.clone()).unwrap()).is_ok());
        value["title"] = serde_json::json!("Draft\nInjected");
        assert!(validate_planner_write(&serde_json::from_value(value.clone()).unwrap()).is_err());
        value["extra"] = serde_json::json!(true);
        assert!(serde_json::from_value::<PlannerWrite>(value).is_err());
    }
}

fn create_google_task(
    client: &reqwest::blocking::Client,
    access_token: &str,
    task_list_id: &str,
    title: String,
    notes: Option<String>,
    due: Option<String>,
) -> Result<GoogleTask, String> {
    validate_task_fields(&title, notes.as_deref(), due.as_deref(), None)?;
    let mut body = serde_json::Map::new();
    body.insert("title".into(), serde_json::Value::String(title));
    if let Some(notes) = notes.filter(|value| !value.is_empty()) {
        body.insert("notes".into(), serde_json::Value::String(notes));
    }
    if let Some(due) = due.filter(|value| !value.is_empty()) {
        body.insert("due".into(), serde_json::Value::String(due));
    }

    let url = format!("{TASKS_ENDPOINT}/{}/tasks", percent_encode(task_list_id));
    let response = client
        .post(url)
        .bearer_auth(access_token)
        .json(&serde_json::Value::Object(body))
        .send()
        .map_err(|error| format!("failed to create Google Task: {error}"))?;
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to create Google Task",
        ));
    }
    let task = read_provider_json(response, "Google Task creation")?;
    Ok(map_task(validate_provider_task(task)?))
}

fn update_google_task(
    client: &reqwest::blocking::Client,
    access_token: &str,
    task_list_id: &str,
    update: GoogleTaskUpdateInput,
) -> Result<GoogleTask, String> {
    validate_google_task_id(&update.task_id)?;
    validate_task_etag(&update.etag)?;
    validate_task_fields(
        &update.title,
        Some(&update.notes),
        update.due.as_deref(),
        update.status.as_deref(),
    )?;

    let url = format!(
        "{TASKS_ENDPOINT}/{}/tasks/{}",
        percent_encode(task_list_id),
        percent_encode(&update.task_id)
    );
    let mut body = serde_json::Map::new();
    body.insert("title".into(), serde_json::Value::String(update.title));
    body.insert("notes".into(), serde_json::Value::String(update.notes));
    body.insert(
        "due".into(),
        update
            .due
            .filter(|value| !value.is_empty())
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),
    );
    if let Some(status) = update.status {
        body.insert("status".into(), serde_json::Value::String(status));
    }
    let response = client
        .patch(url)
        .bearer_auth(access_token)
        .header("If-Match", &update.etag)
        .json(&serde_json::Value::Object(body))
        .send()
        .map_err(|error| format!("failed to update Google Task: {error}"))?;
    if response.status().as_u16() == 409 || response.status().as_u16() == 412 {
        return Err("Google Task changed since review. Refresh tasks and resolve the conflict.".into());
    }
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to update Google Task",
        ));
    }
    let task = read_provider_json(response, "Google Task update")?;
    Ok(map_task(validate_provider_task(task)?))
}

fn complete_google_task(
    client: &reqwest::blocking::Client,
    access_token: &str,
    task_list_id: &str,
    task_id: String,
    etag: String,
) -> Result<(), String> {
    validate_google_task_id(&task_id)?;
    validate_task_etag(&etag)?;
    let url = format!(
        "{TASKS_ENDPOINT}/{}/tasks/{}",
        percent_encode(task_list_id),
        percent_encode(&task_id)
    );
    let response = client
        .patch(url)
        .bearer_auth(access_token)
        .header("If-Match", etag)
        .json(&serde_json::json!({ "status": "completed" }))
        .send()
        .map_err(|error| format!("failed to complete Google Task: {error}"))?;
    if response.status().as_u16() == 409 || response.status().as_u16() == 412 {
        return Err("Google Task changed since review. Refresh tasks and resolve the conflict.".into());
    }
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to complete Google Task",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn google_calendar_apply_task_sync(
    state: tauri::State<AppState>,
    task_list_id: String,
    mutations: Vec<GoogleTaskSyncMutation>,
    authorization_token: String,
) -> Result<Vec<GoogleTaskSyncMutationResult>, String> {
    validate_task_list_id(&task_list_id)?;
    if mutations.is_empty() {
        return Ok(Vec::new());
    }
    if mutations.len() > GOOGLE_TASK_SYNC_MAX_MUTATIONS {
        return Err(format!(
            "Google Task sync exceeds the supported {}-mutation bound",
            GOOGLE_TASK_SYNC_MAX_MUTATIONS
        ));
    }
    // Validate the complete reviewed batch before any provider mutation.
    for mutation in &mutations {
        validate_task_sync_mutation(mutation)?;
    }
    let scope = google_task_sync_scope(mutations.len());
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(&scope),
        None,
    )?;

    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    let mut results = Vec::with_capacity(mutations.len());

    for mutation in mutations {
        let kind = mutation.kind;
        let outcome = match kind.as_str() {
            "create" => create_google_task(
                &client,
                &access_token,
                &task_list_id,
                mutation.title.unwrap_or_default(),
                mutation.notes,
                mutation.due,
            )
            .map(|_| ()),
            "update" => update_google_task(
                &client,
                &access_token,
                &task_list_id,
                GoogleTaskUpdateInput {
                    task_id: mutation.task_id.unwrap_or_default(),
                    title: mutation.title.unwrap_or_default(),
                    notes: mutation.notes.unwrap_or_default(),
                    due: mutation.due,
                    status: mutation.status,
                    etag: mutation.etag.unwrap_or_default(),
                },
            )
            .map(|_| ()),
            "complete" => complete_google_task(
                &client,
                &access_token,
                &task_list_id,
                mutation.task_id.unwrap_or_default(),
                mutation.etag.unwrap_or_default(),
            ),
            _ => Err(format!(
                "unsupported Google Task sync mutation kind: {kind}"
            )),
        };
        match outcome {
            Ok(()) => results.push(GoogleTaskSyncMutationResult {
                kind,
                success: true,
                error: None,
            }),
            Err(error) => results.push(GoogleTaskSyncMutationResult {
                kind,
                success: false,
                error: Some(error),
            }),
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn google_calendar_create_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    title: String,
    notes: Option<String>,
    due: Option<String>,
    authorization_token: String,
) -> Result<GoogleTask, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
        None,
    )?;
    validate_task_list_id(&task_list_id)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    create_google_task(&client, &access_token, &task_list_id, title, notes, due)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)] // Flat parameters are part of the public Tauri command contract.
pub fn google_calendar_update_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    task_id: String,
    title: String,
    notes: String,
    due: Option<String>,
    status: Option<String>,
    etag: String,
    authorization_token: String,
) -> Result<GoogleTask, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
        None,
    )?;
    validate_task_list_id(&task_list_id)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    update_google_task(
        &client,
        &access_token,
        &task_list_id,
        GoogleTaskUpdateInput {
            task_id,
            title,
            notes,
            due,
            status,
            etag,
        },
    )
}

#[tauri::command]
pub fn google_calendar_complete_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    task_id: String,
    etag: String,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
        None,
    )?;
    validate_task_list_id(&task_list_id)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;
    complete_google_task(&client, &access_token, &task_list_id, task_id, etag)
}

#[tauri::command]
pub fn google_calendar_delete_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    task_id: String,
    etag: String,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
        None,
    )?;
    validate_task_list_id(&task_list_id)?;
    validate_google_task_id(&task_id)?;
    validate_task_etag(&etag)?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client, CALENDAR_TOKEN_KEYCHAIN_ACCOUNT)?;

    let url = format!(
        "{TASKS_ENDPOINT}/{}/tasks/{}",
        percent_encode(&task_list_id),
        percent_encode(&task_id)
    );
    let response = client
        .delete(url)
        .bearer_auth(&access_token)
        .header("If-Match", etag)
        .send()
        .map_err(|error| format!("failed to delete Google Task: {error}"))?;
    if response.status().as_u16() == 409 || response.status().as_u16() == 412 {
        return Err("Google Task changed since review. Refresh tasks and resolve the conflict.".into());
    }
    if !response.status().is_success() {
        return Err(provider_failure(
            response.status(),
            "failed to delete Google Task",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_discovery_validates_access_and_complete_pagination() {
        let calendar: GoogleCalendarResource = serde_json::from_str(
            r#"{"id":"team@example.com","summary":"Team","accessRole":"reader","primary":false}"#,
        )
        .unwrap();
        let calendar = validate_calendar_resource(calendar).unwrap();
        assert!(!calendar.writable);
        assert!(
            serde_json::from_str::<GoogleCalendarResource>(
                r#"{"id":"a","summary":"A","accessRole":"unknown"}"#
            )
            .is_err()
        );
        let mut seen = std::collections::HashSet::new();
        assert_eq!(
            validate_next_page(Some("next".into()), None, &mut seen, 0).unwrap(),
            Some("next".into())
        );
        assert!(validate_next_page(Some("next".into()), None, &mut seen, 1).is_err());
        assert!(
            validate_next_page(
                Some("end".into()),
                None,
                &mut seen,
                GOOGLE_RESOURCE_MAX_PAGES - 1
            )
            .is_err()
        );
        assert!(validate_next_page(Some("".into()), None, &mut seen, 0).is_err());
        assert!(validate_provider_page_token(Some("bad\n")).is_err());
    }

    #[test]
    fn gmail_pages_preserve_tokens_and_reject_incomplete_metadata() {
        let list: GmailMessageList =
            serde_json::from_str(r#"{"messages":[{"id":"abc123"}],"nextPageToken":"next"}"#)
                .unwrap();
        let (ids, next) = validate_gmail_listing(list, 25, None).unwrap();
        assert_eq!(ids, vec!["abc123"]);
        assert_eq!(next.as_deref(), Some("next"));
        for body in [
            r#"{"messages":[{}]}"#,
            r#"{"messages":[{"id":"a"},{"id":"a"}]}"#,
            r#"{"messages":[{"id":"../a"}]}"#,
            r#"{"messages":[],"nextPageToken":"same"}"#,
        ] {
            assert!(
                validate_gmail_listing(serde_json::from_str(body).unwrap(), 25, Some("same"))
                    .is_err()
            );
        }
        assert!(validate_gmail_list_request("q", 0, None).is_err());
        assert!(validate_gmail_list_request("q", 51, None).is_err());
        assert!(validate_gmail_list_request("q\n", 25, None).is_err());
    }

    #[test]
    fn gmail_provider_mime_type_maps_the_actual_json_field() {
        let payload: GmailPayload = serde_json::from_str(
            r#"{"mimeType":"multipart/alternative","parts":[{"mimeType":"text/plain","body":{"data":"aGVsbG8"}}]}"#,
        )
        .unwrap();
        assert!(matches!(
            find_body_source(&payload, "text/plain"),
            Some(GmailBodySource::Inline("aGVsbG8"))
        ));
    }

    #[test]
    fn stored_tokens_reject_invalid_public_configuration_and_secret_shapes() {
        assert!(validate_google_client_id("123-public.apps.googleusercontent.com").is_ok());
        assert!(validate_google_client_id("client\nheader").is_err());
        assert!(validate_google_client_id(&"x".repeat(513)).is_err());
        let valid = r#"{"client_id":"123-public.apps.googleusercontent.com","access_token":"access","refresh_token":"refresh","expiry_ms":1,"email":"writer@example.com"}"#;
        assert!(parse_stored_tokens(valid).is_ok());
        assert!(parse_stored_tokens(&valid.replace("\"access\"", "\"\"")).is_err());
        assert!(parse_stored_tokens(&valid.replace("writer@example.com", "")).is_err());
        assert!(parse_stored_tokens(&"x".repeat(16 * 1024 + 1)).is_err());
    }

    #[test]
    fn task_batches_reject_malformed_later_mutations_before_provider_work() {
        let valid: GoogleTaskSyncMutation = serde_json::from_str(
            r#"{"kind":"create","title":"Reviewed task","notes":"source marker","due":"2026-10-08T00:00:00Z"}"#,
        )
        .unwrap();
        assert!(validate_task_sync_mutation(&valid).is_ok());
        let valid_update: GoogleTaskSyncMutation = serde_json::from_str(
            r#"{"kind":"update","taskId":"a","etag":"W/123","title":"A","notes":"B"}"#,
        ).unwrap();
        let valid_complete: GoogleTaskSyncMutation = serde_json::from_str(
            r#"{"kind":"complete","taskId":"a","etag":"W/123"}"#,
        ).unwrap();
        assert!(validate_task_sync_mutation(&valid_update).is_ok());
        assert!(validate_task_sync_mutation(&valid_complete).is_ok());
        assert!(validate_task_etag("bad\nheader").is_err());
        for invalid in [
            r#"{"kind":"update","taskId":"a","title":"injected\nheader"}"#,
            r#"{"kind":"create","title":"A","due":"tomorrow"}"#,
            r#"{"kind":"update","taskId":"a","title":"A","notes":"B"}"#,
            r#"{"kind":"complete","taskId":"a"}"#,
            r#"{"kind":"update","taskId":"a","title":"A","status":"unknown"}"#,
            r#"{"kind":"complete","taskId":""}"#,
            r#"{"kind":"delete","taskId":"a"}"#,
        ] {
            let invalid: GoogleTaskSyncMutation = serde_json::from_str(invalid).unwrap();
            assert!(
                [&valid, &invalid]
                    .into_iter()
                    .try_for_each(validate_task_sync_mutation)
                    .is_err()
            );
        }
        assert!(validate_task_fields("A", Some(&"x".repeat(32 * 1024 + 1)), None, None).is_err());
        assert!(validate_task_fields(&"x".repeat(1025), None, None, None).is_err());
        assert!(validate_task_fields("A", Some(&"x".repeat(8193)), None, None).is_err());
        assert!(
            validate_task_fields(&"🦀".repeat(1024), Some(&"🦀".repeat(8192)), None, None,).is_ok()
        );
    }

    #[test]
    fn provider_task_sets_do_not_invent_missing_identity_or_status() {
        for body in [
            r#"{"title":"A","status":"needsAction"}"#,
            r#"{"id":"a","title":"A"}"#,
            r#"{"id":"a","title":"A","status":"unknown"}"#,
        ] {
            assert!(validate_provider_task(serde_json::from_str(body).unwrap()).is_err());
        }
        assert!(
            validate_provider_task(
                serde_json::from_str(r#"{"id":"a","title":"A","status":"completed"}"#).unwrap()
            )
            .is_ok()
        );
    }

    #[test]
    fn provider_http_expiry_and_response_bounds_are_explicit() {
        assert!(
            provider_failure(reqwest::StatusCode::UNAUTHORIZED, "Calendar")
                .starts_with(GOOGLE_AUTH_REQUIRED_PREFIX)
        );
        assert!(
            !provider_failure(reqwest::StatusCode::FORBIDDEN, "Calendar")
                .starts_with(GOOGLE_AUTH_REQUIRED_PREFIX)
        );
        assert!(
            read_provider_json::<GmailMessageList>(
                std::io::Cursor::new(vec![b' '; GOOGLE_PROVIDER_PAGE_MAX_BYTES as usize + 1]),
                "Gmail"
            )
            .is_err()
        );
    }

    #[test]
    fn refresh_reconnect_requires_explicit_permanent_oauth_error() {
        for body in [
            br#"{"error":"temporarily_unavailable"}"#.as_slice(),
            br#"{"error":{"message":"invalid_grant"}}"#,
            br#"{"error":42}"#,
            b"invalid_grant",
            b"",
        ] {
            assert!(
                !refresh_failure(reqwest::StatusCode::BAD_REQUEST, body)
                    .starts_with(GOOGLE_AUTH_REQUIRED_PREFIX)
            );
        }
        for error in ["invalid_grant", "invalid_client"] {
            let body = format!("{{\"error\":\"{error}\"}}");
            assert!(
                refresh_failure(reqwest::StatusCode::BAD_REQUEST, body.as_bytes())
                    .starts_with(GOOGLE_AUTH_REQUIRED_PREFIX)
            );
            for status in [
                reqwest::StatusCode::TOO_MANY_REQUESTS,
                reqwest::StatusCode::SERVICE_UNAVAILABLE,
            ] {
                assert!(
                    !refresh_failure(status, body.as_bytes())
                        .starts_with(GOOGLE_AUTH_REQUIRED_PREFIX)
                );
            }
        }
        assert!(
            !refresh_failure(
                reqwest::StatusCode::BAD_REQUEST,
                br#"{"error_description":"private-token-value"}"#
            )
            .contains("private-token-value")
        );
    }

    #[test]
    fn token_responses_are_bounded_and_reject_invalid_lifetimes() {
        assert!(read_token_body(std::io::Cursor::new(vec![b'x'; 16 * 1024 + 1])).is_err());
        assert_eq!(
            read_token_body(std::io::Cursor::new(vec![b'x'; 16 * 1024]))
                .unwrap()
                .len(),
            16 * 1024
        );
        assert_eq!(token_expiry_ms(100, None).unwrap(), 3_600_100);
        assert!(token_expiry_ms(100, Some(0)).is_err());
        assert!(token_expiry_ms(100, Some(u64::MAX)).is_err());
        assert!(token_expiry_ms(u64::MAX, Some(1)).is_err());
        assert!(parse_token_body(br#"{"access_token":"","expires_in":3600}"#).is_err());
        assert!(parse_token_body(br#"{"access_token":"token\nvalue"}"#).is_err());
        assert!(parse_token_body(br#"{"access_token":"valid","expires_in":3600}"#).is_ok());
    }

    #[test]
    fn base64url_matches_known_vector() {
        assert_eq!(base64url_encode(b""), "");
        assert_eq!(base64url_encode(b"f"), "Zg");
        assert_eq!(base64url_encode(b"fo"), "Zm8");
        assert_eq!(base64url_encode(b"foo"), "Zm9v");
    }

    #[test]
    fn parses_code_and_state_from_request_line() {
        let parsed = parse_redirect_query("GET /?code=abc123&state=xyz HTTP/1.1");
        assert_eq!(parsed.code.as_deref(), Some("abc123"));
        assert_eq!(parsed.state.as_deref(), Some("xyz"));
        assert_eq!(parsed.error, None);
    }

    #[test]
    fn parses_oauth_denial_without_waiting_for_a_code() {
        let parsed = parse_redirect_query(
            "GET /?error=access_denied&error_description=User+cancelled&state=xyz HTTP/1.1",
        );
        assert_eq!(parsed.error.as_deref(), Some("access_denied"));
        assert_eq!(parsed.error_description.as_deref(), Some("User cancelled"));
        assert_eq!(parsed.state.as_deref(), Some("xyz"));
        assert_eq!(parsed.code, None);
    }

    #[test]
    fn percent_decode_handles_encoded_bytes() {
        assert_eq!(percent_decode("a%2Fb"), "a/b");
        assert_eq!(percent_decode("a+b"), "a b");
        assert_eq!(percent_decode("%F0%9F%92%A9"), "💩");
        assert_eq!(percent_decode("%é"), "%é");
    }

    #[test]
    fn resolve_datetime_prefers_datetime_then_date() {
        let (value, all_day) = resolve_datetime(Some(EventDateTime {
            date_time: Some("2026-01-01T10:00:00Z".into()),
            date: None,
        }));
        assert_eq!(value, "2026-01-01T10:00:00Z");
        assert!(!all_day);

        let (value, all_day) = resolve_datetime(Some(EventDateTime {
            date_time: None,
            date: Some("2026-01-01".into()),
        }));
        assert_eq!(value, "2026-01-01");
        assert!(all_day);
    }

    #[test]
    fn task_sync_scope_discloses_batch_size() {
        assert_eq!(google_task_sync_scope(1), "Sync 1 vault task changes");
        assert_eq!(google_task_sync_scope(42), "Sync 42 vault task changes");
    }

    #[test]
    fn task_sync_mutation_accepts_camel_case_task_id() {
        let mutation: GoogleTaskSyncMutation = serde_json::from_str(
            r#"{"kind":"update","taskId":"remote-1","title":"Renamed","notes":"marker","status":"needsAction"}"#,
        )
        .expect("task sync mutation");
        assert_eq!(mutation.kind, "update");
        assert_eq!(mutation.task_id.as_deref(), Some("remote-1"));
        assert_eq!(mutation.status.as_deref(), Some("needsAction"));
    }

    #[test]
    fn calendar_event_list_response_preserves_provider_page_token() {
        let parsed: GcalEventList = serde_json::from_str(
            r#"{"items":[{"id":"e1","summary":"One"}],"nextPageToken":"next-events"}"#,
        )
        .expect("event list response");
        assert_eq!(parsed.items.as_ref().map(Vec::len), Some(1));
        assert_eq!(parsed.next_page_token.as_deref(), Some("next-events"));
    }

    #[test]
    fn task_list_response_preserves_provider_page_token() {
        let parsed: GTaskList = serde_json::from_str(
            r#"{"items":[{"id":"t1","title":"One"}],"nextPageToken":"next-123"}"#,
        )
        .expect("task list response");
        assert_eq!(parsed.items.as_ref().map(Vec::len), Some(1));
        assert_eq!(parsed.next_page_token.as_deref(), Some("next-123"));
    }

    #[test]
    fn gmail_message_ids_reject_path_and_query_injection() {
        assert!(validate_gmail_message_id("18f4_abc-123").is_ok());
        assert!(validate_gmail_message_id("../inbox").is_err());
        assert!(validate_gmail_message_id("message?format=raw").is_err());
        assert!(validate_gmail_message_id("").is_err());
    }

    #[test]
    fn calendar_resource_ids_are_bounded_and_reject_whitespace() {
        assert!(validate_calendar_id("primary").is_ok());
        assert!(validate_calendar_id("writer@example.com").is_ok());
        assert!(validate_task_list_id("MDQxMjM0NTY3ODkw").is_ok());
        assert!(validate_calendar_id("").is_err());
        assert!(validate_calendar_id("team calendar").is_err());
        assert!(validate_task_list_id("list\nheader").is_err());
        assert!(validate_task_list_id(&"x".repeat(256)).is_err());
    }

    #[test]
    fn gmail_body_decoding_accepts_url_safe_unpadded_data() {
        assert_eq!(base64url_decode("aGVsbG8td29ybGQ").unwrap(), b"hello-world");
    }

    #[test]
    fn gmail_header_matching_is_case_insensitive() {
        let headers = vec![GmailHeader {
            name: Some("sUbJeCt".into()),
            value: Some("A mail subject".into()),
        }];
        assert_eq!(gmail_header(&headers, "Subject"), "A mail subject");
    }

    #[test]
    fn gmail_batch_uses_documented_discovery_path() {
        assert_eq!(
            GMAIL_BATCH_ENDPOINT,
            "https://gmail.googleapis.com/batch/gmail/v1"
        );
    }

    #[test]
    fn gmail_batch_body_has_one_http_part_per_message() {
        let ids = vec!["18f4a".to_string(), "18f4b".to_string()];
        let (boundary, body) = gmail_batch_request_body(&ids).expect("body");
        assert!(boundary.starts_with("scriptor_batch_"));
        assert_eq!(
            body.matches("GET /gmail/v1/users/me/messages/18f4a?format=metadata")
                .count(),
            1
        );
        assert_eq!(
            body.matches("GET /gmail/v1/users/me/messages/18f4b?format=metadata")
                .count(),
            1
        );
        assert_eq!(body.matches("Content-ID: <scriptor+").count(), 2);
        assert!(body.contains(&format!("--{boundary}--")));
        assert!(gmail_batch_request_body(&["../inbox".to_string()]).is_err());
    }

    #[test]
    fn gmail_batch_response_maps_parts_by_content_id_echo() {
        let boundary = "scriptor_batch_test";
        let payload = format!(
            "Preamble ignored.\r\n--{boundary}\r\nContent-Type: application/http\r\nContent-ID: <response-scriptor+1>\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{{\"id\":\"b\",\"threadId\":\"tb\",\"snippet\":\"second\"}}\r\n--{boundary}\r\nContent-Type: application/http\r\nContent-ID: <response-scriptor+0>\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{{\"id\":\"a\",\"threadId\":\"ta\",\"snippet\":\"first\"}}\r\n--{boundary}--\r\n"
        );
        let messages = gmail_parse_batch_response(&payload, boundary, 2).expect("parsed");
        assert_eq!(messages[0].id.as_deref(), Some("a"));
        assert_eq!(messages[1].id.as_deref(), Some("b"));
    }

    #[test]
    fn gmail_batch_response_rejects_failing_or_missing_parts() {
        let boundary = "scriptor_batch_test";
        let failing = format!(
            "--{boundary}\r\nContent-ID: <response-scriptor+0>\r\n\r\nHTTP/1.1 404 Not Found\r\n\r\n{{\"error\":{{\"code\":404}}}}\r\n--{boundary}--\r\n"
        );
        assert!(gmail_parse_batch_response(&failing, boundary, 1).is_err());

        let missing = format!(
            "--{boundary}\r\nContent-ID: <response-scriptor+0>\r\n\r\nHTTP/1.1 200 OK\r\n\r\n{{\"id\":\"a\"}}\r\n--{boundary}--\r\n"
        );
        assert!(gmail_parse_batch_response(&missing, boundary, 2).is_err());
    }

    #[test]
    fn multipart_boundary_extraction_handles_quoted_parameters() {
        assert_eq!(
            parse_multipart_boundary("multipart/mixed; boundary=batch_abc; charset=utf-8"),
            Some("batch_abc".to_string())
        );
        assert_eq!(
            parse_multipart_boundary("multipart/mixed; boundary=\"quoted-name\""),
            Some("quoted-name".to_string())
        );
        assert_eq!(parse_multipart_boundary("application/json"), None);
    }

    #[test]
    fn gmail_body_source_finds_inline_plain_text() {
        let payload = GmailPayload {
            headers: None,
            mime_type: Some("multipart/alternative".into()),
            body: None,
            parts: Some(vec![GmailPayload {
                headers: None,
                mime_type: Some("text/plain".into()),
                body: Some(GmailBody {
                    data: Some("aGVsbG8".into()),
                    attachment_id: None,
                }),
                parts: None,
            }]),
        };
        assert_eq!(
            find_body_source(&payload, "text/plain"),
            Some(GmailBodySource::Inline("aGVsbG8"))
        );
    }

    #[test]
    fn gmail_body_source_finds_attachment_backed_plain_text() {
        let payload = GmailPayload {
            headers: None,
            mime_type: Some("text/plain".into()),
            body: Some(GmailBody {
                data: None,
                attachment_id: Some("ANGjdJ8_attachment".into()),
            }),
            parts: None,
        };
        assert_eq!(
            find_body_source(&payload, "text/plain"),
            Some(GmailBodySource::Attachment("ANGjdJ8_attachment"))
        );
    }

    #[test]
    fn gmail_html_fallback_removes_markup_and_active_content() {
        let text = html_to_plain_text(
            "<html><style>.x{color:red}</style><body><p>Hello &amp; welcome</p><script>alert('x')</script><div>Second line</div></body></html>",
        );
        assert_eq!(text, "Hello & welcome\nSecond line");
        assert!(!text.contains("alert"));
        assert!(!text.contains("color:red"));
    }

    #[test]
    fn gmail_and_calendar_credentials_are_isolated() {
        assert_ne!(
            GMAIL_TOKEN_KEYCHAIN_ACCOUNT,
            CALENDAR_TOKEN_KEYCHAIN_ACCOUNT
        );
        assert!(GMAIL_OAUTH_SCOPES.contains("gmail.modify"));
        assert!(GMAIL_OAUTH_SCOPES.contains("gmail.send"));
        assert!(!GMAIL_OAUTH_SCOPES.contains("calendar"));
        assert!(!GMAIL_OAUTH_SCOPES.contains("tasks"));
    }
}
