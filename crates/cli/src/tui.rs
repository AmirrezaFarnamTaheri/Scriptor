use std::path::PathBuf;
use std::time::Duration;

use scriptor_daemon::rpc_call;
use scriptor_indexer::{
    backlinks_for_path, health_diagnostics_json, list_note_summaries, open_cache_for_session,
    query_focused_graph, rebuild_index, search_notes,
};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use scriptor_native_git::git_status;
use scriptor_vault::{open_vault, read_note, RelativeVaultPath, VaultSession};
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Wrap},
    DefaultTerminal, Frame,
};
use serde::Deserialize;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

use crate::term_markdown;

#[derive(Clone)]
struct TuiNote {
    title: String,
    path: String,
}

#[derive(Default)]
struct PreviewCache {
    path: String,
    body: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum InputMode {
    Browse,
    Search,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RightPane {
    Preview,
    Backlinks,
    Graph,
    Health,
}

impl RightPane {
    fn title(self) -> &'static str {
        match self {
            Self::Preview => "Preview",
            Self::Backlinks => "Backlinks",
            Self::Graph => "Graph",
            Self::Health => "Health",
        }
    }
}

struct TuiApp {
    path: PathBuf,
    via_daemon: bool,
    daemon_seq: u64,
    daemon_opened: bool,
    session: Option<VaultSession>,
    notes: Vec<TuiNote>,
    selected: usize,
    preview: PreviewCache,
    pane_lines: Vec<String>,
    query: String,
    input_mode: InputMode,
    right_pane: RightPane,
    pane_scroll: usize,
    show_help: bool,
    status: String,
    git_footer: String,
    health_footer: String,
}

impl TuiApp {
    fn open(path: PathBuf, via_daemon: bool) -> Result<Self, Box<dyn std::error::Error>> {
        let mut app = Self {
            path,
            via_daemon,
            daemon_seq: 0,
            daemon_opened: false,
            session: None,
            notes: Vec::new(),
            selected: 0,
            preview: PreviewCache::default(),
            pane_lines: Vec::new(),
            query: String::new(),
            input_mode: InputMode::Browse,
            right_pane: RightPane::Preview,
            pane_scroll: 0,
            show_help: false,
            status: String::from("Ready"),
            git_footer: String::from("git: n/a"),
            health_footer: String::from("health: n/a"),
        };
        app.refresh_notes()?;
        app.refresh_footer_meta()?;
        app.refresh_right_pane()?;
        Ok(app)
    }

    fn next_rpc_id(&mut self) -> u64 {
        self.daemon_seq += 1;
        self.daemon_seq
    }

    fn ensure_session(&mut self) -> Result<&VaultSession, Box<dyn std::error::Error>> {
        if self.via_daemon {
            self.ensure_daemon_vault()?;
            return Err("in-process session unavailable in daemon mode".into());
        }
        if self.session.is_none() {
            let session = open_vault(&self.path)?;
            rebuild_index(&session, &[])?;
            self.session = Some(session);
        }
        Ok(self.session.as_ref().expect("session"))
    }

    fn ensure_daemon_vault(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.via_daemon || self.daemon_opened {
            return Ok(());
        }
        let response = rpc_call(RpcRequest {
            id: self.next_rpc_id(),
            method: RpcMethod::OpenVault {
                path: self.path.display().to_string(),
            },
        })?;
        match response.result {
            RpcResult::Ok(RpcPayload::VaultOpened { .. }) => {
                self.daemon_opened = true;
                Ok(())
            }
            RpcResult::Ok(_) => Err("daemon returned unexpected payload for OpenVault".into()),
            RpcResult::Err(message) => Err(message.into()),
        }
    }

