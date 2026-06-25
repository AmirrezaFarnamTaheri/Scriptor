#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const vault = process.argv[2] ?? 'packages/test-fixtures/vaults/minimal'

process.chdir(root)
console.log(`Running Scriptor TUI smoke against ${vault}`)
execSync(`cargo run -p scriptor-cli -- tui ${vault} --smoke-test`, { stdio: 'inherit' })
