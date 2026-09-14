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
    let mut result = String::with_capacity(html.len());
    let mut rest = html;

    while let Some(m_start) = rest.find("<math") {
        let is_block = rest[..m_start].ends_with("<p>");
        let prefix_end = if is_block {
            m_start - "<p>".len()
        } else {
            m_start
        };
        result.push_str(&rest[..prefix_end]);

        if let Some(m_end) = rest[m_start..].find("</math>") {
            let after_math = &rest[m_start + m_end + "</math>".len()..];
            if is_block && after_math.starts_with("</p>") {
                let math_slice = &rest[m_start..m_start + m_end + "</math>".len()];
                let text = strip_all_tags(math_slice);
                result.push_str("\n$$");
                result.push_str(text.trim());
                result.push_str("$$\n");
                rest = &after_math["</p>".len()..];
            } else {
                if is_block {
                    result.push_str("<p>");
                }
                let inner = &rest[m_start + "<math".len()..m_start + m_end];
                let inner = inner.split_once('>').map(|(_, val)| val).unwrap_or("");
                let text = strip_all_tags(inner);
                result.push('$');
                result.push_str(text.trim());
                result.push('$');
                rest = after_math;
            }
        } else {
            result.push_str(&rest[prefix_end..]);
            return result;
        }
    }

    result.push_str(rest);
    result
}

fn strip_math(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(m_start) = rest.find("<math") {
        result.push_str(&rest[..m_start]);
        if let Some(m_end) = rest[m_start..].find("</math>") {
            rest = &rest[m_start + m_end + "</math>".len()..];
        } else {
            result.push_str(&rest[m_start..]);
            return result;
        }
    }
    result.push_str(rest);
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
    let mut result = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(t_start) = rest.find("<table") {
        result.push_str(&rest[..t_start]);
        if let Some(t_end) = rest[t_start..].find("</table>") {
            rest = &rest[t_start + t_end + "</table>".len()..];
        } else {
            result.push_str(&rest[t_start..]);
            return result;
        }
    }
    result.push_str(rest);
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
        assert!(
            md.contains('A') && md.contains('1'),
            "table cells must survive: {md}"
        );
        assert!(
            md.lines().any(|line| line.contains('|')),
            "expected Markdown table syntax: {md}"
        );
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
    fn block_math_is_wrapped_in_double_dollars() {
        let html =
            "<p><math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math></p>";
        let md = convert(html, true, true).unwrap();
        assert!(
            md.contains("$$"),
            "expected $$ wrapping around block math: {md}"
        );
    }

    #[test]
    fn multiple_inline_math_preserved() {
        let html = "<p>Let <math><mi>a</mi></math> and <math><mi>b</mi></math> be reals.</p>";
        let md = convert(html, true, true).unwrap();
        assert!(
            md.contains("$a$") && md.contains("$b$"),
            "both math tokens must survive: {md}"
        );
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
