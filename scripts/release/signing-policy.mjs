const PLATFORMS = new Set(['windows', 'macos', 'linux'])
const CHANNELS = new Set(['preview', 'production'])

const REQUIRED_PRODUCTION_INPUTS = {
  windows: ['WINDOWS_CERTIFICATE', 'WINDOWS_CERTIFICATE_PASSWORD'],
  macos: [
    'APPLE_CERTIFICATE',
    'APPLE_CERTIFICATE_PASSWORD',
    'APPLE_SIGNING_IDENTITY',
    'APPLE_ID',
    'APPLE_PASSWORD',
    'APPLE_TEAM_ID',
  ],
  linux: ['LINUX_SIGNING_KEY'],
}

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

export function requiredProductionInputs(platform) {
  return [...REQUIRED_PRODUCTION_INPUTS[normalizeReleasePlatform(platform)]]
}

export function validateSigningEnvironment({ platform, channel, env = process.env }) {
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const normalizedChannel = normalizeReleaseChannel(channel)
  if (normalizedChannel === 'preview') {
    return {
      platform: normalizedPlatform,
      channel: normalizedChannel,
      requiredInputs: [],
    }
  }

  const requiredInputs = requiredProductionInputs(normalizedPlatform)
  const missing = requiredInputs.filter((name) => !String(env[name] ?? '').trim())
  if (missing.length > 0) {
    throw new Error(
      `production ${normalizedPlatform} signing requires: ${missing.join(', ')}`,
    )
  }

  return {
    platform: normalizedPlatform,
    channel: normalizedChannel,
    requiredInputs,
  }
}
