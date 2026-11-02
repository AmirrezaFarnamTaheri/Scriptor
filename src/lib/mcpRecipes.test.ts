import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getAvailableMcpRecipes, MCP_RECIPES } from './mcpRecipes.ts'

test('MAT-019: recipe cards list only registered tool names', () => {
  assert.deepEqual(getAvailableMcpRecipes(['mcp.search'], 'Research.md').map((recipe) => recipe.id), ['search-research'])
  assert.deepEqual(getAvailableMcpRecipes([], 'Research.md'), [])
})

test('MAT-018: active-note recipes are unavailable when no note is open', () => {
  const tools = [...new Set(MCP_RECIPES.map((recipe) => recipe.toolName))]
  const available = getAvailableMcpRecipes(tools, null)
  assert.ok(available.some((recipe) => recipe.id === 'search-research'))
  assert.ok(available.every((recipe) => !['inspect-outline', 'inspect-backlinks', 'export-graph', 'publish-outline', 'repair-backlinks'].includes(recipe.id)))
  const withNote = getAvailableMcpRecipes(tools, 'Draft.md')
  assert.equal(withNote.length, MCP_RECIPES.length)
})

test('MAT-019: absent registered tools or whitespace note paths cannot create actionable cards', () => {
  assert.deepEqual(getAvailableMcpRecipes(['mcp.inspectOutline'], '  '), [])
  assert.deepEqual(getAvailableMcpRecipes(['mcp.inspectOutline'], 'Draft.md').map((recipe) => recipe.id), ['inspect-outline', 'publish-outline'])
})

test('MAT-019: actual MCP panel renders the filtered recipe list, not every catalog entry', () => {
  const panel = fs.readFileSync(path.resolve(import.meta.dirname, '../components/McpPanel.tsx'), 'utf8')
  assert.match(panel, /availableRecipes\.map\(/)
  assert.doesNotMatch(panel, /MCP_RECIPES\.map\(/)
})

test('MAT-019: no eligible recipes have localized, accurate empty-state copy', () => {
  for (const locale of ['en', 'de', 'fa']) {
    const data = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'i18n', locale + '.json'), 'utf8'))
    assert.ok(typeof data.mcp.noRecipesAvailable === 'string' && data.mcp.noRecipesAvailable.trim().length > 0, locale)
  }
  const panel = fs.readFileSync(path.resolve(import.meta.dirname, '../components/McpPanel.tsx'), 'utf8')
  assert.match(panel, /noRecipesAvailable/)
})