    fn refresh_notes(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.via_daemon {
            self.ensure_daemon_vault()?;
            if self.query.trim().is_empty() {
                let response = rpc_call(RpcRequest {
                    id: self.next_rpc_id(),
                    method: RpcMethod::ListNotes,
                })?;
                match response.result {
                    RpcResult::Ok(RpcPayload::NoteList { notes }) => {
                        self.notes = notes
                            .into_iter()
                            .map(|entry| TuiNote {
                                title: entry.title,
                                path: entry.path,
                            })
                            .collect();
                    }
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("daemon returned unexpected payload for ListNotes".into()),
                }
            } else {
                let response = rpc_call(RpcRequest {
                    id: self.next_rpc_id(),
                    method: RpcMethod::SearchNotes {
                        query: self.query.trim().to_string(),
                        limit: 200,
                    },
                })?;
                match response.result {
                    RpcResult::Ok(RpcPayload::SearchHits { hits }) => {
                        self.notes = hits
                            .into_iter()
                            .map(|entry| TuiNote {
                                title: entry.title,
                                path: entry.path,
                            })
                            .collect();
                    }
                    RpcResult::Err(message) => return Err(message.into()),
                    _ => return Err("daemon returned unexpected payload for SearchNotes".into()),
                }
            }
        } else {
            let query = self.query.trim().to_string();
            let session = self.ensure_session()?;
            let cache = open_cache_for_session(session)?;
            let summaries = if query.is_empty() {
                list_note_summaries(&cache, &session.descriptor.id)?
                    .into_iter()
                    .map(|entry| TuiNote {
                        title: entry.title,
                        path: entry.path,
                    })
                    .collect::<Vec<_>>()
            } else {
                search_notes(&cache, &session.descriptor.id, &query, 200)?
                    .into_iter()
                    .map(|entry| TuiNote {
                        title: entry.title,
                        path: entry.path,
                    })
                    .collect::<Vec<_>>()
            };
            self.notes = summaries;
        }

        if self.notes.is_empty() {
            self.selected = 0;
            self.preview = PreviewCache {
                path: String::new(),
                body: String::from("No notes match the current view."),
            };
        } else {
            self.selected = self.selected.min(self.notes.len().saturating_sub(1));
        }
        self.status = if self.query.trim().is_empty() {
            let transport = if self.via_daemon { "daemon" } else { "in-process" };
            format!("{} notes ({transport})", self.notes.len())
        } else {
            format!("{} results for {}", self.notes.len(), self.query.trim())
        };
        Ok(())
    }

    fn refresh_footer_meta(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.via_daemon {
            self.ensure_daemon_vault()?;
            let git = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::GitStatus,
            })?;
            self.git_footer = match git.result {
                RpcResult::Ok(RpcPayload::GitStatus { json }) => summarize_git_json(&json),
                RpcResult::Err(message) => format!("git: {message}"),
                _ => String::from("git: unexpected response"),
            };

