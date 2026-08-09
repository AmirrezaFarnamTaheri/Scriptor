use clap::{Parser, Subcommand};
use scriptor_daemon::mcp_stdio::{McpStdioOptions, run_mcp_stdio};
use scriptor_daemon::transport;

#[derive(Debug, Parser)]
#[command(
    name = "scriptor-daemon",
    about = "Headless Scriptor vault engine over local IPC"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Bind a local socket and serve RPC requests until interrupted.
    Serve {
        #[arg(long, help = "Override the default local socket name/path")]
        socket: Option<String>,
    },
    /// Verify the daemon endpoint file is readable.
    Endpoint,
    /// Serve MCP tools over stdio JSON-RPC (dev/agent integrations).
    McpStdio {
        #[arg(long, help = "Vault root directory path")]
        vault: String,
        #[arg(
            long,
            help = "Apply MCP write tools directly without GUI approval (development only)"
        )]
        trust_stdio: bool,
    },
}

fn main() {
    let _ = scriptor_system_bridge::observability::init_observability("daemon");
    if let Err(error) = run() {
        eprintln!("scriptor-daemon error: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Serve { socket } => transport::serve_forever(socket).map_err(Into::into),
        Commands::Endpoint => {
            let endpoint = transport::read_endpoint()?;
            println!("{}", serde_json::to_string_pretty(&endpoint)?);
            Ok(())
        }
        Commands::McpStdio { vault, trust_stdio } => run_mcp_stdio(McpStdioOptions {
            vault_path: vault,
            trust_stdio,
        })
        .map_err(Into::into),
    }
}
