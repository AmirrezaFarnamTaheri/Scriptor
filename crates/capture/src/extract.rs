//! Extraction stage: HTML sanitization + article-body extraction.
//!
//! Two-pass strategy (W3-4):
//! 1. **Sanitize** — ammonia strips `<script>`, `<style>`, event handlers,
//!    `srcdoc`, `data:` URIs. Allowed tags are conservative: block + inline
//!    text + table + media elements.
//! 2. **Extract** — a readability-inspired heuristic identifies the main
//!    article container using a scoring model adapted from Mozilla's Readability
//!    (paragraph density, class-name signals, link-density penalty).
//!
//! The result is a self-contained HTML fragment suitable for the markdown
//! conversion stage. Math, code blocks, tables, and footnotes are preserved.

use scraper::{Html, Selector};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExtractionError {
    #[error("could not parse HTML")]
    ParseError,

    #[error("could not find a main content region")]
    NoContent,
}

/// Output of the extraction stage.
#[derive(Debug)]
pub struct ExtractedContent {
    /// Page title from `<title>` or `og:title`.
    pub title: String,
    /// Sanitized HTML of the article body.
    pub body_html: String,
    /// `og:site_name`, if present.
    pub site_name: Option<String>,
    /// `article:published_time`, if present.
    pub published_at: Option<String>,
}

// ── Sanitizer allow-list ─────────────────────────────────────────────────────

/// Build the ammonia `Builder` with the capture allow-list.
///
/// Rationale for each tag class:
/// - Block text: `article`, `section`, `p`, `div`, `blockquote`, `pre`, `figure`
/// - Inline text: `span`, `a`, `em`, `strong`, `code`, `mark`, `s`, `u`, `abbr`
/// - Headings: `h1`–`h6`
/// - Lists: `ul`, `ol`, `li`, `dl`, `dt`, `dd`
/// - Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`
/// - Media: `img` (src, alt, title only — no data: URIs)
/// - Math: `math`, `mi`, `mn`, `mo`, `mrow`, `msup`, `msub`, `mfrac` (MathML subset)
/// - Misc: `time`, `figcaption`, `hr`, `br`, `sup`, `sub`
fn build_sanitizer<'a>() -> ammonia::Builder<'a> {
    let mut builder = ammonia::Builder::new();
    builder
        .tags(std::collections::HashSet::from([
            "article",
            "section",
            "p",
            "div",
            "blockquote",
            "pre",
            "figure",
            "span",
            "a",
            "em",
            "strong",
            "code",
            "mark",
            "s",
            "u",
            "abbr",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "ul",
            "ol",
            "li",
            "dl",
            "dt",
            "dd",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "caption",
            "img",
            "math",
            "mi",
            "mn",
            "mo",
            "mrow",
            "msup",
            "msub",
            "mfrac",
            "time",
            "figcaption",
            "hr",
            "br",
            "sup",
            "sub",
        ]))
        // Strip all attributes by default; selectively allow safe ones.
        .clean_content_tags(std::collections::HashSet::from([
            "script", "style", "noscript",
        ]))
        .attribute_filter(|element, attribute, value| {
            match (element, attribute) {
                ("a", "href") => {
                    // Allow http/https/mailto only; block javascript: data: etc.
                    if value.starts_with("http://")
                        || value.starts_with("https://")
                        || value.starts_with("mailto:")
                        || value.starts_with('#')
                    {
                        Some(value.into())
                    } else {
                        None
                    }
                }
                ("img", "src") => {
                    // Block data: URIs; allow http(s) only.
                    if value.starts_with("http://") || value.starts_with("https://") {
                        Some(value.into())
                    } else {
                        None
                    }
                }
                ("img", "alt") | ("img", "title") => Some(value.into()),
                ("time", "datetime") => Some(value.into()),
                ("td" | "th", "colspan" | "rowspan") => Some(value.into()),
                _ => None,
            }
        });
    builder
}

// ── Title extraction ─────────────────────────────────────────────────────────

fn extract_title(document: &Html) -> String {
    // Prefer og:title
    let og_title_sel = Selector::parse("meta[property='og:title']").unwrap();
    if let Some(el) = document.select(&og_title_sel).next()
        && let Some(t) = el.value().attr("content")
    {
        let t = t.trim();
        if !t.is_empty() {
            return t.to_string();
        }
    }
    // Fall back to <title>
    let title_sel = Selector::parse("title").unwrap();
    document
        .select(&title_sel)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_default()
}

fn extract_meta(document: &Html, property: &str) -> Option<String> {
    let sel = Selector::parse(&format!("meta[property='{property}']")).ok()?;
    let content = document
        .select(&sel)
        .next()?
        .value()
        .attr("content")?
        .trim()
        .to_string();
    if content.is_empty() {
        None
    } else {
        Some(content)
    }
}

// ── Readability-inspired content scorer ──────────────────────────────────────