            let health = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::HealthDiagnostics,
            })?;
            self.health_footer = match health.result {
                RpcResult::Ok(RpcPayload::HealthDiagnostics { json }) => summarize_health_json(&json),
                RpcResult::Err(message) => format!("health: {message}"),
                _ => String::from("health: unexpected response"),
            };
        } else {
            let status = git_status(&self.path)?;
            self.git_footer = summarize_git(&status);
            let session = self.ensure_session()?;
            let cache = open_cache_for_session(session)?;
            let json = health_diagnostics_json(&cache, session)?;
            self.health_footer = summarize_health_json(&json);
        }
        Ok(())
    }

    fn refresh_preview(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let Some(note) = self.selected_note().cloned() else {
            return Ok(());
        };
        if self.preview.path == note.path {
            return Ok(());
        }
        let body = if self.via_daemon {
            self.ensure_daemon_vault()?;
            let response = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::ReadNote {
                    path: note.path.clone(),
                },
            })?;
            match response.result {
                RpcResult::Ok(RpcPayload::NoteDocument { markdown, .. }) => markdown,
                RpcResult::Err(message) => return Err(message.into()),
                _ => return Err("daemon returned unexpected payload for ReadNote".into()),
            }
        } else {
            let session = self.ensure_session()?;
            let relative = RelativeVaultPath::parse(&note.path)?;
            read_note(&session.descriptor.id, &session.root, &relative)?.markdown
        };
        self.preview = PreviewCache {
            path: note.path.clone(),
            body,
        };
        Ok(())
    }

    fn refresh_right_pane(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        match self.right_pane {
            RightPane::Preview => {
                self.refresh_preview()?;
                self.pane_lines.clear();
            }
            RightPane::Backlinks => self.refresh_backlinks_pane()?,
            RightPane::Graph => self.refresh_graph_pane()?,
            RightPane::Health => self.refresh_health_pane()?,
        }
        Ok(())
    }

    fn refresh_backlinks_pane(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let Some(note) = self.selected_note().cloned() else {
            self.pane_lines = vec!["Select a note to inspect backlinks.".into()];
            return Ok(());
        };

        if self.via_daemon {
            let response = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::Backlinks {
                    path: note.path.clone(),
                },
            })?;
            let json = match response.result {
                RpcResult::Ok(RpcPayload::Backlinks { json, .. }) => json,
                RpcResult::Err(message) => {
                    self.pane_lines = vec![message];
                    return Ok(());
                }
                _ => {
                    self.pane_lines = vec!["Unexpected backlinks response.".into()];
                    return Ok(());
                }
            };
            self.pane_lines = format_backlinks_json(&json);
        } else {
            let session = self.ensure_session()?;
            let cache = open_cache_for_session(session)?;
            let hits = backlinks_for_path(&cache, session, &note.path)?;
            self.pane_lines = hits
                .into_iter()
                .map(|hit| format!("{} — {}", hit.from_path, hit.from_title))
                .collect();
            if self.pane_lines.is_empty() {
                self.pane_lines.push("No backlinks found.".into());
            }
        }
        Ok(())
    }

    fn refresh_graph_pane(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let focus = self.selected_note().map(|note| note.path.clone());
        if self.via_daemon {
            let response = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::GraphSummary {
                    path: focus.clone(),
                    depth: 2,
                },
            })?;
            let json = match response.result {
                RpcResult::Ok(RpcPayload::GraphSummary { json }) => json,
                RpcResult::Err(message) => {
                    self.pane_lines = vec![message];
                    return Ok(());
                }
                _ => {
                    self.pane_lines = vec!["Unexpected graph response.".into()];
                    return Ok(());
                }
            };
            self.pane_lines = format_graph_json(&json);
        } else {
            let session = self.ensure_session()?;
            let cache = open_cache_for_session(session)?;
            let graph = query_focused_graph(&cache, session, focus.as_deref(), 2, &[])?;
            self.pane_lines = graph
                .nodes
                .iter()
                .take(40)
                .map(|node| format!("{} ({})", node.label, node.path))
                .collect();
            self.pane_lines
                .push(format!("{} nodes, {} edges", graph.nodes.len(), graph.edges.len()));
        }
        Ok(())
    }

    fn refresh_health_pane(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.via_daemon {
            let response = rpc_call(RpcRequest {
                id: self.next_rpc_id(),
                method: RpcMethod::HealthDiagnostics,
            })?;
            let json = match response.result {
                RpcResult::Ok(RpcPayload::HealthDiagnostics { json }) => json,
                RpcResult::Err(message) => {
                    self.pane_lines = vec![message];
                    return Ok(());
                }
                _ => {
                    self.pane_lines = vec!["Unexpected health response.".into()];
                    return Ok(());
                }
            };
            self.pane_lines = format_health_pane_json(&json);
        } else {
            let session = self.ensure_session()?;
            let cache = open_cache_for_session(session)?;
            let json = health_diagnostics_json(&cache, session)?;
            self.pane_lines = format_health_pane_json(&json);
        }
        self.pane_lines.push(String::from(
            "Export: scriptor export <vault> --note <path> --format html",
        ));
        Ok(())
    }

    fn set_right_pane(&mut self, pane: RightPane) -> Result<(), Box<dyn std::error::Error>> {
        self.right_pane = pane;
        self.pane_scroll = 0;
        self.refresh_right_pane()
    }

    fn selected_note(&self) -> Option<&TuiNote> {
        self.notes.get(self.selected)
    }

    fn move_selection(&mut self, delta: isize) -> Result<(), Box<dyn std::error::Error>> {
        if self.notes.is_empty() {
            return Ok(());
        }
        let max = self.notes.len() as isize - 1;
        self.selected = (self.selected as isize + delta).clamp(0, max) as usize;
        self.pane_scroll = 0;
        self.refresh_right_pane()
    }

    fn scroll_pane(&mut self, delta: isize) {
        let next = self.pane_scroll as isize + delta;
        self.pane_scroll = usize::try_from(next.max(0)).unwrap_or(0);
    }
}

#[derive(Debug, Deserialize)]
struct GitStatusView {
    is_repo: bool,
    branch: Option<String>,
    clean: bool,
    changed_files: Vec<serde_json::Value>,
    has_conflicts: bool,
}

