use std::sync::LazyLock;

use regex::Regex;

use crate::parse::ParsedCitation;

static BRACKET_BLOCK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[([^\[\]]*@[^\[\]]*)\]").expect("valid bracket citation block regex")
});
static BRACED_KEY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@\{([^}]+)\}").expect("valid braced citekey regex"));
static PLAIN_KEY_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@([A-Za-z][A-Za-z0-9:_#.$/-]*)").expect("valid plain citekey regex")
});
static SUPPRESS_KEY_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"-@([A-Za-z][A-Za-z0-9:_#.$/-]*)").expect("valid suppress citekey regex")
});

/// Extract Pandoc-style citation keys from Markdown body text.
/// Reimplements citekey discovery aligned with Pandoc manual semantics (not Zettlr source).
pub fn extract_pandoc_citations(body: &str) -> Vec<ParsedCitation> {
    let mut citations = Vec::new();
    let mut seen = std::collections::BTreeSet::new();

    for (index, line) in body.lines().enumerate() {
        let line_number = (index + 1) as u32;

        for capture in BRACKET_BLOCK_RE.captures_iter(line) {
            let inner = capture.get(1).map(|m| m.as_str()).unwrap_or("");
            push_keys_from_segment(
                inner,
                line_number,
                &BRACED_KEY_RE,
                &PLAIN_KEY_RE,
                &mut citations,
                &mut seen,
            );
        }

        // Inline / suppress-author citations outside bracket blocks.
        let without_brackets = BRACKET_BLOCK_RE.replace_all(line, " ");
        for capture in SUPPRESS_KEY_RE.captures_iter(&without_brackets) {
            if let Some(key) = capture.get(1) {
                push_key(key.as_str(), line_number, &mut citations, &mut seen);
            }
        }

        for capture in PLAIN_KEY_RE.captures_iter(&without_brackets) {
            if let Some(key) = capture.get(1) {
                let start = capture.get(0).map(|m| m.start()).unwrap_or(0);
                if start > 0 {
                    let previous = without_brackets[..start].chars().next_back();
                    // Pandoc inline citations need a token boundary. In
                    // particular, the `@domain` portion of an email address or
                    // an `@name` URL/path segment is not a citation key.
                    if previous.is_some_and(|ch| {
                        ch.is_alphanumeric() || matches!(ch, '.' | '_' | '+' | '%' | '/' | '\\')
                    }) {
                        continue;
                    }
                    if previous == Some('-') {
                        continue;
                    }
                }
                push_key(key.as_str(), line_number, &mut citations, &mut seen);
            }
        }
    }

    citations
}

fn push_keys_from_segment(
    segment: &str,
    line_number: u32,
    braced_key: &Regex,
    plain_key: &Regex,
    citations: &mut Vec<ParsedCitation>,
    seen: &mut std::collections::BTreeSet<(u32, String)>,
) {
    let mut consumed: Vec<std::ops::Range<usize>> = Vec::new();

    for capture in braced_key.captures_iter(segment) {
        if let Some(key) = capture.get(1) {
            if let Some(full) = capture.get(0) {
                consumed.push(full.range());
            }
            push_key(key.as_str(), line_number, citations, seen);
        }
    }

    for capture in plain_key.captures_iter(segment) {
        let Some(full) = capture.get(0) else { continue };
        if consumed.iter().any(|range| range.contains(&full.start())) {
            continue;
        }
        if let Some(key) = capture.get(1) {
            push_key(key.as_str(), line_number, citations, seen);
        }
    }
}

fn push_key(
    key: &str,
    line_number: u32,
    citations: &mut Vec<ParsedCitation>,
    seen: &mut std::collections::BTreeSet<(u32, String)>,
) {
    let key = key.trim().trim_end_matches(['.', ',', ';', ':']);
    if key.is_empty() {
        return;
    }
    if seen.insert((line_number, key.to_string())) {
        citations.push(ParsedCitation {
            key: key.to_string(),
            line: line_number,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(markdown: &str) -> Vec<String> {
        extract_pandoc_citations(markdown)
            .into_iter()
            .map(|c| c.key)
            .collect()
    }

    #[test]
    fn extracts_multiple_bracket_citations() {
        assert_eq!(
            keys("Blah blah [@doe99; @smith2000; @smith2004]."),
            vec!["doe99", "smith2000", "smith2004"]
        );
    }

    #[test]
    fn extracts_citations_with_prefix_and_locator() {
        let found = keys("Blah blah [see @doe99, pp. 33-35 and *passim*; @smith04, chap. 1].");
        assert!(found.contains(&"doe99".to_string()));
        assert!(found.contains(&"smith04".to_string()));
    }

    #[test]
    fn extracts_braced_url_citekey() {
        assert_eq!(
            keys("[@{https://example.com/bib?name=foobar&date=2000}, p. 33]"),
            vec!["https://example.com/bib?name=foobar&date=2000"]
        );
    }

    #[test]
    fn extracts_suppress_author_inline() {
        assert_eq!(keys("As shown by -@smith04."), vec!["smith04"]);
    }

    #[test]
    fn ignores_email_and_url_at_signs() {
        assert_eq!(keys("Contact alice@example.com or visit /users/@alice."), Vec::<String>::new());
        assert_eq!(keys("Cite @smith2026 after the email."), vec!["smith2026"]);
    }

    #[test]
    fn extracts_simple_bracket_and_inline() {
        assert_eq!(keys("Text [@key] and @inline."), vec!["key", "inline"]);
    }
}
