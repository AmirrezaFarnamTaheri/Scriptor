//! scriptor-extractor — W3-9
//!
//! Heading / section extraction from a Markdown document string.
//!
//! This is the **single** implementation of "parse a Markdown file into a
//! heading tree". Previously both `export-runner` (outline) and `canvas`
//! (mind-map) had their own copies. Now both consume this crate.
//!
//! # Design constraints
//! - Pure Rust, no subprocess, no network.
//! - The only Markdown parser is `pulldown-cmark`; no second tokeniser.
//! - The output type `HeadingNode` is `serde::Serialize` so the CLI and IPC
//!   bridge can return it as JSON to the TS layer.
//!
//! # Example
//! ```
//! use scriptor_extractor::{extract_headings, HeadingNode};
//!
//! let md = "# Chapter 1\n\nsome text\n\n## Section 1.1\n\n## Section 1.2\n\n# Chapter 2\n";
//! let tree = extract_headings(md);
//! assert_eq!(tree.len(), 2);
//! assert_eq!(tree[0].title, "Chapter 1");
//! assert_eq!(tree[0].children.len(), 2);
//! ```

pub mod extractor;

pub use extractor::{HeadingNode, extract_headings};
