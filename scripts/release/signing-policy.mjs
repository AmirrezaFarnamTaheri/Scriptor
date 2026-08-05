const PLATFORMS = new Set(['windows', 'macos', 'linux'])
const CHANNELS = new Set(['preview', 'production'])
const ARCHITECTURE_ALIASES = new Map([
  ['x86_64', 'x86_64'],
  ['amd64', 'x86_64'],
  ['x64', 'x86_64'],
  ['aarch64', 'aarch64'],
  ['arm64', 'aarch64'],
])

export function normalizeReleasePlatform(value) {
  const platform = String(value ?? '').trim().toLowerCase()
  if (!PLATFORMS.has(platform)) {
    throw new Error(`unsupported release platform: ${platform || '<empty>'}`)
  }
  return platform
}

export function normalizeReleaseChannel(value) {
  const channel = String(value ?? '').trim().toLowerCase()
  if (!CHANNELS.has(channel)) {
    throw new Error(`unsupported release channel: ${channel || '<empty>'}`)
  }
  return channel
}

export function normalizeReleaseArchitecture(value) {
  const architecture = String(value ?? '').trim().toLowerCase()
  const normalized = ARCHITECTURE_ALIASES.get(architecture)
  if (!normalized) {
    throw new Error(`unsupported release architecture: ${architecture || '<empty>'}`)
  }
  return normalized
}

export function requiredProductionInputs(platform) {
  normalizeReleasePlatform(platform)
  return []
}

export function validateSigningEnvironment({ platform, architecture, channel }) {
  return {
    platform: normalizeReleasePlatform(platform),
    architecture: normalizeReleaseArchitecture(architecture),
    channel: normalizeReleaseChannel(channel),
    requiredInputs: [],
    signingMode: 'unsigned',
  }
}
