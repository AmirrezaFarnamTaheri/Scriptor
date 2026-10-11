use std::collections::HashMap;

use pulldown_cmark::{Event, Options, Parser, Tag};

use super::PdfError;

const MAX_EVENTS: usize = 20_000;
const MAX_DEPTH: usize = 64;
const MAX_GENERATED_BYTES: usize = 4 * 1024 * 1024;

struct Frame<'a> {
    tag: Option<Tag<'a>>,
    body: String,
    text: String,
}

// Typst string literals differ from JSON for control characters. Escape using
// the language's explicit Unicode escape, and never interpolate content markup.
fn literal(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 2);
    output.push('"');
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            control if control.is_control() => {
                output.push_str(&format!("\\u{{{:x}}}", u32::from(control)))
            }
            ordinary => output.push(ordinary),
        }
    }
    output.push('"');
    output
}

fn render(frame: Frame<'_>, resources: &HashMap<String, String>) -> Result<String, PdfError> {
    let body = frame.body;
    Ok(match frame.tag {
        None => body,
        Some(Tag::Paragraph) => format!("#par[{body}]\n"),
        Some(Tag::Heading { level, .. }) => format!("#heading(level: {}, [{body}])\n", level as u8),
        Some(Tag::Strong) => format!("#strong[{body}]"),
        Some(Tag::Emphasis) => format!("#emph[{body}]"),
        Some(Tag::Strikethrough) => format!("#strike[{body}]"),
        Some(Tag::BlockQuote(_)) => format!("#quote(block: true)[{body}]\n"),
        Some(Tag::CodeBlock(_)) => format!("#raw({}, block: true)\n", literal(&frame.text)),
        Some(Tag::List(Some(start))) => format!("#enum(start: {start}, {body})\n"),
        Some(Tag::List(None)) => format!("#list({body})\n"),
        Some(Tag::Item) => format!("[{body}],"),
        Some(Tag::Table(columns)) => {
            if columns.is_empty() || columns.len() > 20 {
                return Err(PdfError::Limit("20 table columns"));
            }
            format!("#table(columns: {}, inset: 5pt, {body})\n", columns.len())
        }
        Some(Tag::TableHead) => format!("table.header({body}),"),
        Some(Tag::TableRow) => body,
        Some(Tag::TableCell) => format!("[{body}],"),
        Some(Tag::Link { dest_url, .. }) => {
            let url = dest_url.as_ref();
            if url.len() <= 2048
                && !url.chars().any(char::is_control)
                && (url.starts_with("https://")
                    || url.starts_with("http://")
                    || url.starts_with("mailto:"))
            {
                format!("#link({}, [{body}])", literal(url))
            } else {
                // Preserve the visible label while dropping unsafe PDF actions.
                body
            }
        }
        Some(Tag::Image { dest_url, .. }) => {
            let destination = dest_url.as_ref();
            if !super::valid_resource_path(destination) {
                return Err(PdfError::Resource(
                    "image must be a reviewed local PNG/JPEG snapshot".into(),
                ));
            }
            let path = resources.get(destination).ok_or_else(|| {
                PdfError::Resource(format!(
                    "missing image snapshot: {}",
                    destination.chars().take(160).collect::<String>()
                ))
            })?;
            format!(
                "#image({}, width: 100%, alt: {})",
                literal(path),
                literal(&frame.text)
            )
        }
        Some(Tag::MetadataBlock(_)) => String::new(),
        // The parser options below do not activate extension-only tags.
        Some(_) => body,
    })
}

