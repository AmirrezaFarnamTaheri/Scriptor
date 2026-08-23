//! HTTP fetch stage for the capture pipeline.
//!
//! Uses `ureq` (blocking) to download a URL up to `max_bytes`. After the
//! download the actual URL (post-redirect) is returned alongside the raw HTML.
//! No subprocess, no headless browser.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FetchError {
    #[error("HTTP error {status}: {url}")]
    Http { status: u16, url: String },

    #[error("network error: {0}")]
    Network(String),

    #[error("response exceeded size limit of {limit} bytes")]
    TooLarge { limit: usize },

    #[error("content-type is not HTML: {content_type}")]
    NotHtml { content_type: String },
}

pub struct FetchOptions {
    pub max_bytes: usize,
    pub timeout_secs: u64,
}

pub struct FetchResponse {
    /// Final URL after any redirects.
    pub final_url: String,
    /// Raw (unsanitized) HTML body.
    pub html: String,
}

/// Download a URL and return the HTML body.
///
/// Uses the ureq 3 response APIs so redirects, status, headers, and bounded
/// body reads are handled from one response object. Returns `FetchError::NotHtml`
/// if the response content-type is not `text/html`.
pub fn fetch_html(url: &str, opts: &FetchOptions) -> Result<FetchResponse, FetchError> {
    use std::io::Read as _;
    use std::time::Duration;
    use ureq::ResponseExt as _;

    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(opts.timeout_secs)))
        .timeout_recv_body(Some(Duration::from_secs(opts.timeout_secs)))
        .timeout_connect(Some(Duration::from_secs(10)))
        .user_agent("Scriptor/1 (https://github.com/0xDAEF0F/scriptor)")
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);

    let mut response = agent
        .get(url)
        .call()
        .map_err(|error| FetchError::Network(error.to_string()))?;

    let status = response.status().as_u16();
    let final_url = response.get_uri().to_string();
    if !(200..300).contains(&status) {
        return Err(FetchError::Http {
            status,
            url: final_url,
        });
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let media_type = content_type.split(';').next().map(str::trim).unwrap_or("");
    if !media_type.eq_ignore_ascii_case("text/html") {
        return Err(FetchError::NotHtml {
            content_type: content_type.to_owned(),
        });
    }

    let mut body_bytes = Vec::with_capacity(opts.max_bytes.min(128 * 1024));
    let mut reader = response
        .body_mut()
        .as_reader()
        .take((opts.max_bytes as u64).saturating_add(1));
    reader
        .read_to_end(&mut body_bytes)
        .map_err(|error| FetchError::Network(error.to_string()))?;

    if body_bytes.len() > opts.max_bytes {
        return Err(FetchError::TooLarge {
            limit: opts.max_bytes,
        });
    }

    let html = String::from_utf8_lossy(&body_bytes).into_owned();

    Ok(FetchResponse { final_url, html })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn serve_once(response: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let address = listener.local_addr().expect("read test server address");
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });
        format!("http://{address}/capture-test")
    }

    fn options(max_bytes: usize) -> FetchOptions {
        FetchOptions {
            max_bytes,
            timeout_secs: 2,
        }
    }

    #[test]
    fn fetch_options_default_values_are_sane() {
        let opts = FetchOptions {
            max_bytes: 8 * 1024 * 1024,
            timeout_secs: 20,
        };
        assert!(opts.max_bytes > 0);
        assert!(opts.timeout_secs > 0);
    }

    #[test]
    fn fetch_html_accepts_parameterized_html() {
        let url = serve_once(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 9\r\nConnection: close\r\n\r\n<p>ok</p>",
        );
        let response = fetch_html(&url, &options(9)).expect("HTML response succeeds");
        assert_eq!(response.final_url, url);
        assert_eq!(response.html, "<p>ok</p>");
    }

    #[test]
    fn fetch_html_rejects_missing_or_non_html_content_type() {
        let missing =
            serve_once("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");
        assert!(matches!(
            fetch_html(&missing, &options(2)),
            Err(FetchError::NotHtml { .. })
        ));
        let json = serve_once(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
        );
        assert!(matches!(
            fetch_html(&json, &options(2)),
            Err(FetchError::NotHtml { .. })
        ));
    }

    #[test]
    fn fetch_html_enforces_the_byte_limit_and_status() {
        let oversized = serve_once(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 10\r\nConnection: close\r\n\r\n0123456789",
        );
        assert!(matches!(
            fetch_html(&oversized, &options(9)),
            Err(FetchError::TooLarge { limit: 9 })
        ));
        let missing =
            serve_once("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        assert!(matches!(
            fetch_html(&missing, &options(1)),
            Err(FetchError::Http { status: 404, .. })
        ));
    }
}
