import type {
  PluginCapability,
  PluginManifest,
  PluginPermission,
} from '@scriptor/core/contracts/plugin'

export const PLUGIN_API_VERSION = '0.1.0'

const VALID_CAPABILITIES = new Set<PluginCapability>([
  'command',
  'renderer-extension',
  'export-profile',
  'mcp-tool',
  'inspector-widget',
  'vault-health-check',
  'canvas-tool',
  'canvas-block',
  'template-pack',
])

const BLOCKED_PERMISSIONS = new Set<PluginPermission['permission']>([
  'external-process',
  'secrets',
])

const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/

function isCompatibleApiVersion(version: string): boolean {
  const [major] = version.split('.')
  const [expectedMajor] = PLUGIN_API_VERSION.split('.')
  return major === expectedMajor
}

export interface ManifestValidationResult {
  ok: boolean
  errors: string[]
}

export function validatePluginManifest(manifest: PluginManifest): ManifestValidationResult {
  const errors: string[] = []

  if (!manifest.id || !ID_PATTERN.test(manifest.id)) {
    errors.push('plugin id must be lowercase dotted identifier')
  }
  if (!manifest.name?.trim()) errors.push('plugin name is required')
  if (!manifest.version?.trim()) errors.push('plugin version is required')
  if (!manifest.publisher?.trim()) errors.push('plugin publisher is required')
  if (!manifest.description?.trim()) errors.push('plugin description is required')
  if (!manifest.activation?.length) errors.push('plugin activation policy is required')
  if (!manifest.capabilities?.length) errors.push('plugin capabilities are required')
  if (!manifest.permissions?.length) errors.push('plugin permissions are required')

  const apiVersion = manifest.apiVersion ?? PLUGIN_API_VERSION
  if (!isCompatibleApiVersion(apiVersion)) {
    errors.push(`plugin apiVersion ${apiVersion} is incompatible with host ${PLUGIN_API_VERSION}`)
  }

  for (const capability of manifest.capabilities ?? []) {
    if (!VALID_CAPABILITIES.has(capability)) {
      errors.push(`unsupported capability: ${capability}`)
    }
  }

  for (const entry of manifest.permissions ?? []) {
    if (BLOCKED_PERMISSIONS.has(entry.permission)) {
      errors.push(`blocked permission in v1 plugins: ${entry.permission}`)
    }
    if (entry.permission === 'dangerous' && !entry.optional) {
      errors.push('dangerous permission must be marked optional until sandbox policy exists')
    }
    if (!entry.reason?.trim()) {
      errors.push(`permission reason required for ${entry.permission}`)
    }
  }

  if (manifest.contributes?.mcpTools?.length && !manifest.capabilities.includes('mcp-tool')) {
    errors.push('mcp tool contributions require mcp-tool capability')
  }
  if (manifest.contributes?.exportProfiles?.length && !manifest.capabilities.includes('export-profile')) {
    errors.push('export profile contributions require export-profile capability')
  }
  if (manifest.contributes?.rendererExtensions?.length && !manifest.capabilities.includes('renderer-extension')) {
    errors.push('renderer extensions require renderer-extension capability')
  }
  if (manifest.contributes?.inspectorWidgets?.length && !manifest.capabilities.includes('inspector-widget')) {
    errors.push('inspector widget contributions require inspector-widget capability')
  }
  if (manifest.contributes?.templatePacks?.length && !manifest.capabilities.includes('template-pack')) {
    errors.push('template pack contributions require template-pack capability')
  }
  if (manifest.contributes?.canvasTools?.length && !manifest.capabilities.includes('canvas-tool')) {
    errors.push('canvas tool contributions require canvas-tool capability')
  }
  if (manifest.contributes?.canvasBlocks?.length && !manifest.capabilities.includes('canvas-block')) {
    errors.push('canvas block contributions require canvas-block capability')
  }

  return { ok: errors.length === 0, errors }
}

export function runManifestValidationTests(): string[] {
  const failures: string[] = []

  const valid: PluginManifest = {
    id: 'scriptor.sample',
    name: 'Sample',
    version: '0.1.0',
    publisher: 'Scriptor',
    description: 'Sample plugin',
    activation: ['manual'],
    capabilities: ['command'],
    permissions: [{ permission: 'read', reason: 'Read vault summaries' }],
    contributes: {
      commands: [
        {
          commandId: 'vault.health',
          label: 'Health',
          category: 'Vault',
          permission: 'read',
        },
      ],
    },
  }

  if (!validatePluginManifest(valid).ok) failures.push('valid manifest should pass')

  const malicious: PluginManifest = {
    ...valid,
    id: 'evil.plugin',
    permissions: [{ permission: 'external-process', reason: 'spawn shell' }],
  }
  if (validatePluginManifest(malicious).ok) failures.push('external-process permission should be blocked')

  const canvasKit: PluginManifest = {
    id: 'scriptor.canvas-kit',
    name: 'Canvas Kit',
    version: '0.1.0',
    publisher: 'Scriptor',
    description: 'Built-in canvas templates.',
    activation: ['on-startup'],
    capabilities: ['canvas-tool', 'template-pack'],
    permissions: [{ permission: 'read', reason: 'Read note metadata for canvas blocks' }],
    contributes: {
      templatePacks: [
        {
          id: 'research-board',
          label: 'Research Board',
          categories: ['research'],
          canvasCompatible: true,
          documentCompatible: false,
        },
      ],
    },
  }
  if (!validatePluginManifest(canvasKit).ok) failures.push('canvas-kit manifest should pass validation')

  const maliciousFixture: PluginManifest = {
    id: 'fixture.malicious-plugin',
    name: 'Malicious Plugin Fixture',
    version: '0.0.0',
    publisher: 'Quality Engineering',
    description: 'Fixture used to prove manifest validation blocks unsafe permissions.',
    activation: ['manual'],
    capabilities: ['command'],
    permissions: [{ permission: 'external-process', reason: 'Attempt to spawn host shell' }],
  }
  if (validatePluginManifest(maliciousFixture).ok) {
    failures.push('malicious-manifest fixture should fail validation')
  }

  const incompatible: PluginManifest = {
    id: 'scriptor.old-api',
    name: 'Old API',
    version: '9.0.0',
    apiVersion: '9.0.0',
    publisher: 'Scriptor',
    description: 'Incompatible plugin',
    activation: ['manual'],
    capabilities: ['command'],
    permissions: [{ permission: 'read', reason: 'test' }],
  }
  if (validatePluginManifest(incompatible).ok) {
    failures.push('incompatible apiVersion should fail validation')
  }

  const publishPack: PluginManifest = {
    id: 'scriptor.publish-pack',
    name: 'Publish Pack',
    version: '0.1.0',
    apiVersion: '0.1.0',
    publisher: 'Scriptor',
    description: 'Sample renderer and export contributions.',
    activation: ['on-vault-open'],
    capabilities: ['renderer-extension', 'export-profile'],
    permissions: [{ permission: 'read', reason: 'Read note metadata for publication previews' }],
    contributes: {
      rendererExtensions: [
        { id: 'publish-callout', label: 'Publish callout', handles: 'document', priority: 10 },
      ],
      exportProfiles: [
        { id: 'html-publish-pack', label: 'Publish HTML', format: 'html' },
        { id: 'wechat-html-publish', label: 'WeChat HTML', format: 'wechat-html' },
      ],
    },
  }
  if (!validatePluginManifest(publishPack).ok) failures.push('publish-pack manifest should pass validation')

  return failures
}
