#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

/**
 * Base URL for pre-built plugin pack archives on GitHub Releases.
 * Set SCRIPTOR_RELEASE_BASE_URL to override (useful for staging channels).
 */
export const GITHUB_RELEASE_BASE_URL =
  process.env.SCRIPTOR_RELEASE_BASE_URL ??
  'https://github.com/AmirrezaFarnamTaheri/Scriptor/releases/latest/download'

/**
 * Installer profile definitions.
 *
 * downloadSource values:
 *   'local'          – plugins are compiled/copied from the local workspace at
 *                      build time (used only for the two lightest profiles where
 *                      no extra binary assets are needed).
 *   'github-release' – plugin packs and heavy native assets are fetched from
 *                      GitHub Releases at packaging time, dramatically reducing
 *                      installer build time and output size.
 */
export const PROFILES = {
  focused: {
    name: 'Focused Markdown',
    description: 'Pure distraction-free markdown text editor without extra background plugins',
    plugins: [],
    downloadSource: 'local',
  },
  minimal: {
    name: 'Minimal',
    description: 'Core editor and basic Pandoc/Typst markdown export engine',
    plugins: ['scriptor.export'],
    downloadSource: 'local',
  },
  writer: {
    name: 'Creative Writer & Author',
    description: 'Core editor, export engine, and visual Canvas board for plotting and outlining',
    plugins: ['scriptor.export', 'scriptor.canvas'],
    downloadSource: 'github-release',
    githubReleaseUrl: GITHUB_RELEASE_BASE_URL,
  },
  scientific: {
    name: 'Scientific & Academic',
    description: 'Core editor, citation manager, BibTeX/CSL support, and link topology graph',
    plugins: ['scriptor.export', 'scriptor.citations', 'scriptor.graph'],
    downloadSource: 'github-release',
    githubReleaseUrl: GITHUB_RELEASE_BASE_URL,
  },
  researcher: {
    name: 'Data & Research Specialist',
    description: 'Core editor, link topology graph, and MCP Tool Server for external AI/LLM agent queries',
    plugins: ['scriptor.export', 'scriptor.graph', 'scriptor.mcp'],
    downloadSource: 'github-release',
    githubReleaseUrl: GITHUB_RELEASE_BASE_URL,
  },
  developer: {
    name: 'Developer & Power User',
    description: 'Core editor, export engine, link graph, Canvas board, and MCP Tool Server',
    plugins: ['scriptor.export', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
    downloadSource: 'github-release',
    githubReleaseUrl: GITHUB_RELEASE_BASE_URL,
  },
  complete: {
    name: 'Complete Suite',
    description: 'Full workspace suite including Canvas, Citations, Graph, Export, and MCP server',
    plugins: ['scriptor.export', 'scriptor.citations', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
    downloadSource: 'github-release',
    githubReleaseUrl: GITHUB_RELEASE_BASE_URL,
  },
}

function parseProfile(argv) {
  const index = argv.indexOf('--profile')
  if (index !== -1 && argv[index + 1]) {
    const requested = argv[index + 1].toLowerCase()
    if (PROFILES[requested]) return requested
  }
  return 'complete'
}

const selectedProfileKey = parseProfile(process.argv)
const selectedProfile = PROFILES[selectedProfileKey]

const output = {
  profile: selectedProfileKey,
  ...selectedProfile,
  timestamp: new Date().toISOString(),
}

const targetDir = path.join(root, 'release-output')
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const outputPath = path.join(targetDir, 'installer-profile.json')
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
console.log(`Generated installer profile receipt at ${outputPath} (profile: ${selectedProfileKey})`)
