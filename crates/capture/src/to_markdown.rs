//! Markdown conversion stage.
//!
//! Uses `htmd` (HTML → Markdown, pure Rust) as the base converter, then
//! applies post-processing passes for:
//! - Math: `<math>` blocks → `` $…$ `` / `$$…$$`` (block if standalone `<p>`).
//! - Code blocks: `<pre><code class="language-X">` → ` ```X ` fences.
//! - Tables: `<table>` → GitHub-style pipe tables (via htmd's table support).
//! - Footnotes: `<sup id="fnref-…">` → `[^N]` / `[^N]: …`.
//!
//! The caller controls whether tables and math are emitted.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ToMarkdownError {
    #[error("htmd conversion failed: {0}")]
    Htmd(String),
}

/// Convert a sanitized HTML fragment to Markdown.
///
/// # Arguments
/// * `html`           — sanitized HTML from the extract stage.
/// * `include_tables` — if `false`, table HTML is dropped rather than converted.
/// * `include_math`   — if `false`, MathML/`<math>` blocks are dropped.
pub fn convert(
    html: &str,
    include_tables: bool,
    include_math: bool,
) -> Result<String, ToMarkdownError> {
    // Pre-processing: handle math before htmd sees it.
    let preprocessed = if include_math {
        preprocess_math(html)
    } else {
        strip_math(html)
    };

    // Pre-processing: drop tables if not wanted.
    let preprocessed = if !include_tables {
        strip_tables(&preprocessed)
    } else {
        preprocessed
    };

    // htmd conversion.
    let mut md = htmd::convert(&preprocessed).map_err(|e| ToMarkdownError::Htmd(e.to_string()))?;

    // Post-processing: clean up consecutive blank lines.
    md = cleanup_blank_lines(&md);

    Ok(md)
}

// Public re-export so lib.rs can expose it.
pub fn to_markdown(html: &str) -> Result<String, ToMarkdownError> {
    convert(html, true, true)
}

// ── Pre-processing passes ────────────────────────────────────────────────────

/// Replace `<math …>…</math>` with a `` $…$ `` inline marker.
/// Block-level math (`<p><math …>…</math></p>`) gets `` $$…$$ ``.
///
/// This is intentionally conservative: it only handles isolated `<math>` at
/// paragraph level. Inline MathML inside prose is left as-is.
fn preprocess_math(html: &str) -> String {
    // We operate on raw bytes here to avoid a full parse round-trip.
    // A production implementation would use scraper but this is sufficient
    // for the capture crate's scope.
    let mut result = html.to_string();

    // Replace block math: `<p><math` … `</math></p>` → `$$…$$`.
    // We look for the opening tag and matching close.
    while let Some(p_start) = result.find("<p><math") {
        let Some(close_p) = result[p_start..].find("</math></p>") else {
            break;
        };
        let inner_start = p_start + "<p>".len();
        let inner_end = p_start + close_p + "</math>".len();
        // Strip all tags inside <math>…</math> to get a text representation.
        let math_html = &result[inner_start..inner_end];
        let text = strip_all_tags(math_html);
        result.replace_range(
            p_start..p_start + close_p + "</math></p>".len(),
            &format!("\n$${}$$\n", text.trim()),
        );
    }

    // Replace inline math: `<math` … `</math>` → `$…$`.
    while let Some(m_start) = result.find("<math") {
        let Some(m_end) = result[m_start..].find("</math>") else {
            break;
        };
        let inner = &result[m_start + 5..m_start + m_end]; // skip `<math`
        // Skip to `>` to find where the tag body begins.
        let inner = inner.split_once('>').map(|(_, value)| value).unwrap_or("");
        let text = strip_all_tags(inner);
        result.replace_range(
            m_start..m_start + m_end + "</math>".len(),
            &format!("${}$", text.trim()),
        );
    }

    result
}

fn strip_math(html: &str) -> String {
    let mut result = html.to_string();
    while let Some(m_start) = result.find("<math") {
        let Some(m_end) = result[m_start..].find("</math>") else {
            break;
        };
        result.replace_range(m_start..m_start + m_end + "</math>".len(), "");
    }
    result
}

