#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { getSourceIdentity } from './source-identity.mjs'
import { RELEASE_QUALITY_CHECKS, runReleaseQualityChecks } from './release-quality.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const outputDir = path.join(root, 'artifacts/release-quality')
const outputPath = path.join(outputDir, 'release-quality-evidence.json')
fs.mkdirSync(outputDir, { recursive: true })

function execute(check) {
  return new Promise((resolve) => {
    const [file, ...args] = check.command
    const started = Date.now()
    const child = spawn(file, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    })
    child.once('error', (error) => resolve({ status: 'failed', durationMs: Date.now() - started, error: error.message }))
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ status: 'passed', durationMs: Date.now() - started })
      else resolve({
        status: 'failed',
        durationMs: Date.now() - started,
        error: signal ? `terminated by ${signal}` : `exit code ${code}`,
      })
    })
  })
}

const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: true,
  requireClean: true,
})
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
const evidence = await runReleaseQualityChecks({ source, version, execute })
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)

const performanceCheck = RELEASE_QUALITY_CHECKS.find((check) => check.id === 'performance')
const performancePath = path.join(outputDir, performanceCheck.output)
if (evidence.checks.find((check) => check.id === 'performance')?.status === 'passed') {
  if (!fs.existsSync(performancePath)) {
    throw new Error('performance check passed without writing performance evidence')
  }
  const performance = JSON.parse(fs.readFileSync(performancePath, 'utf8'))
  if (performance.pass !== true) throw new Error('performance evidence is not passing')
  if (performance.source?.sourceCommit !== source.sourceCommit || performance.source?.sourceTreeSha256 !== source.sourceTreeSha256) {
    throw new Error('performance evidence source identity does not match release quality source')
  }
}

console.log(outputPath)
if (!evidence.pass) {
  const failed = evidence.checks.filter((check) => check.status !== 'passed').map((check) => check.id)
  throw new Error(`release quality failed: ${failed.join(', ')}`)
}
