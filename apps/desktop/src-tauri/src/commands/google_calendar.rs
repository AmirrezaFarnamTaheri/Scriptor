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

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Keychain account under which the token bundle JSON is stored.
const TOKEN_KEYCHAIN_ACCOUNT: &str = "google.calendar.tokens";
/// Broker scope shared by all task mutations.
const TASK_SCOPE: &str = "google-task";
/// Broker scope for the auth flow.
const AUTH_SCOPE: &str = "google-calendar-auth";

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT: &str = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_EVENTS_ENDPOINT: &str = "https://www.googleapis.com/calendar/v3/calendars";
const TASKS_ENDPOINT: &str = "https://tasks.googleapis.com/tasks/v1/lists";

/// `openid`/`email` are appended so the authed email can be resolved.
const OAUTH_SCOPES: &str = "openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks";

const HTTP_TIMEOUT_SECS: u64 = 30;
/// How long to wait for the browser redirect before giving up.
const AUTH_CAPTURE_TIMEOUT_SECS: u64 = 300;
/// Refresh the access token this many seconds before its stated expiry.
const EXPIRY_SKEW_SECS: u64 = 60;

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
    title: String,
    notes: Option<String>,
    status: String,
    due: Option<String>,
    completed: Option<String>,
    subtasks: Vec<GoogleTask>,
    from_vault: bool,
    source_path: Option<String>,
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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn load_tokens() -> Result<Option<StoredTokens>, String> {
    let raw = keychain_get(TOKEN_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())?;
    match raw.filter(|value| !value.is_empty()) {
        Some(json) => serde_json::from_str(&json)
            .map(Some)
            .map_err(|error| format!("failed to parse stored Google tokens: {error}")),
        None => Ok(None),
    }
}

fn save_tokens(tokens: &StoredTokens) -> Result<(), String> {
    let json = serde_json::to_string(tokens)
        .map_err(|error| format!("failed to serialize Google tokens: {error}"))?;
    keychain_set(TOKEN_KEYCHAIN_ACCOUNT, &json).map_err(|error| error.to_string())
}

fn require_tokens() -> Result<StoredTokens, String> {
    load_tokens()?.ok_or_else(|| "not authenticated with Google (no token)".to_string())
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
        // PROCESS_BROKER_EXCEPTION(oauth-browser-open-windows): fixed OS opener, URL-only argument.
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", "", url]);
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

/// Parse the `code` (and `state`) query parameters out of an HTTP request line
/// like `GET /?code=abc&state=xyz HTTP/1.1`.
fn parse_redirect_query(request_line: &str) -> (Option<String>, Option<String>) {
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        let decoded = percent_decode(value);
        match key {
            "code" => code = Some(decoded),
            "state" => state = Some(decoded),
            _ => {}
        }
    }
    (code, state)
}

fn percent_decode(value: &str) -> String {
    let bytes = value.replace('+', " ");
    let bytes = bytes.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(byte) = u8::from_str_radix(&value[i + 1..i + 3], 16)
        {
            out.push(byte);
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
        let (code, state) = parse_redirect_query(request_line);

        // Validate the state echo before composing the response so a bad
        // `state` yields an error page rather than the success page.
        let state_ok = state.as_deref() == Some(expected_state);
        let has_code = code
            .as_deref()
            .map(|value| !value.is_empty())
            .unwrap_or(false);

        let body = if state_ok && has_code {
            "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                <h2>Scriptor is now connected to Google.</h2>\
                <p>You can close this tab and return to the app.</p></body></html>"
        } else {
            "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                <h2>Authorization could not be completed.</h2>\
                <p>Please close this tab and try connecting again from the app.</p></body></html>"
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
        if has_code {
            return Ok(code.unwrap_or_default());
        }
        // Neither a usable code nor a state failure: keep waiting for the real
        // redirect (e.g. a favicon probe hit the loopback first).
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

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("failed to initialize Google HTTP client: {error}"))
}

/// Read a bounded slice of a failed response body so error messages carry the
/// provider's diagnostic (e.g. `invalid_grant`) without risking an unbounded
/// read. Returns a placeholder when the body is empty or unreadable.
fn bounded_error_body(response: reqwest::blocking::Response) -> String {
    const MAX_ERROR_BODY: usize = 512;
    match response.text() {
        Ok(body) => {
            let trimmed = body.trim();
            if trimmed.is_empty() {
                "<empty response body>".to_string()
            } else if trimmed.len() > MAX_ERROR_BODY {
                format!("{}…", &trimmed[..MAX_ERROR_BODY])
            } else {
                trimmed.to_string()
            }
        }
        Err(_) => "<unreadable response body>".to_string(),
    }
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
            "Google token exchange failed ({status}): {}",
            bounded_error_body(response)
        ));
    }
    response
        .json::<TokenResponse>()
        .map_err(|error| format!("Google returned an invalid token response: {error}"))
}

