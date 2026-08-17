import type {
  PluginActivation,
  PluginCapability,
  PluginManifest,
  PluginPermission,
} from '@scriptor/core/contracts/plugin'

export const PLUGIN_API_VERSION = '1.0.0'

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

// Dot-separated lowercase segments: no leading/trailing dots and no `..`.
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*$/
const MAX_ID_LENGTH = 64

function isCurrentApiVersion(version: string): boolean {
  return version === PLUGIN_API_VERSION
}

function asArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : []
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

export interface ManifestValidationResult {
  ok: boolean
  errors: string[]
}

export function validatePluginManifest(manifest: PluginManifest): ManifestValidationResult {
  const errors: string[] = []

  if (!manifest.id || manifest.id.length > MAX_ID_LENGTH || !ID_PATTERN.test(manifest.id)) {
    errors.push('plugin id must be lowercase dotted identifier')
  }
  if (!manifest.name?.trim()) errors.push('plugin name is required')
  if (!manifest.version?.trim()) errors.push('plugin version is required')
  if (!manifest.publisher?.trim()) errors.push('plugin publisher is required')
  if (!manifest.description?.trim()) errors.push('plugin description is required')

  const activation = asArray(manifest.activation)
  const capabilities = asArray(manifest.capabilities)
  const permissions = asArray(manifest.permissions)
  if (activation.length === 0) errors.push('plugin activation policy is required')
  if (capabilities.length === 0) errors.push('plugin capabilities are required')
  if (permissions.length === 0) errors.push('plugin permissions are required')

  const apiVersion = manifest.apiVersion ?? PLUGIN_API_VERSION
  if (!isCurrentApiVersion(apiVersion)) {
    errors.push(`plugin apiVersion must equal host ${PLUGIN_API_VERSION}; received ${apiVersion}`)
  }

  for (const capability of capabilities) {
    if (!VALID_CAPABILITIES.has(capability)) {
      errors.push(`unsupported capability: ${capability}`)
    }
  }

  for (const entry of permissions) {
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

  if (hasEntries(manifest.contributes?.mcpTools) && !capabilities.includes('mcp-tool')) {
    errors.push('mcp tool contributions require mcp-tool capability')
  }
  if (hasEntries(manifest.contributes?.exportProfiles) && !capabilities.includes('export-profile')) {
    errors.push('export profile contributions require export-profile capability')
  }
  if (hasEntries(manifest.contributes?.rendererExtensions) && !capabilities.includes('renderer-extension')) {
    errors.push('renderer extensions require renderer-extension capability')
  }
  if (hasEntries(manifest.contributes?.inspectorWidgets) && !capabilities.includes('inspector-widget')) {
    errors.push('inspector widget contributions require inspector-widget capability')
  }
  if (hasEntries(manifest.contributes?.templatePacks) && !capabilities.includes('template-pack')) {
    errors.push('template pack contributions require template-pack capability')
  }
  if (hasEntries(manifest.contributes?.canvasTools) && !capabilities.includes('canvas-tool')) {
    errors.push('canvas tool contributions require canvas-tool capability')
  }
  if (hasEntries(manifest.contributes?.canvasBlocks) && !capabilities.includes('canvas-block')) {
    errors.push('canvas block contributions require canvas-block capability')
  }

  if (manifest.rustFeatureGate !== undefined && typeof manifest.rustFeatureGate !== 'string') {
    errors.push('rustFeatureGate must be a string')
  }
  if (manifest.capabilityId !== undefined && typeof manifest.capabilityId !== 'string') {
    errors.push('capabilityId must be a string')
  } else if (manifest.capabilityId !== undefined && !/^scriptor\.[a-z0-9-]+$/.test(manifest.capabilityId)) {
    errors.push('capabilityId must be a canonical scriptor.* identifier')
  }

  return { ok: errors.length === 0, errors }
}

export function validateManifest(input: Partial<PluginManifest>): PluginManifest {
  const manifest = {
    activation: ['manual'] as PluginActivation[],
    capabilities: ['command'] as PluginCapability[],
    permissions: [{ permission: 'read', reason: 'Default capability access' }] as PluginPermission[],
    publisher: (input as { author?: string }).author ?? input.publisher ?? 'Scriptor Team',
    ...input,
  } as PluginManifest

  const result = validatePluginManifest(manifest)
  if (!result.ok) {
    throw new Error(`Invalid manifest: ${result.errors.join(', ')}`)
  }
  return manifest
}

export function runManifestValidationTests(): string[] {
  const failures: string[] = []

  const valid: PluginManifest = {
    id: 'scriptor.sample',
    name: 'Sample',
    version: '1.0.0',
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
    version: '1.0.0',
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
    version: '1.0.0',
    apiVersion: '1.0.0',
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

  const missingCapabilities = {
    ...valid,
    id: 'scriptor.no-caps',
    capabilities: undefined,
    contributes: {
      mcpTools: [{ id: 'tool', label: 'Tool' }],
    },
  } as unknown as PluginManifest
  try {
    const result = validatePluginManifest(missingCapabilities)
    if (result.ok) failures.push('manifest without capabilities should fail validation')
    if (!result.errors.some((error) => error.includes('mcp-tool capability'))) {
      failures.push('contribution checks should still run when capabilities is absent')
    }
  } catch {
    failures.push('absent capabilities must not throw during validation')
  }

  const nonArrayFields = {
    ...valid,
    id: 'scriptor.bad-shapes',
    capabilities: 'command',
    permissions: { permission: 'read' },
    activation: 'manual',
  } as unknown as PluginManifest
  try {
    if (validatePluginManifest(nonArrayFields).ok) {
      failures.push('non-array capability/permission fields should fail validation')
    }
  } catch {
    failures.push('non-array capability/permission fields must not throw')
  }

  const differentContract: PluginManifest = {
    ...valid,
    id: 'scriptor.different-contract',
    apiVersion: '1.0.1',
  }
  if (validatePluginManifest(differentContract).ok) {
    failures.push('non-current apiVersion should fail validation')
  }

  for (const badId of ['bad..id', '.leading', 'trailing.', 'UPPER.case', `a${'b'.repeat(80)}`]) {
    if (validatePluginManifest({ ...valid, id: badId }).ok) {
      failures.push(`plugin id "${badId}" should fail validation`)
    }
  }

  return failures
}
