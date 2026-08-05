#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const tauriRoot = path.join(root, 'apps/desktop/src-tauri')
const configPath = path.join(tauriRoot, 'tauri.conf.json')
const sourceIconPath = path.join(root, 'docs/brand/app-icon.svg')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const failures = []

function fail(message) {
  failures.push(message)
}

function inspectFile(relativePath) {
  const absolute = path.join(tauriRoot, relativePath)
  if (!fs.existsSync(absolute)) {
    fail(`missing bundled icon: ${relativePath}`)
    return
  }
  const stat = fs.statSync(absolute)
  if (!stat.isFile() || stat.size < 128) {
    fail(`bundled icon is empty or invalid: ${relativePath}`)
    return
  }
  const bytes = fs.readFileSync(absolute)
  const extension = path.extname(relativePath).toLowerCase()
  if (extension === '.png' && !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    fail(`PNG signature is invalid: ${relativePath}`)
  }
  if (extension === '.ico' && !bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) {
    fail(`ICO signature is invalid: ${relativePath}`)
  }
  if (extension === '.icns' && bytes.subarray(0, 4).toString('ascii') !== 'icns') {
    fail(`ICNS signature is invalid: ${relativePath}`)
  }
}

if (config.productName !== 'Scriptor') fail('Tauri productName must be Scriptor')
if (config.identifier !== 'com.scriptor.desktop') fail('unexpected desktop bundle identifier')
if (!config.bundle?.active) fail('Tauri bundling is disabled')

const declaredIcons = config.bundle?.icon
if (!Array.isArray(declaredIcons) || declaredIcons.length < 5) {
  fail('the desktop bundle must declare the complete platform icon set')
} else {
  for (const icon of declaredIcons) inspectFile(icon)
}

const installerIcon = config.bundle?.windows?.nsis?.installerIcon
const uninstallerIcon = config.bundle?.windows?.nsis?.uninstallerIcon
if (installerIcon !== 'icons/icon.ico') fail('the Windows installer must use icons/icon.ico')
if (uninstallerIcon !== 'icons/icon.ico') fail('the Windows uninstaller must use icons/icon.ico')
if (installerIcon) inspectFile(installerIcon)

if (!fs.existsSync(sourceIconPath)) {
  fail('missing canonical docs/brand/app-icon.svg')
} else {
  const source = fs.readFileSync(sourceIconPath, 'utf8')
  if (!/<svg\b/.test(source)) fail('canonical app icon is not SVG')
  if (!/scriptor|tile|keycap|#0f766e|#2dd4bf/i.test(source)) {
    fail('canonical app icon does not contain the Scriptor brand signature')
  }
  if (/tauri\.app|tauri-logo/i.test(source)) fail('canonical icon still references the Tauri default brand')
}

if (failures.length > 0) {
  console.error('Desktop branding validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Desktop branding OK: ${declaredIcons.length} bundled icons and Windows installer branding verified.`)