#[derive(Debug, Deserialize)]
struct HealthDiagnosticsView {
    issues: Vec<HealthIssueView>,
    summary: VaultHealthSummaryView,
}

#[derive(Debug, Deserialize)]
struct VaultHealthSummaryView {
    cache_status: String,
}

#[derive(Debug, Deserialize)]
struct HealthIssueView {
    detail: String,
}

#[derive(Debug, Deserialize)]
struct BacklinkView {
    path: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct GraphView {
    nodes: Vec<serde_json::Value>,
    edges: Vec<serde_json::Value>,
}

fn summarize_git(status: &scriptor_native_git::GitStatus) -> String {
    if !status.is_repo {
        return String::from("git: not a repository");
    }
    let branch = status.branch.clone().unwrap_or_else(|| "detached".into());
    let changes = status.changed_files.len();
    let conflicts = if status.has_conflicts { " conflicts" } else { "" };
    format!("git: {branch} | {changes} changed{conflicts}")
}

fn summarize_git_json(json: &str) -> String {
    serde_json::from_str::<GitStatusView>(json)
        .map(|status| {
            if !status.is_repo {
                return String::from("git: not a repository");
            }
            let branch = status.branch.unwrap_or_else(|| "detached".into());
            let clean = if status.clean { " clean" } else { "" };
            format!(
                "git: {branch} | {} changed{clean}{}",
                status.changed_files.len(),
                if status.has_conflicts { " conflicts" } else { "" }
            )
        })
        .unwrap_or_else(|_| String::from("git: unavailable"))
}

fn summarize_health_json(json: &str) -> String {
    serde_json::from_str::<HealthDiagnosticsView>(json)
        .map(|report| {
            format!(
                "health: {} ({} issues)",
                report.summary.cache_status,
                report.issues.len()
            )
        })
        .unwrap_or_else(|_| String::from("health: unavailable"))
}

fn format_backlinks_json(json: &str) -> Vec<String> {
    match serde_json::from_str::<Vec<BacklinkView>>(json) {
        Ok(hits) if hits.is_empty() => vec!["No backlinks found.".into()],
        Ok(hits) => hits
            .into_iter()
            .map(|hit| format!("{} — {}", hit.path, hit.title))
            .collect(),
        Err(_) => vec!["Could not parse backlinks.".into()],
    }
}

fn format_graph_json(json: &str) -> Vec<String> {
    match serde_json::from_str::<GraphView>(json) {
        Ok(graph) => {
            let mut lines = graph
                .nodes
                .iter()
                .filter_map(|node| {
                    let path = node.get("path")?.as_str()?;
                    let label = node.get("label").and_then(|v| v.as_str()).unwrap_or(path);
                    Some(format!("{label} ({path})"))
                })
                .take(40)
                .collect::<Vec<_>>();
            lines.push(format!("{} nodes, {} edges", graph.nodes.len(), graph.edges.len()));
            lines
        }
        Err(_) => vec!["Could not parse graph.".into()],
    }
}

fn format_health_pane_json(json: &str) -> Vec<String> {
    match serde_json::from_str::<HealthDiagnosticsView>(json) {
        Ok(report) => {
            let mut lines = vec![
                format!("Cache: {}", report.summary.cache_status),
                format!("Issues: {}", report.issues.len()),
            ];
            for issue in report.issues.iter().take(12) {
                lines.push(format!("- {}", issue.detail));
            }
            lines
        }
        Err(_) => vec!["Could not parse health diagnostics.".into()],
    }
}

struct TerminalGuard;

impl TerminalGuard {
    fn enter() -> Result<(Self, DefaultTerminal), Box<dyn std::error::Error>> {
        enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        execute!(stdout, EnterAlternateScreen)?;
        Ok((Self, ratatui::init()))
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = execute!(std::io::stdout(), LeaveAlternateScreen);
        ratatui::restore();
    }
}

pub fn safe_fit(value: &str, width: usize) -> String {
    if width == 0 {
        return String::new();
    }
    let mut rendered = String::new();
    let mut used = 0usize;
    for grapheme in value.graphemes(true) {
        let next = UnicodeWidthStr::width(grapheme);
        if used + next > width {
            break;
        }
        rendered.push_str(grapheme);
        used += next;
    }
    rendered
}

fn preview_lines(markdown: &str, width: usize, height: usize, scroll: usize) -> Vec<Line<'static>> {
    term_markdown::render_markdown_lines(markdown, width, height, scroll)
}

