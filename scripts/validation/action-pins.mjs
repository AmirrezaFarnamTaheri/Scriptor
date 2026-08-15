#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const workflowDir = path.join(root, '.github/workflows');
const files = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));

// Verified immutable release identities. Updating an action requires changing both
// the workflow reference and this lock, which prevents valid-looking SHA/comment drift.
const approvedPins = new Map([
  ['actions/checkout@v7.0.1', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node@v7.0.0', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact@v7.0.1', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
  ['actions/download-artifact@v8.0.1', '3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c'],
  ['actions/attest@v4.2.1', '508db95dd578ae2727ebd6217d5ba78e4fbda05d'],
  ['actions/upload-pages-artifact@v5.0.0', 'fc324d3547104276b827a68afc52ff2a11cc49c9'],
  ['actions/deploy-pages@v5.0.0', 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128'],
  ['Swatinem/rust-cache@v2.9.2', '6323deb102c322ba6fcbdcafc7e3dddab59af2b6'],
]);

const failures = [];
let externalActionCount = 0;

for (const name of files) {
  const file = path.join(workflowDir, name);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(.+))?\s*$/);
    if (!match) return;

    const ref = match[1];
    if (ref.startsWith('./')) return;

    externalActionCount += 1;
    const at = ref.lastIndexOf('@');
    const action = at >= 0 ? ref.slice(0, at) : ref;
    const sha = at >= 0 ? ref.slice(at + 1) : '';
    const version = match[2]?.trim() ?? '';
    const location = `${name}:${index + 1}`;

    if (!/^[0-9a-f]{40}$/.test(sha)) {
      failures.push(`${location}: action is not pinned to a 40-character SHA (${ref})`);
      return;
    }

    if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      failures.push(`${location}: missing exact version comment`);
      return;
    }

    const lockKey = `${action}@${version}`;
    const approvedSha = approvedPins.get(lockKey);
    if (!approvedSha) {
      failures.push(`${location}: ${lockKey} is not present in the verified action-pin lock`);
      return;
    }

    if (sha !== approvedSha) {
      failures.push(`${location}: ${lockKey} must use ${approvedSha}, found ${sha}`);
    }
  });
}

const usedLocks = new Set();
for (const name of files) {
  const contents = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  for (const [lockKey, sha] of approvedPins) {
    if (contents.includes(`${lockKey.split('@v')[0]}@${sha}`)) usedLocks.add(lockKey);
  }
}
for (const lockKey of approvedPins.keys()) {
  if (!usedLocks.has(lockKey)) failures.push(`verified action-pin lock is unused: ${lockKey}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Action pin policy OK: ${files.length} workflow(s), ${externalActionCount} external action use(s), ${approvedPins.size} verified immutable release identities.`,
);
