//! Core implementation of heading extraction (W3-9).
//!
//! `extract_headings` parses Markdown with `pulldown-cmark` and builds a tree
//! of `HeadingNode` values representing the document's heading hierarchy.
//!
//! ## Tree construction rules
//! - Level-1 headings (`#`) become root nodes.
//! - Each heading is a child of the nearest ancestor with a strictly smaller
//!   level; if none exists it becomes a root node.
//! - Source byte offsets are tracked so callers (reader, mind-map, outline)
//!   can jump to the heading's position.
//! - The `anchor` field is the GitHub-style slug derived from the heading text
//!   (lower-case, spaces → hyphens, special chars removed). Used by the PDF
//!   outline and the in-app navigation.

use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use serde::{Deserialize, Serialize};

// ── Public types ──────────────────────────────────────────────────────────────

/// A single heading and all its nested children.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeadingNode {
    /// Heading level (1..=6).
    pub level: u8,
    /// Plain-text heading content (no Markdown syntax).
    pub title: String,
    /// GitHub-style slug for anchor linking.
    pub anchor: String,
    /// Byte offset of the heading's `#` character in the source.
    pub byte_offset: usize,
    /// Nested child headings (one level deeper only, but recursively).
    pub children: Vec<HeadingNode>,
}

impl HeadingNode {
    fn new(level: u8, title: String, byte_offset: usize) -> Self {
        let anchor = slugify(&title);
        Self {
            level,
            title,
            anchor,
            byte_offset,
            children: Vec::new(),
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Parse `markdown` and return a forest of `HeadingNode`s representing the
/// document's heading structure.
///
/// Headings that have a higher level than the preceding heading do not become
/// children; they become root-level nodes instead. This matches GitHub's
/// table-of-contents behaviour.
pub fn extract_headings(markdown: &str) -> Vec<HeadingNode> {
    let opts =
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_HEADING_ATTRIBUTES;
    let parser = Parser::new_ext(markdown, opts).into_offset_iter();

    // Flat list of (level, title, byte_offset) before tree assembly.
    let mut flat: Vec<(u8, String, usize)> = Vec::new();

    let mut in_heading: Option<(u8, usize)> = None; // (level, byte_offset)
    let mut heading_buf = String::new();

    for (event, range) in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = heading_level_to_u8(level);
                in_heading = Some((lvl, range.start));
                heading_buf.clear();
            }
            Event::Text(txt) if in_heading.is_some() => {
                heading_buf.push_str(&txt);
            }
            Event::Code(code) if in_heading.is_some() => {
                // Re-wrap the code text with backticks so the title field
                // matches what the user wrote (e.g. "Using `fn_name`").
                heading_buf.push('`');
                heading_buf.push_str(&code);
                heading_buf.push('`');
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some((lvl, offset)) = in_heading.take() {
                    flat.push((lvl, heading_buf.trim().to_owned(), offset));
                }
                heading_buf.clear();
            }
            _ => {}
        }
    }

    build_tree(&flat)
}

/// Return all headings as a flat, depth-first slice (level order preserved).
pub fn extract_headings_flat(markdown: &str) -> Vec<HeadingNode> {
    fn flatten(nodes: Vec<HeadingNode>, out: &mut Vec<HeadingNode>) {
        for mut node in nodes {
            let children = std::mem::take(&mut node.children);
            out.push(node);
            flatten(children, out);
        }
    }
    let tree = extract_headings(markdown);
    let mut out = Vec::new();
    flatten(tree, &mut out);
    out
}

// ── Tree assembly ─────────────────────────────────────────────────────────────

/// Build a forest from a flat list of (level, title, byte_offset) triples.
///
/// Uses a recursive descent approach: for each node, collect all subsequent
/// nodes with a strictly greater level as its children, then recurse into
/// those children. This produces correct document order without any reversal.
fn build_tree(flat: &[(u8, String, usize)]) -> Vec<HeadingNode> {
    let mut idx = 0;
    collect_children(flat, &mut idx, 0)
}