pub(super) fn translate(
    markdown: &str,
    title: Option<&str>,
    resources: &HashMap<String, String>,
) -> Result<String, PdfError> {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS;
    let mut stack = vec![Frame {
        tag: None,
        body: String::new(),
        text: String::new(),
    }];
    for (count, event) in Parser::new_ext(markdown, options).enumerate() {
        if count >= MAX_EVENTS {
            return Err(PdfError::Limit("20,000 Markdown events"));
        }
        match event {
            Event::Start(tag) => {
                if stack.len() >= MAX_DEPTH {
                    return Err(PdfError::Limit("64 nested Markdown containers"));
                }
                stack.push(Frame {
                    tag: Some(tag),
                    body: String::new(),
                    text: String::new(),
                });
            }
            Event::End(end) => {
                let frame = stack
                    .pop()
                    .ok_or_else(|| PdfError::Typesetting("invalid Markdown structure".into()))?;
                if frame.tag.as_ref().map(Tag::to_end) != Some(end) {
                    return Err(PdfError::Typesetting(
                        "mismatched Markdown structure".into(),
                    ));
                }
                let text = frame.text.clone();
                let rendered = render(frame, resources)?;
                let parent = stack
                    .last_mut()
                    .ok_or_else(|| PdfError::Typesetting("missing Markdown root".into()))?;
                parent.body.push_str(&rendered);
                parent.text.push_str(&text);
            }
            Event::Text(value) | Event::Html(value) | Event::InlineHtml(value) => {
                let frame = stack.last_mut().expect("parser starts with a root frame");
                frame.body.push_str(&format!("#text({})", literal(&value)));
                frame.text.push_str(&value);
            }
            Event::Code(value) => {
                let frame = stack.last_mut().expect("parser starts with a root frame");
                frame.body.push_str(&format!("#raw({})", literal(&value)));
                frame.text.push_str(&value);
            }
            Event::SoftBreak | Event::HardBreak => {
                let frame = stack.last_mut().expect("parser starts with a root frame");
                frame.body.push_str(if matches!(event, Event::HardBreak) {
                    "#linebreak()"
                } else {
                    "#text(\" \")"
                });
                frame.text.push('\n');
            }
            Event::Rule => stack
                .last_mut()
                .expect("root frame")
                .body
                .push_str("#line(length: 100%)\n"),
            Event::TaskListMarker(checked) => {
                stack
                    .last_mut()
                    .expect("root frame")
                    .body
                    .push_str(if checked {
                        "#text(\"[x] \")"
                    } else {
                        "#text(\"[ ] \")"
                    });
            }
            _ => return Err(PdfError::Typesetting("unsupported Markdown event".into())),
        }
        if stack
            .last()
            .is_some_and(|frame| frame.body.len() > MAX_GENERATED_BYTES)
        {
            return Err(PdfError::Limit("4 MiB generated typesetting source"));
        }
    }
    if stack.len() != 1 {
        return Err(PdfError::Typesetting("unclosed Markdown structure".into()));
    }
    let body = stack.pop().expect("checked root frame").body;
    let title = literal(title.unwrap_or("Scriptor document"));
    Ok(format!(
        "#set document(title: {title}, date: none)\n#set page(paper: \"a4\", margin: 20mm)\n#set text(font: (\"Libertinus Serif\", \"DejaVu Sans Mono\"), size: 11pt)\n#set par(leading: 0.65em)\n#set heading(numbering: none)\n{body}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn authored_markup_never_becomes_executable_typesetting_code() {
        let value = translate(
            "#read(\"secret\") **bold** <script>x</script>",
            None,
            &HashMap::new(),
        )
        .unwrap();
        assert!(value.contains("#text(\"#read(\\\"secret\\\") \")"));
        assert!(value.contains("#strong[#text(\"bold\")]"));
    }
    #[test]
    fn input_nesting_has_an_explicit_limit() {
        let markdown = format!("{}x\n", "> ".repeat(70));
        assert!(translate(&markdown, None, &HashMap::new()).is_err());
    }
    #[test]
    fn yaml_metadata_is_not_printed_in_the_document() {
        let result = translate(
            "---\nprivate-metadata: omitted\n---\n\n# Public report",
            None,
            &HashMap::new(),
        )
        .unwrap();
        assert!(!result.contains("private-metadata"));
        assert!(result.contains("Public report"));
    }
}
