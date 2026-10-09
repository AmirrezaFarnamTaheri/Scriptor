import { expect, test, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'
import { attachVisualState } from './visual-state-evidence'
import { VISUAL_RUNTIME_PLOT } from '../src/e2e/visualMediaFixtures'

async function openRuntime(page: Page, deferred = false) {
  await launchApp(page)
  await page.evaluate(plot => {
    const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!internals?.invoke) throw new Error('Native fixture unavailable')
    const original = internals.invoke.bind(internals)
    let session: { id: string; vault_id: unknown; language: string; python_version: string; executable: string; remaining_seconds: number } | null = null
    let value = 0, running = false, rejectRun: ((reason: Error) => void) | null = null
    internals.invoke = async (command, args = {}, options) => {
      if (command.startsWith('runtime_kernel_') || command === 'authorize_sensitive_operation') {
        const calls = JSON.parse(sessionStorage.getItem('e2e:runtime-calls') ?? '[]')
        calls.push({ command, args }); sessionStorage.setItem('e2e:runtime-calls', JSON.stringify(calls))
      }
      if (command === 'runtime_kernel_start') {
        value = 0; running = false
        session = { id: crypto.randomUUID(), vault_id: args.expectedVaultId, language: 'python', python_version: '3.13', executable: 'python', remaining_seconds: 900 }
        if (sessionStorage.getItem('e2e:runtime-defer') === '1') return new Promise(resolve => {
          (window as Window & { releaseRuntimeStart?: () => void }).releaseRuntimeStart = () => resolve(session)
        })
        return session
      }
      if (command === 'runtime_kernel_status') {
        if (!session) throw new Error('Session stopped')
        return { session, status: running ? 'running' : 'idle', stdout: running ? 'working...\n' : '', stderr: '' }
      }
      if (command === 'runtime_kernel_run') {
        if (!session) throw new Error('Session stopped')
        const code = String(args.code)
        if (code.includes('while True')) { running = true; return new Promise((_resolve, reject) => { rejectRun = reject }) }
        if (sessionStorage.getItem('e2e:runtime-fail') === '1') throw new Error('Cell exceeded 30 seconds; kernel shutdown is pending')
        if (code.includes('x = 40')) value = 40
        if (code.includes('x += 2')) value += 2
        return { session_id: session.id, language: 'python', exit_code: 0, stdout: String(value), stderr: '', duration_ms: 2, variables: [{ name: 'x', type: 'int', value: String(value) }], plots: code.includes('plot') ? [{ mime_type: plot.mimeType, data_base64: plot.base64, caption: 'Plot 1' }] : [] }
      }
      if (command === 'runtime_kernel_stop') {
        if (sessionStorage.getItem('e2e:runtime-stop-fail') === '1') throw new Error('Kernel shutdown is still pending')
        session = null; running = false; rejectRun?.(new Error('Kernel execution cancelled')); rejectRun = null; return null
      }
      return original(command, args, options)
    }
  }, VISUAL_RUNTIME_PLOT)
  await openCommandPalette(page); await runCommand(page, 'Runtime console')
  const panel = page.getByRole('region', { name: 'Runtime console', exact: true })
  await panel.getByRole('combobox', { name: 'Execution mode', exact: true }).selectOption('persistent')
  await panel.getByLabel('Session environment', { exact: true }).fill('PROJECT=research')
  const start = panel.getByRole('button', { name: 'Review permission and start kernel', exact: true })
  await expect(start).toBeDisabled()
  await panel.getByLabel('I reviewed the Python session and its environment.').check()
  if (deferred) await page.evaluate(() => sessionStorage.setItem('e2e:runtime-defer', '1'))
  await start.click()
  await expect(panel.getByText(deferred ? /Starting Python kernel/ : /Kernel ready\./)).toBeVisible()
  return panel
}
test('persistent Python retains variables, renders bounded PNGs and restarts with a clean namespace', async ({ page }, testInfo) => {
  const panel = await openRuntime(page)
  await panel.getByRole('textbox', { name: 'Code', exact: true }).fill('x = 40\nprint(x)')
  await panel.getByRole('button', { name: 'Review permission and run cell', exact: true }).click()
  await expect(panel.getByRole('cell', { name: '40', exact: true })).toBeVisible()
  await attachVisualState(page, testInfo, 'runtime-stdout-and-variables', panel)
  await panel.getByRole('textbox', { name: 'Code', exact: true }).fill('x += 2\nprint(x) # plot')
  await panel.getByRole('button', { name: 'Review permission and run cell', exact: true }).click()
  await expect(panel.getByRole('cell', { name: '42', exact: true })).toBeVisible()
  await expect(panel.getByRole('img', { name: 'Plot 1', exact: true })).toBeVisible()
  await expect.poll(() => panel.getByRole('img', { name: 'Plot 1', exact: true }).evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(VISUAL_RUNTIME_PLOT.width)
  await expect.poll(() => panel.getByRole('img', { name: 'Plot 1', exact: true }).evaluate(node => (node as HTMLImageElement).naturalHeight)).toBe(VISUAL_RUNTIME_PLOT.height)
  await attachVisualState(page, testInfo, 'runtime-persistent-variables-and-png', panel)
  await panel.getByRole('button', { name: 'Restart kernel', exact: true }).click()
  await expect(panel.getByText('Kernel ready.', { exact: false })).toBeVisible()
  await panel.getByRole('textbox', { name: 'Code', exact: true }).fill('x += 2\nprint(x)')
  await panel.getByRole('button', { name: 'Review permission and run cell', exact: true }).click()
  await expect(panel.getByRole('cell', { name: '2', exact: true })).toBeVisible()
  const scopes = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:runtime-calls') ?? '[]') as Array<{ command: string; args: { scope?: string } }>).filter(row => row.command === 'authorize_sensitive_operation' && row.args.scope?.startsWith('runtime:')).map(row => row.args.scope))
  expect(scopes.filter(scope => scope?.startsWith('runtime:start:'))).toHaveLength(2)
  expect(new Set(scopes.filter(scope => scope?.startsWith('runtime:run:'))).size).toBe(3)
})
test('failed cancellation during startup blocks switching and keeps ownership for a retry', async ({ page }, testInfo) => {
  const panel = await openRuntime(page, true)
  await attachVisualState(page, testInfo, 'runtime-startup-pending', panel)
  await page.evaluate(() => {
    sessionStorage.setItem('e2e:runtime-stop-fail', '1')
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (wait: Promise<unknown> | (() => Promise<unknown>)) => waits.push(typeof wait === 'function' ? wait() : wait) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:runtime-vault-result', JSON.stringify(result)))
    ;(window as Window & { releaseRuntimeStart?: () => void }).releaseRuntimeStart?.()
  })
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:runtime-vault-result'))).toBe('[false]')
  await expect(panel.getByRole('alert')).toContainText('shutdown is still pending')
  await expect(panel.getByRole('button', { name: 'Stop kernel', exact: true })).toBeEnabled()
  await attachVisualState(page, testInfo, 'runtime-startup-shutdown-failure', panel, panel.getByRole('alert'))
  await page.evaluate(() => sessionStorage.removeItem('e2e:runtime-stop-fail'))
  await panel.getByRole('button', { name: 'Stop kernel', exact: true }).click()
  await expect(panel.getByText('Kernel stopped.', { exact: false })).toBeVisible()
})
test('live output is visible and stopping a running kernel clears its session at mobile width', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const panel = await openRuntime(page)
  await panel.getByRole('textbox', { name: 'Code', exact: true }).fill('while True:\n print("working")')
  await panel.getByRole('button', { name: 'Review permission and run cell', exact: true }).click()
  await expect(panel.getByRole('region', { name: 'Live execution output', exact: true })).toContainText('working...')
  await attachVisualState(page, testInfo, 'runtime-mobile-live-output', panel)
  await panel.getByRole('button', { name: 'Stop kernel', exact: true }).click()
  await expect(panel.getByText('Kernel stopped.', { exact: false })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Review permission and run cell', exact: true })).toBeDisabled()
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await attachVisualState(page, testInfo, 'runtime-mobile-stopped', panel)
})
test('vault changes wait for kernel shutdown and pending shutdown errors remain honest', async ({ page }, testInfo) => {
  const panel = await openRuntime(page)
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (wait: Promise<unknown> | (() => Promise<unknown>)) => waits.push(typeof wait === 'function' ? wait() : wait) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:runtime-vault-result', JSON.stringify(result)))
  })
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:runtime-vault-result'))).toBe('[true]')
  await expect(panel.getByText('Kernel stopped.', { exact: false })).toBeVisible()
  await panel.getByRole('button', { name: 'Review permission and start kernel', exact: true }).click()
  await expect(panel.getByText('Kernel ready.', { exact: false })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('e2e:runtime-fail', '1'))
  await panel.getByRole('button', { name: 'Review permission and run cell', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('shutdown is pending')
  await attachVisualState(page, testInfo, 'runtime-cell-timeout-shutdown-pending', panel, panel.getByRole('alert'))
})
