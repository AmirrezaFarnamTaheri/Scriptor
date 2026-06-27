#!/usr/bin/env node

/**
 * Headless SSG export pipeline for CI environments.
 *
 * Usage:
 *   node scripts/ci/export-vault.mjs --vault <path> --profile <name> [--output <dir>] [--ci] [--fail-on-warnings]
 *
 * Exit codes:
 *   0 - Success
 *   1 - Vault not found / unreadable
 *   2 - Profile not found / invalid
 *   3 - Build errors
 *   4 - Daemon start failure
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';

const USAGE = `
Usage: node scripts/ci/export-vault.mjs [options]

Options:
  --vault <path>         Path to the Scriptor vault (required)
  --profile <name>       Export profile name (required)
  --output <dir>         Output directory (default: ./dist)
  --ci                   CI mode: non-interactive, structured exit codes
  --fail-on-warnings     Exit with code 3 on any export warnings
  --daemon <path>        Path to scriptor-daemon binary (default: scriptor-daemon)
  --help                 Show this help message

Exit codes:
  0  Success
  1  Vault not found / unreadable
  2  Profile not found / invalid
  3  Build errors (broken links, missing templates)
  4  Daemon start failure
`.trim();

function parseArgs(argv) {
  const args = {
    vault: null,
    profile: null,
    output: resolve('./dist'),
    ci: false,
    failOnWarnings: false,
    daemon: 'scriptor-daemon',
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--vault':
        args.vault = argv[++i];
        break;
      case '--profile':
        args.profile = argv[++i];
        break;
      case '--output':
        args.output = resolve(argv[++i]);
        break;
      case '--ci':
        args.ci = true;
        break;
      case '--fail-on-warnings':
        args.failOnWarnings = true;
        break;
      case '--daemon':
        args.daemon = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(2);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!args.vault || !args.profile) {
    console.error('Error: --vault and --profile are required');
    console.log(USAGE);
    process.exit(2);
  }

  const vaultPath = resolve(args.vault);
  if (!existsSync(vaultPath)) {
    console.error(`Error: vault not found at ${vaultPath}`);
    process.exit(1);
  }

  console.log(`[export-vault] vault: ${vaultPath}`);
  console.log(`[export-vault] profile: ${args.profile}`);
  console.log(`[export-vault] output: ${args.output}`);

  await mkdir(args.output, { recursive: true });

  const daemon = spawn(
    args.daemon,
    [
      '--headless',
      'export',
      '--vault', vaultPath,
      '--profile', args.profile,
      '--output', args.output,
      ...(args.ci ? ['--ci'] : []),
      ...(args.failOnWarnings ? ['--fail-on-warnings'] : []),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SCRIPTOR_HEADLESS: '1' },
    }
  );

  let stdout = '';
  let stderr = '';

  daemon.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });

  daemon.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve) => {
    daemon.on('close', (code) => resolve(code ?? 4));
    daemon.on('error', () => resolve(4));
  });

  if (exitCode === 4) {
    console.error('[export-vault] Failed to start daemon');
  } else if (exitCode === 0) {
    console.log(`[export-vault] Export complete → ${args.output}`);

    // Write CI metadata
    const meta = {
      exportedAt: new Date().toISOString(),
      vault: vaultPath,
      profile: args.profile,
      output: args.output,
    };
    await writeFile(
      join(args.output, '.export-meta.json'),
      JSON.stringify(meta, null, 2)
    );
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[export-vault] Unexpected error:', err.message);
  process.exit(4);
});
