//! `scriptor` command-line entrypoint: parse arguments and dispatch.

use clap::Parser;

use command_line::Cli;

mod bench;
mod command_line;
mod commands;
mod daemon_client;
mod doctor;
mod term_markdown;
mod tui;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = scriptor_system_bridge::observability::init_observability("cli");
    let cli = Cli::parse();
    commands::dispatch(cli)
}

#[cfg(test)]
mod cli_tests {
    use std::path::PathBuf;

    use clap::{CommandFactory, Parser};

    use crate::command_line::{Cli, Commands, exit_code};
    #[test]
    fn global_in_process_defaults_false() {
        let cli = Cli::try_parse_from(["scriptor", "search", "/tmp/v", "q"]).expect("parse");
        assert!(!cli.in_process);
    }

    #[test]
    fn tui_defaults_to_daemon_routing() {
        let cli = Cli::try_parse_from(["scriptor", "tui", "/tmp/vault"]).expect("parse");
        assert!(!cli.in_process);
        match cli.command {
            Commands::Tui { in_process, .. } => assert!(!in_process),
            _ => panic!("expected tui command"),
        }
    }

    #[test]
    fn version_flag_is_available() {
        // Arrange / Act
        let error =
            Cli::try_parse_from(["scriptor", "--version"]).expect_err("version exits early");

        // Assert
        assert_eq!(error.kind(), clap::error::ErrorKind::DisplayVersion);
        assert!(error.to_string().contains(env!("CARGO_PKG_VERSION")));
    }

    #[test]
    fn no_interactive_defaults_false_and_accepts_no_prompt_alias() {
        let default = Cli::try_parse_from(["scriptor", "system-info"]).expect("parse");
        assert!(!default.no_interactive);

        let long = Cli::try_parse_from(["scriptor", "--no-interactive", "system-info"])
            .expect("parse --no-interactive");
        assert!(long.no_interactive);

        let alias =
            Cli::try_parse_from(["scriptor", "--no-prompt", "system-info"]).expect("parse alias");
        assert!(alias.no_interactive);
    }

    #[test]
    fn completions_command_generates_a_script() {
        // Arrange
        let cli = Cli::try_parse_from(["scriptor", "completions", "bash"]).expect("parse");
        let shell = match cli.command {
            Commands::Completions { shell } => shell,
            _ => panic!("expected completions command"),
        };
        let mut command = Cli::command();
        let mut buffer: Vec<u8> = Vec::new();

        // Act
        clap_complete::generate(shell, &mut command, "scriptor", &mut buffer);

        // Assert
        let script = String::from_utf8(buffer).expect("utf8 completion script");
        assert!(script.contains("scriptor"));
        assert!(!script.is_empty());
    }

    #[test]
    fn doctor_accepts_an_optional_vault_path() {
        let without = Cli::try_parse_from(["scriptor", "doctor"]).expect("parse");
        match without.command {
            Commands::Doctor { path } => assert!(path.is_none()),
            _ => panic!("expected doctor command"),
        }

        let with = Cli::try_parse_from(["scriptor", "doctor", "/tmp/vault"]).expect("parse");
        match with.command {
            Commands::Doctor { path } => assert_eq!(path, Some(PathBuf::from("/tmp/vault"))),
            _ => panic!("expected doctor command"),
        }
    }

    #[test]
    fn exit_codes_stay_outside_the_reserved_usage_range() {
        assert_eq!(exit_code::LINT_ISSUES, 3);
        assert_eq!(exit_code::BUDGET_EXCEEDED, 4);
        assert_eq!(exit_code::DOCTOR_FAILED, 5);
        for code in [
            exit_code::LINT_ISSUES,
            exit_code::BUDGET_EXCEEDED,
            exit_code::DOCTOR_FAILED,
        ] {
            assert!((3..=125).contains(&code), "code {code} outside app range");
        }
    }
}
