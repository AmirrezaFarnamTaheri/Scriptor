#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { gitWorkspaceFiles, hasDotSegment } from '../lib/workspace-files.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const canonicalPath = path.join(root, 'VERSION');
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const versionTag = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const mode = process.argv[2] ?? 'check';
const canonical = fs.readFileSync(canonicalPath, 'utf8').trim();
if (!semver.test(canonical)) throw new Error(`VERSION is not valid SemVer: ${canonical}`);

const ignoredDirectories = new Set([
  'node_modules',
  'target',
  'dist',
  'dist-e2e',
  'dist-ssr',
  'dist-visual-e2e',
  'coverage',
  'release-output',
  'release-artifacts',
  'release-artifacts-test',
  'release-evidence',
  'release-manifests-test',
  'test-results',
  'playwright-report',
  'update-manifests',
]);

// Legacy filesystem walk for checkouts without git (packaged source drops).
// The git listing is preferred: it honors .gitignore and cannot wander into
// foreign checkouts, while untracked-but-not-ignored manifests still count.
function walk(dir, name, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Dot-directories hold tool state, caches, and linked git worktrees
    // (e.g. .release-1.0.2) whose manifests belong to *another* checkout;
    // scanning them fails the check against foreign versions and, in sync
    // mode, would rewrite files inside the other worktree.
    if (entry.isDirectory() && (entry.name.startsWith('.') || ignoredDirectories.has(entry.name))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, name, out);
    else if (entry.name === name) out.push(full);
  }
  return out;
}

function collectLegacyManifests() {
  return [...walk(root, 'package.json'), ...walk(root, 'Cargo.toml')];
}

const gitFiles = gitWorkspaceFiles(root);
if (!gitFiles) console.warn('version: git unavailable, walking the filesystem');
const manifestCandidates = (gitFiles ?? collectLegacyManifests())
  .filter((file) => !hasDotSegment(file, root))
  .filter((file) => !path.relative(root, file).split(path.sep).some((segment) => ignoredDirectories.has(segment)))
  .filter((file) => {
    const name = path.basename(file);
    return name === 'package.json' || name === 'Cargo.toml';
  });
const jsonFiles = manifestCandidates.filter((file) => path.basename(file) === 'package.json');
const cargoFiles = manifestCandidates.filter(
  (file) =>
    path.basename(file) === 'Cargo.toml' &&
    // The ipc fuzz crate is excluded from the workspace; its manifest pins
    // no release version.
    !file.replaceAll('\\', '/').endsWith('/crates/ipc/fuzz/Cargo.toml'),
);
const tauriFile = path.join(root, 'apps/desktop/src-tauri/tauri.conf.json');
const sourceVersionFiles = [{
  file: path.join(root, 'packages/mcp/src/server.ts'),
  pattern: /export const MCP_SERVER_VERSION = '([^']+)'/,
  replacement: (version) => `export const MCP_SERVER_VERSION = '${version}'`,
}];
const failures = [];
const changed = [];

for (const file of jsonFiles) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value.version) continue;
  if (mode === 'sync') {
    if (value.version !== canonical) {
      value.version = canonical;
      fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      changed.push(path.relative(root, file));
    }
  } else if (value.version !== canonical) {
    failures.push(`${path.relative(root, file)}: ${value.version}`);
  }
}

for (const file of cargoFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (!/^\[package\]/m.test(source)) continue;
  const match = source.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) continue;
  if (mode === 'sync') {
    if (match[1] !== canonical) {
      fs.writeFileSync(file, source.replace(/^version\s*=\s*"[^"]+"/m, `version = "${canonical}"`));
      changed.push(path.relative(root, file));
    }
  } else if (match[1] !== canonical) {
    failures.push(`${path.relative(root, file)}: ${match[1]}`);
  }
}

const tauri = JSON.parse(fs.readFileSync(tauriFile, 'utf8'));
if (mode === 'sync') {
  if (tauri.version !== canonical) {
    tauri.version = canonical;
    fs.writeFileSync(tauriFile, `${JSON.stringify(tauri, null, 2)}\n`);
    changed.push(path.relative(root, tauriFile));
  }
} else if (tauri.version !== canonical) {
  failures.push(`${path.relative(root, tauriFile)}: ${tauri.version}`);
}

for (const { file, pattern, replacement } of sourceVersionFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(pattern);
  if (!match) throw new Error(`Version surface missing from ${path.relative(root, file)}`);
  if (mode === 'sync') {
    if (match[1] !== canonical) {
      fs.writeFileSync(file, source.replace(pattern, replacement(canonical)));
      changed.push(path.relative(root, file));
    }
  } else if (match[1] !== canonical) {
    failures.push(`${path.relative(root, file)}: ${match[1]}`);
  }
}

const explicitExpected = String(process.env.SCRIPTOR_RELEASE_VERSION ?? '').trim();
const refName = String(process.env.GITHUB_REF_NAME ?? '').trim();
const expectedSource = explicitExpected || (versionTag.test(refName) ? refName : '');
const expected = expectedSource.replace(/^v/, '') || undefined;
if (mode !== 'sync' && expected && expected !== canonical) {
  failures.push(`release input/tag: ${expected}`);
}

if (failures.length) {
  console.error(`Version drift. Canonical VERSION=${canonical}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(mode === 'sync'
  ? `Synchronized ${changed.length} manifest(s) to ${canonical}${changed.length ? `:\n- ${changed.join('\n- ')}` : ''}`
  : `Version contract OK: ${canonical} across ${jsonFiles.length} package manifests, ${cargoFiles.length} Cargo manifests, Tauri config, and ${sourceVersionFiles.length} source version surface(s).`);
