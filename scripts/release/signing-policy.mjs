const PLATFORMS = new Set(['windows', 'macos', 'linux'])
const CHANNELS = new Set(['preview', 'production'])
const TRUST_PROFILES = new Set(['unsigned', 'native-signed'])
const ARCHITECTURE_ALIASES = new Map([
  ['x86_64', 'x86_64'],
  ['amd64', 'x86_64'],
  ['x64', 'x86_64'],
  ['aarch64', 'aarch64'],
  ['arm64', 'aarch64'],
])

const NATIVE_SIGNING_INPUTS = Object.freeze({
  windows: Object.freeze([
    'WINDOWS_CERTIFICATE',
    'WINDOWS_CERTIFICATE_PASSWORD',
    'WINDOWS_TIMESTAMP_URL',
  ]),
  macos: Object.freeze([
    'APPLE_CERTIFICATE',
    'APPLE_CERTIFICATE_PASSWORD',
    'APPLE_ID',
    'APPLE_PASSWORD',
    'APPLE_TEAM_ID',
  ]),
  linux: Object.freeze([]),
})

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

export function normalizeTrustProfile(value) {
  const profile = String(value ?? 'unsigned').trim().toLowerCase()
  if (!TRUST_PROFILES.has(profile)) {
    throw new Error(`unsupported release trust profile: ${profile || '<empty>'}`)
  }
  return profile
}

export function normalizeReleaseArchitecture(value) {
  const architecture = String(value ?? '').trim().toLowerCase()
  const normalized = ARCHITECTURE_ALIASES.get(architecture)
  if (!normalized) {
    throw new Error(`unsupported release architecture: ${architecture || '<empty>'}`)
  }
  return normalized
}

export function requiredProductionInputs(platform, trustProfile = 'unsigned') {
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const profile = normalizeTrustProfile(trustProfile)
  if (profile === 'unsigned') return []
  return [...NATIVE_SIGNING_INPUTS[normalizedPlatform]]
}

function assertInputsPresent(requiredInputs, env) {
  const missing = requiredInputs.filter((name) => !String(env?.[name] ?? '').trim())
  if (missing.length > 0) {
    throw new Error(`native-signed release is missing required input(s): ${missing.join(', ')}`)
  }
}

export function validateSigningEnvironment({
  platform,
  architecture,
  channel,
  trustProfile = 'unsigned',
  env = process.env,
}) {
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const normalizedArchitecture = normalizeReleaseArchitecture(architecture)
  const normalizedChannel = normalizeReleaseChannel(channel)
  const normalizedTrustProfile = normalizeTrustProfile(trustProfile)
  const requiredInputs = requiredProductionInputs(normalizedPlatform, normalizedTrustProfile)

  // Selecting native signing is an explicit request for signed artifacts even in
  // preview mode. Fail closed rather than silently falling back to unsigned output.
  if (normalizedTrustProfile === 'native-signed') {
    assertInputsPresent(requiredInputs, env)
  }

  const signingMode = normalizedTrustProfile === 'unsigned'
    ? 'unsigned'
    : normalizedPlatform === 'windows'
      ? 'authenticode'
      : normalizedPlatform === 'macos'
        ? 'developer-id'
        : 'unsigned-attested'

  return {
    platform: normalizedPlatform,
    architecture: normalizedArchitecture,
    channel: normalizedChannel,
    trustProfile: normalizedTrustProfile,
    requiredInputs,
    signingMode,
  }
}
