#!/usr/bin/env node
/**
 * generate-update-manifests.mjs
 *
 * Generates per-platform Tauri v2 update manifest JSON files from the
 * staged release assets.
 *
 * Tauri's updater plugin fetches:
 *   <endpoint>/update-manifest-<target>-<arch>.json
 *
 * where `target` is one of: linux, windows, darwin
 * and   `arch`   is one of: x86_64, aarch64
 *
 * Each manifest file follows the Tauri updater JSON contract:
 * {
 *   "version": "1.2.3",
 *   "notes": "...",
 *   "pub_date": "2026-08-09T00:00:00Z",
 *   "platforms": {
 *     "<target>-<arch>": {
 *       "url": "https://github.com/.../releases/download/v1.2.3/<installer>",
 *       "signature": "",      // filled if TAURI_PRIVATE_KEY is set
 *       "with_elevated_task": false
 *     }
 *   }
 * }
 *
 * We emit one file per (target, arch) pair so the endpoint URL template
 * in tauri.conf.json resolves to a single-platform document. That keeps
 * the manifest small and avoids cross-platform confusion.
 *
 * Usage:
 *   node generate-update-manifests.mjs \
 *     --version v1.2.3 \
 *     --assets-dir release-artifacts \
 *     --out-dir update-manifests
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// CLI argument parsing (no external deps)
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const rawVersion = flag('--version') ?? process.env.GITHUB_REF_NAME ?? '';
const assetsDir  = flag('--assets-dir') ?? 'release-artifacts';
const outDir     = flag('--out-dir') ?? 'update-manifests';

if (!rawVersion) {
  console.error('ERROR: --version is required (e.g. v1.2.3 or GITHUB_REF_NAME)');
  process.exit(1);
}

const version = rawVersion.replace(/^v/, '');
const repoSlug = 'AmirrezaFarnamTaheri/Scriptor';
const pubDate  = new Date().toISOString();

// ---------------------------------------------------------------------------
// Asset → (target, arch, installerType) mapping
// ---------------------------------------------------------------------------

/**
 * Maps an installer filename pattern to the Tauri platform identifier.
 * Tauri uses `<OS>-<arch>` strings matching the host triple short name.
 */
const PLATFORM_MAP = [
  // Windows x86_64 — prefer .msi for silent passive install
  { pattern: /windows.*x86_64.*\.msi$/i, target: 'windows',  arch: 'x86_64',  preferred: true  },
  { pattern: /windows.*x86_64.*\.exe$/i, target: 'windows',  arch: 'x86_64',  preferred: false },
  // macOS aarch64 (Apple Silicon) — the only macOS target in the CI matrix
  { pattern: /macos.*aarch64.*\.dmg$/i,  target: 'darwin',   arch: 'aarch64', preferred: true  },
  // Linux x86_64 — prefer .AppImage for universal install
  { pattern: /linux.*x86_64.*\.AppImage$/i, target: 'linux', arch: 'x86_64',  preferred: true  },
  { pattern: /linux.*x86_64.*\.deb$/i,      target: 'linux', arch: 'x86_64',  preferred: false },
  // Linux aarch64
  { pattern: /linux.*aarch64.*\.AppImage$/i, target: 'linux', arch: 'aarch64', preferred: true  },
  { pattern: /linux.*aarch64.*\.deb$/i,      target: 'linux', arch: 'aarch64', preferred: false },
];

// ---------------------------------------------------------------------------
// Collect assets
// ---------------------------------------------------------------------------

const assetFiles = fs.readdirSync(assetsDir)
  .filter(f => !f.endsWith('.json') && !f.endsWith('.txt') && !f.endsWith('.log'));

console.log(`Found ${assetFiles.length} asset(s) in ${assetsDir}:`);
for (const f of assetFiles) console.log(`  ${f}`);

/** @type {Map<string, { url: string, signature: string, withElevatedTask: boolean }>} */
const platforms = new Map(); // key = "<target>-<arch>"

for (const entry of PLATFORM_MAP) {
  const match = assetFiles.find(f => entry.pattern.test(f));
  if (!match) continue;

  const key = `${entry.target}-${entry.arch}`;
  // Only register a platform entry once; prefer the `preferred` installer type.
  if (platforms.has(key) && !entry.preferred) continue;

  const downloadUrl = `https://github.com/${repoSlug}/releases/download/v${version}/${match}`;

  // Read .sig file if present (produced by `tauri signer sign`).
  const sigPath = path.join(assetsDir, `${match}.sig`);
  const signature = fs.existsSync(sigPath)
    ? fs.readFileSync(sigPath, 'utf8').trim()
    : '';

  platforms.set(key, {
    url:                downloadUrl,
    signature,
    with_elevated_task: entry.target === 'windows', // NSIS/MSI may need elevation
  });
}

if (platforms.size === 0) {
  console.error('ERROR: No installer assets matched any known platform pattern.');
  process.exit(1);
}

console.log(`\nMatched ${platforms.size} platform(s):`);
for (const [k] of platforms) console.log(`  ${k}`);

// ---------------------------------------------------------------------------
// Emit one manifest file per platform
// ---------------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });

for (const [platformKey, platformData] of platforms) {
  const manifest = {
    version,
    notes: `Scriptor ${version} — see https://github.com/${repoSlug}/releases/tag/v${version} for full release notes.`,
    pub_date: pubDate,
    platforms: {
      [platformKey]: platformData,
    },
  };

  const filename = `update-manifest-${platformKey}.json`;
  const outPath  = path.join(outDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${outPath}`);
}

console.log(`\nGenerated ${platforms.size} update manifest(s) for v${version}.`);
