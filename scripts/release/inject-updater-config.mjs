#!/usr/bin/env node
/**
 * Injects Tauri updater pubkey + endpoint from env before release builds.
 *
 * Usage:
 *   SCRIPTOR_UPDATER_PUBKEY="<base64>" SCRIPTOR_UPDATER_ENDPOINT="https://..." \
 *     node scripts/release/inject-updater-config.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.resolve(__dirname, '../../apps/desktop/src-tauri/tauri.conf.json')

const PLACEHOLDER = 'dW5kZWZpbmVk'
const pubkey = process.env.SCRIPTOR_UPDATER_PUBKEY?.trim()
const endpoint = process.env.SCRIPTOR_UPDATER_ENDPOINT?.trim()

if (!pubkey || pubkey === PLACEHOLDER) {
  console.warn('[inject-updater-config] SCRIPTOR_UPDATER_PUBKEY not set — keeping placeholder (updates disabled).')
  process.exit(0)
}

const raw = fs.readFileSync(configPath, 'utf8')
const config = JSON.parse(raw)
config.plugins ??= {}
config.plugins.updater ??= {}
config.plugins.updater.pubkey = pubkey
if (endpoint) {
  config.plugins.updater.endpoints = [endpoint]
}
config.plugins.updater.active = true

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log('[inject-updater-config] Updated tauri.conf.json updater pubkey and endpoint.')
