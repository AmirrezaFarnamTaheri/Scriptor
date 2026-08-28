#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_IDENTITY_CLAIM } from './docs-contract-utils.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const docs = ['README.md','PRODUCT.md','DESIGN.md','SECURITY.md','CONTRIBUTING.md','MAINTAINERS.md','COMMERCIAL-LICENSING.md','docs/ARCHITECTURE.md','docs/CAPABILITY-MATURITY.md','docs/RELEASE-SECURITY.md','docs/ENCRYPTION-THREAT-MODEL.md','docs/FINAL-REMEDIATION-REPORT.md','docs/VERIFICATION.md','docs/RELEASE-CHECKLIST.md','docs/validation/FRONTEND_QUALITY.md'];
const failures = [];
for (const rel of docs) if (!fs.existsSync(path.join(root, rel))) failures.push(`missing ${rel}`);
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
for (const rel of docs.filter((rel) => fs.existsSync(path.join(root, rel)))) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const match of source.matchAll(/`([^`\n]+(?:\/|\\)[^`\n]+)`/g)) {
    const candidate = match[1];
    if (/^(?:https?:|pnpm |npm |cargo |git |gh |node |pwsh |bash |GET |POST )/.test(candidate)) continue;
    if (/[*{}<>|:$]/.test(candidate) || candidate.includes('..')) continue;
    const normalized = candidate.replace(/:\d+(?:-\d+)?$/, '').replace(/\\/g, '/');
    if ((normalized.startsWith('src/') || normalized.startsWith('crates/') || normalized.startsWith('apps/') || normalized.startsWith('packages/') || normalized.startsWith('scripts/') || normalized.startsWith('docs/')) && !fs.existsSync(path.join(root, normalized))) failures.push(`${rel}: references missing path ${normalized}`);
  }
}
if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'),'utf8')).version !== version) failures.push('README/doc contract: root package version differs from VERSION');
const licenseNotice = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').slice(0, 1200);
if (!licenseNotice.includes('SPDX-License-Identifier: AGPL-3.0-or-later')) failures.push('LICENSE: missing SPDX identifier');
if (/Non-commercial use|Commercial use requires/i.test(licenseNotice)) failures.push('LICENSE: contains a restriction incompatible with the AGPL grant');
if (!fs.existsSync(path.join(root, '.github/CODEOWNERS'))) failures.push('governance: missing .github/CODEOWNERS');

// Root product/security documents must match the implemented upstream release trust policy.
// Official GitHub Release installers are intentionally unsigned; integrity is established by
// exact target-status records, checksums, SBOM, receipt, source identity, and GitHub attestations.
const releaseTruthDocs = ['README.md', 'PRODUCT.md', 'SECURITY.md'];
const releaseTruth = Object.fromEntries(
  releaseTruthDocs.map((rel) => [rel, fs.readFileSync(path.join(root, rel), 'utf8')]),
);
const requiredReleaseClaims = [
  ['unsigned policy', /\bunsigned\b/i],
  ['checksums', /\bchecksums?\b/i],
  ['CycloneDX SBOM', /\bCycloneDX\b[\s\S]{0,80}\bSBOMs?\b|\bSBOMs?\b[\s\S]{0,80}\bCycloneDX\b/i],
  ['release receipt', /\brelease receipts?\b|\breceipts?\b/i],
  ['source identity', SOURCE_IDENTITY_CLAIM],
  ['provenance attestation', /\battest(?:ation|ations|ed)?\b/i],
];
for (const [rel, source] of Object.entries(releaseTruth)) {
  for (const [claim, pattern] of requiredReleaseClaims) {
    if (!pattern.test(source)) failures.push(`${rel}: missing required release-evidence claim (${claim})`);
  }
}
const contradictoryReleaseClaims = [
  /Windows installers are Authenticode-signed/i,
  /macOS bundles are Developer ID-signed and notarized/i,
  /Linux packages have detached OpenPGP signatures/i,
  /Production artifacts require platform signatures/i,
  /unsigned production release channels\./i,
  /reproducible, signed, attributable releases/i,
  /\b(?:installers?|artifacts?|packages?|bundles?)\s+(?:are|is|must be|required to be|require)\s+(?:platform-|code-)?signed\b/i,
  /\b(?:installers?|artifacts?|packages?|bundles?)\s+(?:are|is|must be|required to be|require)[^.\n]{0,80}\bnotarized\b/i,
  /\bAuthenticode-signed\b/i,
  /\bDeveloper ID-signed\b/i,
];
for (const [rel, source] of Object.entries(releaseTruth)) {
  for (const pattern of contradictoryReleaseClaims) {
    if (pattern.test(source)) failures.push(`${rel}: contradicts the upstream unsigned release policy (${pattern})`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Documentation contracts OK: ${docs.length} required documents and referenced repository paths.`);
