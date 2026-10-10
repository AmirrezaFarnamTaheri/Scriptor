import { useCallback, useMemo, useState } from 'react'
import type { PaletteCommand } from '../components/CommandPalette'
import type { PluginWorkspaceDefinition } from '@scriptor/plugin-api'
import { useI18n } from '../lib/i18n'
import { reviewFeatureCopy, type ReviewFeatureName } from '../lib/reviewFeatureCopy'

export type ReviewFeature = ReviewFeatureName | 'plugin'
const features: Array<{ feature: ReviewFeatureName; id: string; label: string; keywords: string[] }> = [
  { feature: 'database', id: 'open-database-studio', label: 'Database studio', keywords: ['table', 'gallery', 'formula', 'filter', 'frontmatter'] },
  { feature: 'capture', id: 'open-capture-reviewer', label: 'Capture reviewer', keywords: ['article', 'clip', 'web', 'research'] },
  { feature: 'publishing', id: 'open-publishing-studio', label: 'Publishing studio', keywords: ['publish', 'privacy', 'site', 'deployment', 'domain'] },
  { feature: 'collaboration', id: 'open-drive-collaboration', label: 'Drive collaboration', keywords: ['share', 'merge', 'collaborate'] },
  { feature: 'diagram', id: 'open-diagram-studio', label: 'Diagram studio', keywords: ['mermaid', 'plantuml', 'diagram'] },
  { feature: 'runtime', id: 'open-runtime-console', label: 'Runtime console', keywords: ['python', 'node', 'code', 'repl'] },
  { feature: 'semantic', id: 'open-semantic-inspector', label: 'Semantic inspector', keywords: ['embeddings', 'model', 'pca', 'similarity'] },
  { feature: 'assets', id: 'open-asset-deck', label: 'Asset deck', keywords: ['assets', 'papers', 'pdf', 'annotations'] },
]
export function useReviewFeatureWorkspaces(available: boolean, pluginWorkspaces: PluginWorkspaceDefinition[]) {
  const { locale } = useI18n()
  const [active, setActive] = useState<ReviewFeature | null>(null)
  const [pluginWorkspace, setPluginWorkspace] = useState<PluginWorkspaceDefinition | null>(null)
  const close = useCallback(() => setActive(null), [])
  const commands = useMemo<PaletteCommand[]>(() => available ? [
    ...features.map(({ feature, ...command }) => ({
      ...command, label: reviewFeatureCopy(locale)[feature],
      keywords: [...command.keywords, command.label],
      category: 'Workspace', run: () => setActive(feature),
    })),
    ...pluginWorkspaces.map(view => ({ id: `workspace:${view.pluginId}:${view.id}`, label: view.title, keywords: [view.description, view.pluginId], category: 'Plugin workspaces', run: () => { setPluginWorkspace(view); setActive('plugin') } })),
  ] : [], [available, pluginWorkspaces, locale])
  return { active, close, commands, pluginWorkspace }
}