/// Collect nodes at levels strictly greater than `min_level` starting at `idx`,
/// stopping when we hit a node at <= `min_level` or the end of the list.
fn collect_children(
    flat: &[(u8, String, usize)],
    idx: &mut usize,
    min_level: u8,
) -> Vec<HeadingNode> {
    let mut result = Vec::new();
    while *idx < flat.len() {
        let (level, title, offset) = &flat[*idx];
        if *level <= min_level {
            break; // this node belongs to our caller, not us
        }
        *idx += 1;
        let mut node = HeadingNode::new(*level, title.clone(), *offset);
        // All immediately following nodes with level > this node's level
        // become children of this node.
        node.children = collect_children(flat, idx, *level);
        result.push(node);
    }
    result
}

// ── Slug ──────────────────────────────────────────────────────────────────────

fn slugify(text: &str) -> String {
    // Strip backtick spans from the text before slugifying — GitHub's anchor
    // generator does the same for inline-code headings.
    let stripped = text.replace('`', "");
    let mut slug = String::with_capacity(stripped.len());
    for ch in stripped.chars() {
        if ch.is_alphanumeric() || ch == '_' {
            // Underscores are preserved (GitHub anchor behaviour).
            for lower in ch.to_lowercase() {
                slug.push(lower);
            }
        } else if ch == ' ' || ch == '-' {
            slug.push('-');
        }
        // Drop other characters (punctuation, special chars)
    }
    // Collapse consecutive hyphens
    let mut out = String::with_capacity(slug.len());
    let mut prev_hyphen = false;
    for ch in slug.chars() {
        if ch == '-' {
            if !prev_hyphen {
                out.push('-');
            }
            prev_hyphen = true;
        } else {
            out.push(ch);
            prev_hyphen = false;
        }
    }
    out.trim_matches('-').to_owned()
}

fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn md(src: &str) -> Vec<HeadingNode> {
        extract_headings(src)
    }

    #[test]
    fn empty_document_returns_empty() {
        assert!(md("no headings here").is_empty());
    }

    #[test]
    fn single_h1() {
        let tree = md("# Hello");
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].title, "Hello");
        assert_eq!(tree[0].level, 1);
        assert_eq!(tree[0].anchor, "hello");
    }

    #[test]
    fn h1_with_h2_children() {
        let src = "# Chapter\n\n## Section A\n\n## Section B\n";
        let tree = md(src);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].title, "Section A");
        assert_eq!(tree[0].children[1].title, "Section B");
    }

    #[test]
    fn sibling_h1s_are_roots() {
        let src = "# A\n\n# B\n\n# C\n";
        let tree = md(src);
        assert_eq!(tree.len(), 3);
        assert!(tree[0].children.is_empty());
    }

    #[test]
    fn deep_nesting() {
        let src = "# H1\n## H2\n### H3\n#### H4\n";
        let tree = md(src);
        assert_eq!(tree.len(), 1);
        let h2 = &tree[0].children[0];
        assert_eq!(h2.level, 2);
        let h3 = &h2.children[0];
        assert_eq!(h3.level, 3);
        let h4 = &h3.children[0];
        assert_eq!(h4.level, 4);
        assert!(h4.children.is_empty());
    }

    #[test]
    fn heading_with_inline_code() {
        let src = "# Using `extract_headings`\n";
        let tree = md(src);
        assert_eq!(tree[0].title, "Using `extract_headings`");
        assert_eq!(tree[0].anchor, "using-extract_headings");
    }

    #[test]
    fn slug_collapses_hyphens_and_special_chars() {
        assert_eq!(slugify("Hello, World!"), "hello-world");
        assert_eq!(slugify("  leading  "), "leading");
        assert_eq!(slugify("C++ is great"), "c-is-great");
        assert_eq!(slugify("中文"), "中文");
    }

    #[test]
    fn flat_extraction_preserves_depth_first_order() {
        let src = "# A\n## A1\n## A2\n# B\n";
        let flat = extract_headings_flat(src);
        assert_eq!(
            flat.iter().map(|n| n.title.as_str()).collect::<Vec<_>>(),
            vec!["A", "A1", "A2", "B"]
        );
    }

    #[test]
    fn byte_offset_is_nonzero_for_second_heading() {
        let src = "# First\n\n# Second\n";
        let tree = md(src);
        assert_eq!(tree[0].byte_offset, 0);
        assert!(tree[1].byte_offset > 0);
    }

    #[test]
    fn h2_without_preceding_h1_becomes_root() {
        let src = "## Orphan\n\n# Parent\n";
        let tree = md(src);
        // Orphan H2 has no H1 parent → becomes root.
        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].title, "Orphan");
        assert_eq!(tree[0].level, 2);
    }
}