fn fetch_email(client: &reqwest::blocking::Client, access_token: &str) -> Result<String, String> {
    let response = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(access_token)
        .send()
        .map_err(|error| format!("failed to fetch Google account email: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to fetch Google account email ({status}): {}",
            bounded_error_body(response)
        ));
    }
    let info = response
        .json::<UserInfoResponse>()
        .map_err(|error| format!("Google returned an invalid userinfo response: {error}"))?;
    Ok(info.email.unwrap_or_default())
}

/// Return a currently-valid access token, refreshing it in place when expired.
fn refresh_if_needed(client: &reqwest::blocking::Client) -> Result<String, String> {
    let mut tokens = require_tokens()?;
    if now_ms() + EXPIRY_SKEW_SECS * 1000 < tokens.expiry_ms {
        return Ok(tokens.access_token);
    }
    let refresh_token = tokens
        .refresh_token
        .clone()
        .ok_or_else(|| "Google session expired and no refresh token is available".to_string())?;

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
        return Err(format!(
            "Google token refresh failed ({status}): {}",
            bounded_error_body(response)
        ));
    }
    let refreshed = response
        .json::<TokenResponse>()
        .map_err(|error| format!("Google returned an invalid refresh response: {error}"))?;

    tokens.access_token = refreshed.access_token.clone();
    tokens.expiry_ms = now_ms() + refreshed.expires_in.unwrap_or(3600) * 1000;
    if let Some(new_refresh) = refreshed.refresh_token {
        tokens.refresh_token = Some(new_refresh);
    }
    save_tokens(&tokens)?;
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
}

#[derive(Debug, Deserialize)]
struct GTask {
    id: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    status: Option<String>,
    due: Option<String>,
    completed: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GTaskList {
    items: Option<Vec<GTask>>,
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

/// Returns the datetime string and whether it is an all-day date.
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

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Run the OAuth2 PKCE loopback flow and persist the resulting tokens.
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
    )?;
    let _ = (&calendar_id, &task_list_id);

    if client_id.trim().is_empty() {
        return Err("Google OAuth client ID is required".into());
    }

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
        percent_encode(OAUTH_SCOPES),
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
        expiry_ms: now_ms() + token.expires_in.unwrap_or(3600) * 1000,
        email: email.clone(),
    };
    save_tokens(&tokens)?;
    Ok(email)
}

/// Best-effort token revocation followed by clearing the keychain entry.
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
    )?;
    if let Ok(Some(tokens)) = load_tokens()
        && let Ok(client) = http_client()
    {
        let _ = client
            .post(REVOKE_ENDPOINT)
            .form(&[("token", tokens.access_token.as_str())])
            .send();
    }
    keychain_delete(TOKEN_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())
}

/// List upcoming events within `lookahead_days`.
#[tauri::command]
pub fn google_calendar_list_events(
    calendar_id: String,
    lookahead_days: i64,
) -> Result<Vec<CalendarEvent>, String> {
    let client = http_client()?;
    let access_token = refresh_if_needed(&client)?;

    let now = chrono::Utc::now();
    let time_min = now.to_rfc3339();
    let time_max = (now + chrono::Duration::days(lookahead_days.max(0))).to_rfc3339();

    let url = format!(
        "{CALENDAR_EVENTS_ENDPOINT}/{}/events",
        percent_encode(&calendar_id)
    );
    let response = client
        .get(url)
        .bearer_auth(&access_token)
        .query(&[
            ("timeMin", time_min.as_str()),
            ("timeMax", time_max.as_str()),
            ("singleEvents", "true"),
            ("orderBy", "startTime"),
            ("maxResults", "250"),
        ])
        .send()
        .map_err(|error| format!("failed to list Google Calendar events: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to list Google Calendar events ({status}): {}",
            bounded_error_body(response)
        ));
    }
    let list = response
        .json::<GcalEventList>()
        .map_err(|error| format!("Google returned an invalid events response: {error}"))?;
    Ok(list
        .items
        .unwrap_or_default()
        .into_iter()
        .map(|event| map_event(event, &calendar_id))
        .collect())
}

