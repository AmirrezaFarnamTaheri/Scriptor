#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..');
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const outDir = path.resolve(process.argv[3] ?? path.join(root, 'dist/release-evidence'));
fs.mkdirSync(outDir,{recursive:true});
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=[];
function walk(dir){ if(!fs.existsSync(dir)) return; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else if(!f.startsWith(outDir)) files.push({path:path.relative(root,f).replaceAll('\\','/'),bytes:fs.statSync(f).size,sha256:sha256(f)}); }}
walk(subjectDir); files.sort((a,b)=>a.path.localeCompare(b.path));
const command=(cmd,args=[])=>{try{return execFileSync(cmd,args,{encoding:'utf8'}).trim()}catch{return null}};
const receipt={schemaVersion:1,createdAt:new Date().toISOString(),version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),sourceCommit:command('git',['rev-parse','HEAD']),sourceDirty:Boolean(command('git',['status','--porcelain'])),platform:{os:os.platform(),arch:os.arch()},tools:{node:process.version,npm:command('npm',['--version']),pnpm:command('pnpm',['--version']),cargo:command('cargo',['--version']),rustc:command('rustc',['--version'])},subjects:files};
const receiptPath=path.join(outDir,'release-receipt.json');
fs.writeFileSync(receiptPath,`${JSON.stringify(receipt,null,2)}\n`);
fs.writeFileSync(path.join(outDir,'SHA256SUMS'),files.map(f=>`${f.sha256}  ${f.path}`).join('\n')+'\n');
console.log(receiptPath);
