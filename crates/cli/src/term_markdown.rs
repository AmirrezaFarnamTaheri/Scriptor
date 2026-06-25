use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use unicode_width::UnicodeWidthStr;

use crate::tui::safe_fit;

const HEADING: Style = Style::new().add_modifier(Modifier::BOLD);
const EMPHASIS: Style = Style::new().add_modifier(Modifier::ITALIC);
const STRONG: Style = Style::new().add_modifier(Modifier::BOLD);

#[allow(dead_code)]
const CODE: Style = Style::new().fg(Color::Cyan);
const LINK: Style = Style::new().fg(Color::LightBlue);
const MUTED: Style = Style::new().fg(Color::DarkGray);
const BLOCKQUOTE: Style = Style::new().fg(Color::Gray);

pub fn render_markdown_lines(markdown: &str, width: usize, max_lines: usize, scroll: usize) -> Vec<Line<'static>> {
    if width < 8 {
        return vec![Line::from("Preview too narrow.")];
    }

    let mut lines: Vec<Line<'static>> = Vec::new();
    let parser = Parser::new_ext(markdown, Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES);
    let mut current: Vec<Span<'static>> = Vec::new();
    let mut list_depth = 0usize;
    let mut in_code_block = false;
    let mut emphasis_depth = 0usize;
    let mut strong_depth = 0usize;
    let mut code_lang = String::new();

    let flush_line = |lines: &mut Vec<Line<'static>>, current: &mut Vec<Span<'static>>| {
        if current.is_empty() {
            lines.push(Line::from(""));
            return;
        }
        lines.push(Line::from(std::mem::take(current)));
    };

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                flush_line(&mut lines, &mut current);
                let prefix = match level {
                    HeadingLevel::H1 => "# ",
                    HeadingLevel::H2 => "## ",
                    HeadingLevel::H3 => "### ",
                    HeadingLevel::H4 => "#### ",
                    HeadingLevel::H5 => "##### ",
                    HeadingLevel::H6 => "###### ",
                };
                current.push(Span::styled(prefix.to_string(), HEADING));
            }
            Event::End(TagEnd::Heading(_)) => {
                flush_line(&mut lines, &mut current);
            }
            Event::Start(Tag::Paragraph) => {}
            Event::End(TagEnd::Paragraph) => flush_line(&mut lines, &mut current),
            Event::Start(Tag::BlockQuote(_)) => {
                flush_line(&mut lines, &mut current);
                current.push(Span::styled("│ ", BLOCKQUOTE));
            }
            Event::End(TagEnd::BlockQuote(_)) => flush_line(&mut lines, &mut current),
            Event::Start(Tag::List { .. }) => {
                list_depth += 1;
            }
            Event::End(TagEnd::List(_)) => {
                list_depth = list_depth.saturating_sub(1);
            }
            Event::Start(Tag::Item) => {
                flush_line(&mut lines, &mut current);
                let indent = "  ".repeat(list_depth.saturating_sub(1));
                current.push(Span::raw(format!("{indent}• ")));
            }
            Event::End(TagEnd::Item) => flush_line(&mut lines, &mut current),
            Event::Start(Tag::CodeBlock(kind)) => {
                flush_line(&mut lines, &mut current);
                in_code_block = true;
                code_lang = match kind {
                    pulldown_cmark::CodeBlockKind::Fenced(lang) => lang.to_string(),
                    pulldown_cmark::CodeBlockKind::Indented => String::new(),
                };
                if !code_lang.is_empty() {
                    current.push(Span::styled(format!("```{code_lang}"), CODE));
                    flush_line(&mut lines, &mut current);
                }
            }
            Event::End(TagEnd::CodeBlock) => {
                in_code_block = false;
                if !code_lang.is_empty() {
                    current.push(Span::styled("```".to_string(), CODE));
                    flush_line(&mut lines, &mut current);
                    code_lang.clear();
                }
            }
            Event::Code(text) => {
                let style = if in_code_block { CODE } else { CODE };
                current.push(Span::styled(text.to_string(), style));
            }
            Event::Start(Tag::Emphasis) => {
                emphasis_depth += 1;
            }
            Event::End(TagEnd::Emphasis) => {
                emphasis_depth = emphasis_depth.saturating_sub(1);
            }
            Event::Start(Tag::Strong) => {
                strong_depth += 1;
            }
            Event::End(TagEnd::Strong) => {
                strong_depth = strong_depth.saturating_sub(1);
            }
            Event::Start(Tag::Link { .. }) => {
                current.push(Span::styled("[", LINK));
            }
            Event::End(TagEnd::Link) => {
                current.push(Span::styled("]", LINK));
            }
            Event::Text(text) => {
                let style = if in_code_block {
                    CODE
                } else if strong_depth > 0 && emphasis_depth > 0 {
                    Style::new().add_modifier(Modifier::BOLD | Modifier::ITALIC)
                } else if strong_depth > 0 {
                    STRONG
                } else if emphasis_depth > 0 {
                    EMPHASIS
                } else {
                    Style::default()
                };
                current.push(Span::styled(text.to_string(), style));
            }
            Event::SoftBreak | Event::HardBreak => flush_line(&mut lines, &mut current),
            Event::Rule => {
                flush_line(&mut lines, &mut current);
                let rule = "─".repeat(width.min(48));
                lines.push(Line::from(Span::styled(rule, MUTED)));
            }
            _ => {}
        }
    }
    flush_line(&mut lines, &mut current);

    if lines.is_empty() {
        lines.push(Line::from(Span::styled("(empty note)", MUTED)));
    }

    lines
        .into_iter()
        .skip(scroll)
        .take(max_lines.max(8))
        .map(|line| wrap_line(line, width))
        .collect()
}

fn wrap_line(line: Line<'static>, width: usize) -> Line<'static> {
    let plain: String = line
        .spans
        .iter()
        .map(|span| span.content.as_ref())
        .collect();
    if UnicodeWidthStr::width(plain.as_str()) <= width {
        return line;
    }
    let fitted = safe_fit(&plain, width.saturating_sub(1));
    Line::from(Span::raw(fitted))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_heading_and_body() {
        let lines = render_markdown_lines("# Title\n\nBody text.", 40, 20, 0);
        assert!(!lines.is_empty());
        let joined: String = lines
            .iter()
            .flat_map(|line| line.spans.iter().map(|s| s.content.as_ref()))
            .collect();
        assert!(joined.contains("Title"));
        assert!(joined.contains("Body"));
    }
}