/// List tasks in the given task list.
#[tauri::command]
pub fn google_calendar_list_tasks(task_list_id: String) -> Result<Vec<GoogleTask>, String> {
    let client = http_client()?;
    let access_token = refresh_if_needed(&client)?;

    let url = format!("{TASKS_ENDPOINT}/{}/tasks", percent_encode(&task_list_id));
    let response = client
        .get(url)
        .bearer_auth(&access_token)
        .query(&[("showCompleted", "true"), ("maxResults", "100")])
        .send()
        .map_err(|error| format!("failed to list Google Tasks: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to list Google Tasks ({status}): {}",
            bounded_error_body(response)
        ));
    }
    let list = response
        .json::<GTaskList>()
        .map_err(|error| format!("Google returned an invalid tasks response: {error}"))?;
    Ok(list
        .items
        .unwrap_or_default()
        .into_iter()
        .map(map_task)
        .collect())
}

/// Return the authenticated Google account email.
#[tauri::command]
pub fn google_calendar_get_authed_email() -> Result<String, String> {
    Ok(require_tokens()?.email)
}

/// Create a new task in the given task list.
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
    )?;
    if title.trim().is_empty() {
        return Err("task title is required".into());
    }

    let client = http_client()?;
    let access_token = refresh_if_needed(&client)?;

    let mut body = serde_json::Map::new();
    body.insert("title".into(), serde_json::Value::String(title));
    if let Some(notes) = notes.filter(|value| !value.is_empty()) {
        body.insert("notes".into(), serde_json::Value::String(notes));
    }
    if let Some(due) = due.filter(|value| !value.is_empty()) {
        body.insert("due".into(), serde_json::Value::String(due));
    }

    let url = format!("{TASKS_ENDPOINT}/{}/tasks", percent_encode(&task_list_id));
    let response = client
        .post(url)
        .bearer_auth(&access_token)
        .json(&serde_json::Value::Object(body))
        .send()
        .map_err(|error| format!("failed to create Google Task: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to create Google Task ({status}): {}",
            bounded_error_body(response)
        ));
    }
    let task = response
        .json::<GTask>()
        .map_err(|error| format!("Google returned an invalid task response: {error}"))?;
    Ok(map_task(task))
}

/// Mark a task as completed.
#[tauri::command]
pub fn google_calendar_complete_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    task_id: String,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
    )?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client)?;

    let url = format!(
        "{TASKS_ENDPOINT}/{}/tasks/{}",
        percent_encode(&task_list_id),
        percent_encode(&task_id)
    );
    let response = client
        .patch(url)
        .bearer_auth(&access_token)
        .json(&serde_json::json!({ "status": "completed" }))
        .send()
        .map_err(|error| format!("failed to complete Google Task: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to complete Google Task ({status}): {}",
            bounded_error_body(response)
        ));
    }
    Ok(())
}

/// Delete a task.
#[tauri::command]
pub fn google_calendar_delete_task(
    state: tauri::State<AppState>,
    task_list_id: String,
    task_id: String,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GoogleTaskWrite,
        Some(TASK_SCOPE),
    )?;
    let client = http_client()?;
    let access_token = refresh_if_needed(&client)?;

    let url = format!(
        "{TASKS_ENDPOINT}/{}/tasks/{}",
        percent_encode(&task_list_id),
        percent_encode(&task_id)
    );
    let response = client
        .delete(url)
        .bearer_auth(&access_token)
        .send()
        .map_err(|error| format!("failed to delete Google Task: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!(
            "failed to delete Google Task ({status}): {}",
            bounded_error_body(response)
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64url_matches_known_vector() {
        // "foobar" → sha256 base64url is a stable reference.
        assert_eq!(base64url_encode(b""), "");
        assert_eq!(base64url_encode(b"f"), "Zg");
        assert_eq!(base64url_encode(b"fo"), "Zm8");
        assert_eq!(base64url_encode(b"foo"), "Zm9v");
    }

    #[test]
    fn parses_code_and_state_from_request_line() {
        let (code, state) = parse_redirect_query("GET /?code=abc123&state=xyz HTTP/1.1");
        assert_eq!(code.as_deref(), Some("abc123"));
        assert_eq!(state.as_deref(), Some("xyz"));
    }

    #[test]
    fn percent_decode_handles_encoded_bytes() {
        assert_eq!(percent_decode("a%2Fb"), "a/b");
        assert_eq!(percent_decode("a+b"), "a b");
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
}
