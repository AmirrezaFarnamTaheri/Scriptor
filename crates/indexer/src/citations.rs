use regex::Regex;

use crate::parse::ParsedCitation;

/// Extract Pandoc-style citation keys from Markdown body text.
/// Reimplements citekey discovery aligned with Pandoc manual semantics (not Zettlr source).
pub fn extract_pandoc_citations(body: &str) -> Vec<ParsedCitation> {
    let bracket_block = Regex::new(r"\[([^\[\]]*@[^\[\]]*)\]").expect("valid bracket citation block regex");
    let braced_key = Regex::new(r"@\{([^}]+)\}").expect("valid braced citekey regex");
    let plain_key = Regex::new(r"@([A-Za-z][A-Za-z0-9:_#.$/-]*)").expect("valid plain citekey regex");
    let suppress_key = Regex::new(r"-@([A-Za-z][A-Za-z0-9:_#.$/-]*)").expect("valid suppress citekey regex");

    let mut citations = Vec::new();
    let mut seen = std::collections::BTreeSet::new();

    for (index, line) in body.lines().enumerate() {
        let line_number = (index + 1) as u32;

        for capture in bracket_block.captures_iter(line) {
            let inner = capture.get(1).map(|m| m.as_str()).unwrap_or("");
            push_keys_from_segment(inner, line_number, &braced_key, &plain_key, &mut citations, &mut seen);
        }

        // Inline / suppress-author citations outside bracket blocks.
        let without_brackets = bracket_block.replace_all(line, " ");
        for capture in suppress_key.captures_iter(&without_brackets) {
            if let Some(key) = capture.get(1) {
                push_key(key.as_str(), line_number, &mut citations, &mut seen);
            }
        }

        for capture in plain_key.captures_iter(&without_brackets) {
            if let Some(key) = capture.get(1) {
                let start = capture.get(0).map(|m| m.start()).unwrap_or(0);
                if start > 0 && without_brackets.as_bytes().get(start - 1) == Some(&b'-') {
                    continue;
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
    fn extracts_simple_bracket_and_inline() {
        assert_eq!(keys("Text [@key] and @inline."), vec!["key", "inline"]);
    }
}
