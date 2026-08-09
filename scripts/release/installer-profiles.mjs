#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

export const PROFILES = {
  focused: {
    name: 'Focused Markdown',
    description: 'Pure distraction-free markdown text editor without extra background plugins',
    plugins: [],
  },
  minimal: {
    name: 'Minimal',
    description: 'Core editor and basic Pandoc/Typst markdown export engine',
    plugins: ['scriptor.export'],
  },
  writer: {
    name: 'Creative Writer & Author',
    description: 'Core editor, export engine, and visual Canvas board for plotting and outlining',
    plugins: ['scriptor.export', 'scriptor.canvas'],
  },
  scientific: {
    name: 'Scientific & Academic',
    description: 'Core editor, citation manager, BibTeX/CSL support, and link topology graph',
    plugins: ['scriptor.export', 'scriptor.citations', 'scriptor.graph'],
  },
  researcher: {
    name: 'Data & Research Specialist',
    description: 'Core editor, link topology graph, and MCP Tool Server for external AI/LLM agent queries',
    plugins: ['scriptor.export', 'scriptor.graph', 'scriptor.mcp'],
  },
  developer: {
    name: 'Developer & Power User',
    description: 'Core editor, export engine, link graph, Canvas board, and MCP Tool Server',
    plugins: ['scriptor.export', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
  },
  complete: {
    name: 'Complete Suite',
    description: 'Full workspace suite including Canvas, Citations, Graph, Export, and MCP server',
    plugins: ['scriptor.export', 'scriptor.citations', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
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