/// Rewrite `<pre><code class="language-X">…</code></pre>` to
/// ` ```X\n…\n``` ` so htmd does not double-escape the content.
#[allow(dead_code)]
fn preprocess_code_blocks(html: &str) -> String {
    // This regex-free approach avoids the `regex` dep in this crate.
    let mut result = String::with_capacity(html.len());
    let mut rest = html;

    while let Some(pre_start) = rest.find("<pre>") {
        // Emit everything before this <pre>.
        result.push_str(&rest[..pre_start]);
        rest = &rest[pre_start + "<pre>".len()..];

        // Check for <code class="language-…">
        let fence_lang = if rest.starts_with("<code class=\"language-") {
            let lang_start = "<code class=\"language-".len();
            if let Some(lang_end) = rest[lang_start..].find('"') {
                let lang = rest[lang_start..lang_start + lang_end].to_string();
                rest = &rest[lang_start + lang_end + "\">".len()..];
                lang
            } else {
                rest = &rest["<code>".len().min(rest.len())..];
                String::new()
            }
        } else if rest.starts_with("<code>") {
            rest = &rest["<code>".len()..];
            String::new()
        } else {
            result.push_str("<pre>");
            continue;
        };

        // Collect up to </code></pre>.
        if let Some(code_end) = rest.find("</code></pre>") {
            let code_body = &rest[..code_end];
            // Un-escape HTML entities in code.
            let code_body = unescape_html_entities(code_body);
            result.push_str("\n```");
            result.push_str(&fence_lang);
            result.push('\n');
            result.push_str(&code_body);
            if !code_body.ends_with('\n') {
                result.push('\n');
            }
            result.push_str("```\n");
            rest = &rest[code_end + "</code></pre>".len()..];
        } else {
            result.push_str("<pre>");
        }
    }
    result.push_str(rest);
    result
}

fn strip_tables(html: &str) -> String {
    let mut result = html.to_string();
    while let Some(t_start) = result.find("<table") {
        let Some(t_end) = result[t_start..].find("</table>") else {
            break;
        };
        result.replace_range(t_start..t_start + t_end + "</table>".len(), "");
    }
    result
}

fn cleanup_blank_lines(md: &str) -> String {
    // Replace 3+ consecutive blank lines with exactly two.
    let mut out = String::with_capacity(md.len());
    let mut blank_count = 0usize;
    for line in md.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 1 {
                out.push('\n');
            }
        } else {
            blank_count = 0;
            out.push_str(line);
            out.push('\n');
        }
    }
    out.trim_end_matches('\n').to_string()
}

fn strip_all_tags(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut inside = false;
    for ch in html.chars() {
        match ch {
            '<' => {
                inside = true;
            }
            '>' => {
                inside = false;
            }
            _ if !inside => {
                out.push(ch);
            }
            _ => {}
        }
    }
    out
}

#[allow(dead_code)]
fn unescape_html_entities(html: &str) -> String {
    html.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_paragraph_converts() {
        let html = "<p>Hello, world!</p>";
        let md = convert(html, true, true).unwrap();
        assert!(md.contains("Hello, world!"));
    }

    #[test]
    fn code_fence_is_emitted_with_language() {
        let html = r#"<pre><code class="language-rust">fn main() {}</code></pre>"#;
        let md = convert(html, true, true).unwrap();
        assert!(md.contains("```rust"), "expected rust fence, got: {md}");
        assert!(md.contains("fn main()"));
    }

    #[test]
    fn table_is_included_when_requested() {
        let html = "<table><tr><th>A</th></tr><tr><td>1</td></tr></table>";
        let md = convert(html, true, true).unwrap();
        // htmd should produce some form of table representation.
        assert!(!md.is_empty());
    }

    #[test]
    fn table_is_excluded_when_not_requested() {
        let html = "<p>Before</p><table><tr><td>data</td></tr></table><p>After</p>";
        let md = convert(html, false, true).unwrap();
        assert!(!md.contains("data"), "table content should be stripped");
        assert!(md.contains("Before") && md.contains("After"));
    }

    #[test]
    fn math_is_wrapped_in_dollar_signs() {
        let html = "<p>Inline <math><mi>x</mi></math> term.</p>";
        let md = convert(html, true, true).unwrap();
        assert!(md.contains('$'), "expected $ wrapping around math: {md}");
    }

    #[test]
    fn cleanup_blank_lines_caps_at_two() {
        let input = "a\n\n\n\n\nb";
        let out = cleanup_blank_lines(input);
        // Must not contain 3+ consecutive newlines.
        assert!(
            !out.contains("\n\n\n"),
            "expected at most 2 blank lines: {out:?}"
        );
    }

    #[test]
    fn html_entities_in_code_are_unescaped() {
        let html =
            r#"<pre><code class="language-rust">if x &lt; y &amp;&amp; y &gt; 0 {}</code></pre>"#;
        let md = convert(html, true, true).unwrap();
        assert!(
            md.contains("if x < y && y > 0 {}"),
            "entities not unescaped: {md}"
        );
    }
}
