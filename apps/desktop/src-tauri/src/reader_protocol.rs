use tauri::http::{header, Request, Response, StatusCode};

const READER_CSP: &str = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; frame-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

pub fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path().trim_start_matches('/');
    let (content_type, bytes): (&'static str, &'static [u8]) = match path {
        "pdf-viewer.html" => ("text/html; charset=utf-8", include_bytes!("../../../../public/reader/pdf-viewer.html")),
        "epub-viewer.html" => ("text/html; charset=utf-8", include_bytes!("../../../../public/reader/epub-viewer.html")),
        "vendor/pdf.min.mjs" => ("text/javascript; charset=utf-8", include_bytes!("../../../../public/reader/vendor/pdf.min.mjs")),
        "vendor/pdf.worker.min.mjs" => ("text/javascript; charset=utf-8", include_bytes!("../../../../public/reader/vendor/pdf.worker.min.mjs")),
        "vendor/epub.min.js" => ("text/javascript; charset=utf-8", include_bytes!("../../../../public/reader/vendor/epub.min.js")),
        _ => {
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .header("Content-Security-Policy", READER_CSP)
                .body(b"reader asset not found".to_vec())
                .expect("static reader 404 response");
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header("Content-Security-Policy", READER_CSP)
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "no-store")
        .body(bytes.to_vec())
        .expect("static reader asset response")
}