fn footer_text(app: &TuiApp) -> String {
    let selection = app
        .selected_note()
        .map(|note| format!("selected {}", note.path))
        .unwrap_or_else(|| String::from("selected none"));
    format!(
        "{} | {} | {} | {} | p/b/g/h panes  ? help  PgUp/PgDn scroll",
        app.status, app.git_footer, app.health_footer, selection
    )
}

fn header_text(app: &TuiApp) -> String {
    match app.input_mode {
        InputMode::Browse => format!(
            "Scriptor TUI | {} | / search  j/k move  Tab cycle panes  r refresh  q quit",
            app.status
        ),
        InputMode::Search => format!("Search: {}", app.query),
    }
}

fn draw(frame: &mut Frame, app: &TuiApp) {
    let root = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(10), Constraint::Length(2)])
        .split(frame.area());
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(34), Constraint::Percentage(66)])
        .split(root[1]);

    frame.render_widget(
        Paragraph::new(header_text(app))
            .block(Block::default().borders(Borders::ALL).title("Command Surface")),
        root[0],
    );

    let mut state = ListState::default();
    if !app.notes.is_empty() {
        state.select(Some(app.selected));
    }
    let items = app
        .notes
        .iter()
        .map(|note| {
            ListItem::new(vec![
                Line::from(Span::styled(note.title.clone(), Style::default().add_modifier(Modifier::BOLD))),
                Line::from(Span::raw(note.path.clone())),
            ])
        })
        .collect::<Vec<_>>();
    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Notes"))
        .highlight_style(Style::default().add_modifier(Modifier::REVERSED))
        .highlight_symbol(">> ");
    frame.render_stateful_widget(list, body[0], &mut state);

    let pane_width = body[1].width.saturating_sub(2) as usize;
    let pane_height = body[1].height.saturating_sub(2) as usize;
    let pane_title = app
        .selected_note()
        .map(|note| format!("{} — {}", app.right_pane.title(), note.path))
        .unwrap_or_else(|| app.right_pane.title().to_string());

    let lines = if app.right_pane == RightPane::Preview {
        preview_lines(&app.preview.body, pane_width, pane_height, app.pane_scroll)
    } else {
        app.pane_lines
            .iter()
            .skip(app.pane_scroll)
            .take(pane_height.max(8))
            .map(|line| Line::from(safe_fit(line, pane_width.saturating_sub(1))))
            .collect()
    };

    let pane_block = Block::default()
        .borders(Borders::ALL)
        .title(pane_title)
        .border_style(Style::default().fg(Color::DarkGray));
    frame.render_widget(
        Paragraph::new(lines)
            .block(pane_block)
            .wrap(Wrap { trim: false }),
        body[1],
    );

    frame.render_widget(
        Paragraph::new(footer_text(app))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::DarkGray)),
            ),
        root[2],
    );

    if app.show_help {
        let help = Paragraph::new(vec![
            Line::from(Span::styled("Scriptor TUI — keyboard reference", Style::default().add_modifier(Modifier::BOLD))),
            Line::from("j/k or arrows     Move note selection"),
            Line::from("/               Enter search mode"),
            Line::from("Enter / Esc     Apply or cancel search"),
            Line::from("p b g h         Preview, Backlinks, Graph, Health"),
            Line::from("Tab             Cycle right panes"),
            Line::from("PgUp / PgDn     Scroll active pane"),
            Line::from("r               Refresh notes and pane"),
            Line::from("?               Toggle this help overlay"),
            Line::from("q               Quit"),
        ])
        .block(
            Block::default()
                .title("Help")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .wrap(Wrap { trim: true });
        let area = Layout::default()
            .direction(Direction::Vertical)
            .margin(2)
            .constraints([Constraint::Percentage(55)])
            .split(frame.area());
        frame.render_widget(Clear, area[0]);
        frame.render_widget(help, area[0]);
    }
}

