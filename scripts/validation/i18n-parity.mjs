#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const localeDir = path.join(root, 'src/lib/i18n');
const files = fs.readdirSync(localeDir).filter((name) => name.endsWith('.json')).sort();
const flatten = (value, prefix = '', out = new Map()) => {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, out);
    else out.set(next, child);
  }
  return out;
};
const parsed = new Map(files.map((name) => [name, flatten(JSON.parse(fs.readFileSync(path.join(localeDir, name), 'utf8')))]));
const failures = [];
const toolbarSource = fs.readFileSync(path.join(localeDir, 'editorToolbarStrings.ts'), 'utf8');
const toolbarKeysByLocale = new Map();
for (const match of toolbarSource.matchAll(/\b(en|de|fa):\s*\{([\s\S]*?)\n\s*\},/g)) {
  toolbarKeysByLocale.set(match[1], new Set(Array.from(match[2].matchAll(/'([^']+)'\s*:/g), (entry) => entry[1])));
}
const toolbarBaseline = toolbarKeysByLocale.get('en') ?? new Set();
for (const locale of ['en', 'de', 'fa']) {
  const keys = toolbarKeysByLocale.get(locale) ?? new Set();
  for (const key of toolbarBaseline) if (!keys.has(key)) failures.push(`editorToolbarStrings.ts: ${locale} missing ${key}`);
  for (const key of keys) if (!toolbarBaseline.has(key)) failures.push(`editorToolbarStrings.ts: ${locale} extra ${key}`);
}
const baseline = parsed.get('en.json') ?? parsed.values().next().value;
for (const [name, values] of parsed) {
  for (const key of baseline.keys()) if (!values.has(key)) failures.push(`${name}: missing ${key}`);
  for (const key of values.keys()) if (!baseline.has(key)) failures.push(`${name}: extra ${key}`);
  for (const [key, value] of values) if (typeof value !== 'string' || !value.trim()) failures.push(`${name}: invalid value at ${key}`);
}

const sourceRoot = path.join(root, 'src');
const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(absolute);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(absolute);
  }
};
collectSourceFiles(sourceRoot);
for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
    const key = match[1];
    if (!baseline.has(key) && !toolbarBaseline.has(key)) failures.push(`${path.relative(root, sourceFile)}: unknown translation key ${key}`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Locale parity OK: ${files.length} locale(s), ${baseline.size} keys each.`);
