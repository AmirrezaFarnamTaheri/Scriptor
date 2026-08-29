import { Suspense } from 'react'

import type { TemplateDefinition } from '../../lib/knowledge/templates'
import type { AppTheme } from '../../hooks/useAppTheme'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { ObsidianImportDialog, PanelFallback, PluginManagerCenter, TemplatePicker } from './lazyPanels'

interface CapabilityWorkflowOverlaysProps {
  templatePickerOpen: boolean
  obsidianImportOpen: boolean
  pluginManagerOpen: boolean
  templates: TemplateDefinition[]
  onCloseTemplatePicker: () => void
  onCloseObsidianImport: () => void
  onCreateBlankNote: () => void
  onCreateFromTemplate: (path: string) => void
  onObsidianImported: (notesImported: number) => void
  theme: AppTheme
  onThemeChange: (theme: AppTheme) => void
  onClosePluginManager: () => void
  onOpenPluginMarketplace: () => void
}

export function CapabilityWorkflowOverlays(props: CapabilityWorkflowOverlaysProps) {
  return (
    <>
      {props.pluginManagerOpen ? (
        <ErrorBoundary name="built-in-modules-and-palettes" fallback={<PanelErrorFallback title="Built-in modules and color palettes" onDismiss={props.onClosePluginManager} />}>
          <Suspense fallback={<PanelFallback />}>
            <PluginManagerCenter
              isOpen
              onClose={props.onClosePluginManager}
              currentTheme={props.theme}
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