pub fn run(path: PathBuf, via_daemon: bool) -> Result<(), Box<dyn std::error::Error>> {
    let (_guard, mut terminal) = TerminalGuard::enter()?;
    let mut app = TuiApp::open(path, via_daemon)?;

    loop {
        terminal.draw(|frame| draw(frame, &app))?;
        if !event::poll(Duration::from_millis(120))? {
            continue;
        }
        let Event::Key(key) = event::read()? else {
            continue;
        };
        if key.kind != KeyEventKind::Press {
            continue;
        }
        match app.input_mode {
            InputMode::Browse => match key.code {
                KeyCode::Char('q') => break,
                KeyCode::Char('?') => app.show_help = !app.show_help,
                KeyCode::Char('j') | KeyCode::Down => app.move_selection(1)?,
                KeyCode::Char('k') | KeyCode::Up => app.move_selection(-1)?,
                KeyCode::Char('r') => {
                    app.refresh_notes()?;
                    app.refresh_footer_meta()?;
                    app.refresh_right_pane()?;
                }
                KeyCode::Char('p') => app.set_right_pane(RightPane::Preview)?,
                KeyCode::Char('b') => app.set_right_pane(RightPane::Backlinks)?,
                KeyCode::Char('g') => app.set_right_pane(RightPane::Graph)?,
                KeyCode::Char('h') => app.set_right_pane(RightPane::Health)?,
                KeyCode::Tab => {
                    app.right_pane = match app.right_pane {
                        RightPane::Preview => RightPane::Backlinks,
                        RightPane::Backlinks => RightPane::Graph,
                        RightPane::Graph => RightPane::Health,
                        RightPane::Health => RightPane::Preview,
                    };
                    app.pane_scroll = 0;
                    app.refresh_right_pane()?;
                }
                KeyCode::PageDown => app.scroll_pane(3),
                KeyCode::PageUp => app.scroll_pane(-3),
                KeyCode::Char('/') => app.input_mode = InputMode::Search,
                _ => {}
            },
            InputMode::Search => match key.code {
                KeyCode::Esc => app.input_mode = InputMode::Browse,
                KeyCode::Enter => {
                    app.refresh_notes()?;
                    app.refresh_right_pane()?;
                    app.input_mode = InputMode::Browse;
                }
                KeyCode::Backspace => {
                    app.query.pop();
                }
                KeyCode::Char(c) => app.query.push(c),
                _ => {}
            },
        }
    }

    Ok(())
}

pub fn smoke_test(path: PathBuf, via_daemon: bool) -> Result<(), Box<dyn std::error::Error>> {
    let mut app = TuiApp::open(path, via_daemon)?;
    app.refresh_notes()?;
    app.refresh_footer_meta()?;
    app.set_right_pane(RightPane::Backlinks)?;
    app.set_right_pane(RightPane::Graph)?;
    app.set_right_pane(RightPane::Health)?;
    app.set_right_pane(RightPane::Preview)?;
    if app.notes.is_empty() {
        return Err("tui smoke test found no notes to render".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{footer_text, safe_fit, TuiApp, TuiNote};

    #[test]
    fn safe_fit_preserves_grapheme_boundaries() {
        let value = "A🙂B";
        assert_eq!(safe_fit(value, 1), "A");
        assert_eq!(safe_fit(value, 3), "A🙂");
        assert_eq!(safe_fit(value, 4), "A🙂B");
    }

    #[test]
    fn footer_includes_git_and_health_slots() {
        let app = TuiApp {
            path: std::path::PathBuf::from("vault"),
            via_daemon: false,
            daemon_seq: 0,
            daemon_opened: false,
            session: None,
            notes: vec![TuiNote {
                title: "Alpha".into(),
                path: "alpha.md".into(),
            }],
            selected: 0,
            preview: Default::default(),
            pane_lines: Vec::new(),
            query: String::new(),
            input_mode: super::InputMode::Browse,
            right_pane: super::RightPane::Preview,
            pane_scroll: 0,
            show_help: false,
            status: "1 notes".into(),
            git_footer: "git: main | 0 changed".into(),
            health_footer: "health: ok (0 issues)".into(),
        };
        let footer = footer_text(&app);
        assert!(footer.contains("git: main"));
        assert!(footer.contains("health: ok"));
        assert!(footer.contains("selected alpha.md"));
    }
}
