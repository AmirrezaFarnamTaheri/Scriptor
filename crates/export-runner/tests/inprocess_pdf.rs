#![cfg(feature = "inprocess-pdf")]

use scriptor_export_runner::inprocess_pdf::{MAX_MARKDOWN_BYTES, PdfAsset, compile_markdown_pdf};

#[test]
fn produces_real_tagged_pdf_with_structured_markdown_and_no_external_tools() {
    let markdown = "# Research report\n\nA **strong** claim with *emphasis* and `code`.\n\n- Evidence one\n- Evidence two\n\n> A quotation.\n\n| Source | Result |\n| --- | --- |\n| Paper | Accepted |\n\n```rust\nfn main() {}\n```\n";
    let result = compile_markdown_pdf(markdown, Some("Offline report"), &[]).unwrap();
    assert!(result.bytes.starts_with(b"%PDF-"));
    assert!(result.bytes.len() > 2000);
    assert_eq!(result.page_count, 1);
    let pdf = String::from_utf8_lossy(&result.bytes);
    assert!(
        pdf.contains("/StructTreeRoot"),
        "PDF contains accessibility structure"
    );
    assert!(
        pdf.contains("/Outlines"),
        "Markdown headings become PDF outline entries"
    );
    assert!(
        pdf.contains("/Font"),
        "Text uses embedded fonts rather than a screenshot"
    );
    assert_eq!(
        result.bytes,
        compile_markdown_pdf(markdown, Some("Offline report"), &[])
            .unwrap()
            .bytes
    );
    if let Some(path) = std::env::var_os("SCRIPTOR_INPROCESS_PDF_ARTIFACT") {
        // Opt-in verification artifact; ordinary tests remain filesystem-free.
        std::fs::write(path, &result.bytes).unwrap();
    }
}

#[test]
fn rejects_remote_and_missing_images_without_fetching_or_fallback() {
    assert!(
        compile_markdown_pdf("![private](https://example.com/private.png)", None, &[]).is_err()
    );
    assert!(compile_markdown_pdf("![missing](assets/missing.png)", None, &[]).is_err());
    assert!(
        compile_markdown_pdf(
            "![svg](x.svg)",
            None,
            &[PdfAsset {
                path: "x.svg".into(),
                bytes: b"<svg/>".to_vec()
            }]
        )
        .is_err()
    );
}

#[test]
fn rejects_oversized_input_before_compiling() {
    assert!(compile_markdown_pdf(&"x".repeat(MAX_MARKDOWN_BYTES + 1), None, &[]).is_err());
}

#[test]
fn treats_authored_typst_and_html_as_inert_text() {
    let result = compile_markdown_pdf(
        "#read(\"/private/secrets\")\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))",
        None,
        &[],
    )
    .unwrap();
    assert!(result.bytes.starts_with(b"%PDF-"));
    assert!(!String::from_utf8_lossy(&result.bytes).contains("/JavaScript"));
}

fn single_pixel_png() -> Vec<u8> {
    fn chunk(output: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
        output.extend_from_slice(&(data.len() as u32).to_be_bytes());
        output.extend_from_slice(kind);
        output.extend_from_slice(data);
        let mut crc = !0u32;
        for byte in kind.iter().chain(data) {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = (crc >> 1) ^ (0xedb88320 & 0u32.wrapping_sub(crc & 1));
            }
        }
        output.extend_from_slice(&(!crc).to_be_bytes());
    }
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    chunk(&mut png, b"IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
    // One uncompressed zlib block, filter byte then one red RGB pixel.
    chunk(
        &mut png,
        b"IDAT",
        &[
            0x78, 0x01, 0x01, 4, 0, 0xfb, 0xff, 0, 0xff, 0, 0, 0x03, 0x01, 0x01, 0x00,
        ],
    );
    chunk(&mut png, b"IEND", &[]);
    png
}

#[test]
fn embeds_only_the_supplied_local_image_snapshot() {
    let assets = [PdfAsset {
        path: "assets/red.png".into(),
        bytes: single_pixel_png(),
    }];
    let document = compile_markdown_pdf(
        "# Image evidence\n\n![Red pixel](assets/red.png)",
        None,
        &assets,
    )
    .unwrap();
    assert!(String::from_utf8_lossy(&document.bytes).contains("/Image"));
    assert!(document.page_count >= 1);
}

#[test]
fn paginates_long_form_prose_and_omits_yaml_frontmatter() {
    let prose = "A research paragraph with evidence and careful argument. ".repeat(20);
    let markdown = format!(
        "---\nprivate-metadata: omitted\n---\n\n# Long report\n\n{}",
        format!("{prose}\n\n").repeat(30)
    );
    let document = compile_markdown_pdf(&markdown, None, &[]).unwrap();
    assert!(document.page_count > 1);
    assert!(document.bytes.len() > 4000);
}
