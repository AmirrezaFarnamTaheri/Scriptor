#!/usr/bin/env node
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const roots = [path.join(root, 'packages'), path.join(root, 'src')];
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', 'coverage', 'target', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (sourceExtensions.has(path.extname(entry.name))) sourceFiles.push(full);
  }
}
roots.forEach(walk);

const packages = new Map();
function collectPackages(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(dir, entry.name);
    const manifest = path.join(candidate, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      packages.set(pkg.name, { root: candidate, manifest: pkg });
    } else if (entry.name === 'plugins') collectPackages(candidate);
  }
}
collectPackages(path.join(root, 'packages'));

const failures = [];
const graph = new Map();
const staticImportPattern = /^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function dependencyName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function typesPackageName(packageName) {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.slice(1).split('/');
    return `@types/${scope}__${name}`;
  }
  return `@types/${packageName}`;
}

function isTestFile(file) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  return /(?:^|\/)tests?\//.test(relative) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relative);
}
function packageForFile(file) {
  for (const [name, info] of packages) {
    if (file === info.root || file.startsWith(`${info.root}${path.sep}`)) return name;
  }
  return null;
}
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const owner = packageForFile(file) ?? '<app>';
  if (!graph.has(owner)) graph.set(owner, new Set());
  const imports = [
    ...[...source.matchAll(staticImportPattern)].map((match) => ({ typeOnly: Boolean(match[1]), specifier: match[2] })),
    ...[...source.matchAll(dynamicImportPattern)].map((match) => ({ typeOnly: false, specifier: match[1] })),
  ];
  for (const { typeOnly, specifier } of imports) {
    if (!specifier) continue;
    if (specifier.startsWith('packages/') || specifier.includes('/packages/')) {
      failures.push(`${path.relative(root, file)}: direct filesystem import crosses package boundary (${specifier})`);
      continue;
    }
    const target = [...packages.keys()].find((name) => specifier === name || specifier.startsWith(`${name}/`));
    if (!target) {
      if (owner === '<app>' || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:') || builtins.has(specifier)) continue;
      const dependency = dependencyName(specifier);
      const info = packages.get(owner);
      if (!info || dependency === owner) continue;
      const runtimeDeps = {
        ...(info.manifest.dependencies ?? {}),
        ...(info.manifest.peerDependencies ?? {}),
        ...(info.manifest.optionalDependencies ?? {}),
      };
      const devDeps = info.manifest.devDependencies ?? {};
      const hasRuntimeDependency = Object.hasOwn(runtimeDeps, dependency);
      const hasDevDependency = Object.hasOwn(devDeps, dependency);
      const hasTypeDependency = typeOnly && Object.hasOwn(devDeps, typesPackageName(dependency));
      if (!hasRuntimeDependency && !(isTestFile(file) && hasDevDependency) && !hasTypeDependency) {
        failures.push(`${path.relative(root, file)}: ${owner} imports undeclared dependency ${dependency}`);
      }
      continue;
    }
    if (owner !== target) graph.get(owner).add(target);
    if (owner !== '<app>' && owner !== target) {
      const info = packages.get(owner);
      const declared = {
        ...(info.manifest.dependencies ?? {}),
        ...(info.manifest.peerDependencies ?? {}),
        ...(info.manifest.optionalDependencies ?? {}),
        ...(isTestFile(file) ? info.manifest.devDependencies ?? {} : {}),
      };
      if (!Object.hasOwn(declared, target)) {
        failures.push(`${path.relative(root, file)}: ${owner} imports undeclared workspace dependency ${target}`);
      }
    }
    const info = packages.get(target);
    if (specifier === target) continue;
    const subpath = `.${specifier.slice(target.length)}`;
    const exported = Object.keys(info.manifest.exports ?? {});
    const allowed = exported.some((key) => key === subpath || (key.endsWith('*') && subpath.startsWith(key.slice(0, -1))));
    if (!allowed) failures.push(`${path.relative(root, file)}: deep import bypasses ${target} exports (${specifier})`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(node, stack = []) {
  if (visiting.has(node)) {
    failures.push(`package dependency cycle: ${[...stack, node].join(' -> ')}`);
    return;
  }
  if (visited.has(node)) return;
  visiting.add(node);
  for (const next of graph.get(node) ?? []) visit(next, [...stack, node]);
  visiting.delete(node);
  visited.add(node);
}
for (const node of graph.keys()) visit(node);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Deep-module boundaries OK: ${packages.size} packages, ${sourceFiles.length} source files, no unexported cross-package imports or package cycles.`);
