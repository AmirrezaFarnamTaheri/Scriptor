#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'dist/release-evidence'));
fs.mkdirSync(outDir, { recursive: true });
const version = fs.readFileSync(path.join(root, 'VERSION'),'utf8').trim();
const rootPackage = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const components = [];
for (const [name, range] of Object.entries({...(rootPackage.dependencies ?? {}), ...(rootPackage.devDependencies ?? {})})) {
  components.push({ type: 'library', name, version: String(range), purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(String(range))}`, properties: [{name:'scriptor:declared-range',value:String(range)}] });
}
const cargoLock = fs.readFileSync(path.join(root,'Cargo.lock'),'utf8');
for (const block of cargoLock.split('\n[[package]]\n').slice(1)) {
  const name = block.match(/^name = "([^"]+)"/m)?.[1];
  const depVersion = block.match(/^version = "([^"]+)"/m)?.[1];
  if (name && depVersion) components.push({type:'library',name,version:depVersion,purl:`pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(depVersion)}`});
}
components.sort((a,b)=>`${a.purl}`.localeCompare(`${b.purl}`));
const serial = `urn:uuid:${crypto.randomUUID()}`;
const sbom = {bomFormat:'CycloneDX',specVersion:'1.6',serialNumber:serial,version:1,metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:'Scriptor',version}},components};
const sbomPath = path.join(outDir,'scriptor.cyclonedx.json');
fs.writeFileSync(sbomPath, `${JSON.stringify(sbom,null,2)}\n`);
console.log(sbomPath);
