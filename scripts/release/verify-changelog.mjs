#!/usr/bin/env node
// Release gate: every released version must have a CHANGELOG.md section.
// Fails the release pipeline when VERSION has no matching `## <version>`
// heading, preventing releases from shipping undocumented.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

const heading = new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm');
if (!heading.test(changelog)) {
  console.error(
    `CHANGELOG.md is missing a "## ${version}" section. Every release must ship with a changelog entry describing what changed.`,
  );
  process.exit(1);
}

console.log(`CHANGELOG OK: ${version} section present.`);