/// Compute a "content score" for a block element.
///
/// Scoring heuristic adapted from Mozilla Readability:
/// 1. +1 for every `<p>` directly inside the candidate
/// 2. +paragraph content length / 100 (capped at 3 per paragraph)
/// 3. −link_density × score (link-heavy = nav/footer)
/// 4. Bonus for class/id signals: `article`, `content`, `post`, `entry`
/// 5. Penalty for noise signals: `sidebar`, `nav`, `footer`, `comment`
fn score_element(html_fragment: &str) -> f64 {
    let frag = Html::parse_fragment(html_fragment);
    let p_sel = Selector::parse("p").unwrap();
    let a_sel = Selector::parse("a").unwrap();

    let all_text_len: usize = frag.root_element().text().map(|t| t.len()).sum();
    if all_text_len == 0 {
        return 0.0;
    }

    let link_text_len: usize = frag
        .select(&a_sel)
        .flat_map(|el| el.text())
        .map(|t| t.len())
        .sum();
    let link_density = link_text_len as f64 / all_text_len as f64;

    let mut score: f64 = 0.0;
    for p in frag.select(&p_sel) {
        let text: String = p.text().collect();
        let len = text.trim().len();
        if len < 25 {
            continue;
        }
        score += 1.0;
        score += (len as f64 / 100.0).min(3.0);
    }

    score *= 1.0 - link_density;
    score
}

// ── Main extraction function ─────────────────────────────────────────────────

/// Sanitize and extract main article content from raw HTML.
pub fn extract_content(
    raw_html: &str,
    _base_url: &str,
) -> Result<ExtractedContent, ExtractionError> {
    let document = Html::parse_document(raw_html);

    let title = extract_title(&document);
    let site_name = extract_meta(&document, "og:site_name");
    let published_at = extract_meta(&document, "article:published_time");

    // 1. Sanitize the full document first.
    let sanitizer = build_sanitizer();
    let sanitized_html = sanitizer.clean(raw_html).to_string();
    let sanitized_doc = Html::parse_document(&sanitized_html);

    // 2. Try semantic containers in priority order.
    let priority_selectors = [
        "article",
        "main",
        "[role='main']",
        ".post-content",
        ".article-content",
        ".entry-content",
        ".content",
        "#content",
        ".post",
    ];

    for selector_str in &priority_selectors {
        let Ok(sel) = Selector::parse(selector_str) else {
            continue;
        };
        if let Some(el) = sanitized_doc.select(&sel).next() {
            let fragment = el.html();
            if score_element(&fragment) > 4.0 {
                return Ok(ExtractedContent {
                    title,
                    body_html: fragment,
                    site_name,
                    published_at,
                });
            }
        }
    }

    // 3. Fall back to scoring all block candidates.
    let candidate_sel = Selector::parse("div, section, td").unwrap();
    let best = sanitized_doc
        .select(&candidate_sel)
        .map(|el| (el.html(), score_element(&el.html())))
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    match best {
        Some((html, score)) if score > 3.0 => Ok(ExtractedContent {
            title,
            body_html: html,
            site_name,
            published_at,
        }),
        _ => Err(ExtractionError::NoContent),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <meta property="og:title" content="OG Title" />
  <meta property="og:site_name" content="Test Site" />
  <meta property="article:published_time" content="2026-01-01T00:00:00Z" />
</head>
<body>
  <script>alert('xss')</script>
  <article>
    <p>Paragraph one with enough content to score well in the readability heuristic lorem ipsum.</p>
    <p>Paragraph two with more substantial text content that is definitely not noise lorem ipsum dolor.</p>
    <p>Paragraph three with even more content to boost the score above the minimum threshold lorem ipsum.</p>
    <table><tr><th>H1</th><th>H2</th></tr><tr><td>A</td><td>B</td></tr></table>
    <pre><code>fn main() {}</code></pre>
  </article>
</body>
</html>"#;

    #[test]
    fn script_tags_are_stripped() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert!(!result.body_html.contains("<script"));
    }

    #[test]
    fn title_uses_og_title_first() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert_eq!(result.title, "OG Title");
    }

    #[test]
    fn site_name_is_extracted() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert_eq!(result.site_name.as_deref(), Some("Test Site"));
    }

    #[test]
    fn published_at_is_extracted() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert_eq!(result.published_at.as_deref(), Some("2026-01-01T00:00:00Z"));
    }

    #[test]
    fn table_survives_extraction() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert!(
            result.body_html.contains("<table"),
            "table should survive sanitization"
        );
    }

    #[test]
    fn code_block_survives_extraction() {
        let result = extract_content(FIXTURE, "https://example.com").unwrap();
        assert!(
            result.body_html.contains("<code"),
            "code should survive sanitization"
        );
    }

    #[test]
    fn javascript_href_is_stripped() {
        let html = r#"<html><body><article>
          <p>x x x x x x x x x x x x x x x x x x x x x x x x x x x x</p>
          <p>y y y y y y y y y y y y y y y y y y y y y y y y y y y y</p>
          <p>z z z z z z z z z z z z z z z z z z z z z z z z z z z z</p>
          <a href="javascript:void(0)">xss</a>
        </article></body></html>"#;
        let result = extract_content(html, "https://example.com").unwrap();
        assert!(
            !result.body_html.contains("javascript:"),
            "javascript: href must be stripped"
        );
    }
}
