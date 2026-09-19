import { Suspense } from 'react'

import type { TemplateDefinition } from '../../lib/knowledge/templates'
import type { AppTheme, AppearanceMode, ResolvedAppearance } from '../../hooks/useAppTheme'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { ObsidianImportDialog, PanelFallback, PluginManagerCenter, TemplatePicker } from './lazyPanels'

interface CapabilityWorkflowOverlaysProps {
  templatePickerOpen: boolean
  obsidianImportOpen: boolean
  pluginManagerOpen: boolean
  pluginManagerScope: 'palettes' | 'plugins'
  templates: TemplateDefinition[]
  onCloseTemplatePicker: () => void
  onCloseObsidianImport: () => void
  onCreateBlankNote: () => void
  onCreateFromTemplate: (path: string) => void
  onObsidianImported: (notesImported: number) => void
  theme: AppTheme
  appearance: AppearanceMode
  resolvedAppearance: ResolvedAppearance
  onThemeChange: (theme: AppTheme) => void
  onClosePluginManager: () => void
  onOpenPluginMarketplace: () => void
}

export function CapabilityWorkflowOverlays(props: CapabilityWorkflowOverlaysProps) {
  return (
    <>
      {props.pluginManagerOpen ? (
        <ErrorBoundary
          name={props.pluginManagerScope === 'palettes' ? 'color-palettes' : 'built-in-modules'}
          fallback={
            <PanelErrorFallback
              title={props.pluginManagerScope === 'palettes' ? 'Color palettes' : 'Built-in modules'}
              onDismiss={props.onClosePluginManager}
            />
          }
        >
          <Suspense fallback={<PanelFallback />}>
            <PluginManagerCenter
              isOpen
              scope={props.pluginManagerScope}
              onClose={props.onClosePluginManager}
              currentTheme={props.theme}
              appearance={props.appearance}
              resolvedAppearance={props.resolvedAppearance}
              onThemeChange={props.onThemeChange}
              onOpenPluginMarketplace={props.onOpenPluginMarketplace}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {props.templatePickerOpen ? (
        <ErrorBoundary name="template-picker" fallback={<PanelErrorFallback title="The template picker" onDismiss={props.onCloseTemplatePicker} />}>
          <Suspense fallback={<PanelFallback />}>
            <TemplatePicker
              templates={props.templates}
              onClose={props.onCloseTemplatePicker}
              onSelect={(template) => {
                props.onCloseTemplatePicker()
                if (template) props.onCreateFromTemplate(template.path)
                else props.onCreateBlankNote()
              }}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {props.obsidianImportOpen ? (
        <ErrorBoundary name="obsidian-import" fallback={<PanelErrorFallback title="Obsidian import" onDismiss={props.onCloseObsidianImport} />}>
          <Suspense fallback={<PanelFallback />}>
            <ObsidianImportDialog
              onClose={props.onCloseObsidianImport}
              onImported={(result) => props.onObsidianImported(result.notesImported)}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  )
}
