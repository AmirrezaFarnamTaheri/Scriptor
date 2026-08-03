function unquoteYamlKey(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed)
  }
  return trimmed
}

export function npmPurl(name, version) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/')
    if (slash <= 1) throw new Error(`invalid scoped npm package name: ${name}`)
    const scope = encodeURIComponent(name.slice(0, slash))
    const packageName = encodeURIComponent(name.slice(slash + 1))
    return `pkg:npm/${scope}/${packageName}@${encodeURIComponent(version)}`
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`
}

function splitNpmLockKey(key) {
  const separator = key.lastIndexOf('@')
  if (separator <= 0 || separator === key.length - 1) return null
  return { name: key.slice(0, separator), version: key.slice(separator + 1) }
}

function integrityToHash(integrity) {
  const match = integrity?.match(/^sha512-([A-Za-z0-9+/=]+)$/)
  if (!match) return undefined
  return [{ alg: 'SHA-512', content: Buffer.from(match[1], 'base64').toString('hex') }]
}

export function parsePnpmLockPackages(contents) {
  const lines = contents.split(/\r?\n/)
  const packagesStart = lines.findIndex((line) => line === 'packages:')
  if (packagesStart < 0) throw new Error('pnpm lockfile has no packages section')
  const snapshotsStart = lines.findIndex((line, index) => index > packagesStart && line === 'snapshots:')
  const end = snapshotsStart < 0 ? lines.length : snapshotsStart
  const components = []

  for (let index = packagesStart + 1; index < end; index += 1) {
    const header = lines[index].match(/^ {2}(.+):$/)
    if (!header) continue
    const key = unquoteYamlKey(header[1])
    const identity = splitNpmLockKey(key)
    if (!identity) continue
    let integrity
    for (let cursor = index + 1; cursor < end && !/^ {2}.+:$/.test(lines[cursor]); cursor += 1) {
      integrity ??= lines[cursor].match(/integrity:\s*(sha512-[A-Za-z0-9+/=]+)/)?.[1]
    }
    const purl = npmPurl(identity.name, identity.version)
    components.push({
      type: 'library',
      name: identity.name,
      version: identity.version,
      'bom-ref': purl,
      purl,
      ...(integrityToHash(integrity) ? { hashes: integrityToHash(integrity) } : {}),
      properties: [{ name: 'scriptor:lockfile', value: 'pnpm-lock.yaml' }],
    })
  }

  const unique = new Map(components.map((component) => [component.purl, component]))
  return [...unique.values()].sort((a, b) => a.purl.localeCompare(b.purl))
}

export function parseCargoLockPackages(contents) {
  const components = []
  for (const block of contents.split('\n[[package]]\n').slice(1)) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1]
    const version = block.match(/^version = "([^"]+)"/m)?.[1]
    const checksum = block.match(/^checksum = "([a-f0-9]{64})"/m)?.[1]
    if (!name || !version) continue
    const purl = `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`
    components.push({
      type: 'library',
      name,
      version,
      'bom-ref': purl,
      purl,
      ...(checksum ? { hashes: [{ alg: 'SHA-256', content: checksum }] } : {}),
      properties: [{ name: 'scriptor:lockfile', value: 'Cargo.lock' }],
    })
  }
  const unique = new Map(components.map((component) => [component.purl, component]))
  return [...unique.values()].sort((a, b) => a.purl.localeCompare(b.purl))
}
