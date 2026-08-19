import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const lockText = fs.readFileSync(path.join(root, 'Cargo.lock'), 'utf8')

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', 'dist', 'fuzz'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name === 'Cargo.toml') out.push(full)
  }
  return out
}

function parseManifest(file) {
  const text = fs.readFileSync(file, 'utf8')
  const packageMatch = text.match(/^name\s*=\s*"([^"]+)"/m)
  if (!packageMatch) return null
  const packageName = packageMatch[1]
  const localDeps = []
  let section = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim()
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      continue
    }
    if (!/(?:^|\.)((?:dev-|build-)?dependencies)$/.test(section)) continue
    const depMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*\{([^}]*)\}/)
    if (depMatch && /\bpath\s*=\s*"[^"]+"/.test(depMatch[2])) {
      const packageRename = depMatch[2].match(/\bpackage\s*=\s*"([^"]+)"/)
      localDeps.push(packageRename?.[1] ?? depMatch[1])
    }
  }
  return { packageName, localDeps: [...new Set(localDeps)].sort(), file }
}

function lockPackage(name) {
  const blocks = lockText.split(/(?=\[\[package\]\]\n)/g)
    .filter((block) => new RegExp(`^\\[\\[package\\]\\]\\nname = "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"$`, 'm').test(block))
  assert.equal(blocks.length, 1, `Cargo.lock must contain exactly one package block for ${name}`)
  const depsBlock = blocks[0].match(/dependencies = \[([\s\S]*?)\n\]/)?.[1] ?? ''
  return [...depsBlock.matchAll(/^\s*"([^"]+)"/gm)].map((match) => match[1])
}

const manifests = walk(root).map(parseManifest).filter(Boolean)
let checked = 0
for (const manifest of manifests) {
  const lockDeps = lockPackage(manifest.packageName)
  const duplicateDeps = lockDeps.filter((dep, index) => lockDeps.indexOf(dep) !== index)
  assert.deepEqual(duplicateDeps, [], `${manifest.packageName} has duplicate Cargo.lock dependencies: ${duplicateDeps.join(', ')}`)
  for (const dep of manifest.localDeps) {
    assert.ok(
      lockDeps.includes(dep),
      `${manifest.packageName} declares local dependency ${dep} in ${path.relative(root, manifest.file)} but Cargo.lock does not`,
    )
  }
  checked += 1
}

console.log(`Cargo manifest/lock workspace dependency check passed (${checked} packages).`)
