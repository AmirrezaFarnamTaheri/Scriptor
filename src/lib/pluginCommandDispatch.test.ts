import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dispatchPluginCommandId,
  dispatchPluginCommandIdAsMcpResult,
  type PluginCommandRuntime,
} from './pluginCommandDispatch.ts'

function runtime(overrides: Partial<PluginCommandRuntime> = {}): PluginCommandRuntime {
  return {
    refreshHealth: async () => {},
    fixVaultLint: async () => undefined,
    setStatusDockTab: () => {},
    setHealthDashboardOpen: () => {},
    ...overrides,
  }
}

describe('pluginCommandDispatch Gmail commands', () => {
  it('passes structured input to every advertised Gmail capability', async () => {
    const seen: Array<[string, unknown]> = []
    const testRuntime = runtime({
      gmailConnect: async (input) => { seen.push(['connect', input]); return { status: 'connected' } },
      gmailImport: async (input) => { seen.push(['import', input]); return { status: 'imported' } },
      gmailModify: async (input) => { seen.push(['modify', input]); return { status: 'modified' } },
      gmailSend: async (input) => { seen.push(['send', input]); return { status: 'sent' } },
    })

    const commands = [
      ['gmail.connect', { clientId: 'client' }],
      ['gmail.import', { messageId: 'm1' }],
      ['gmail.modify', { messageId: 'm1', action: 'archive' }],
      ['gmail.send', { to: 'a@example.com', subject: 'Hi', body: 'Body' }],
    ] as const

    for (const [commandId, input] of commands) {
      const result = await dispatchPluginCommandId(commandId, testRuntime, { input })
      assert.equal(result.handled, true)
    }

    assert.deepEqual(seen, [
      ['connect', { clientId: 'client' }],
      ['import', { messageId: 'm1' }],
      ['modify', { messageId: 'm1', action: 'archive' }],
      ['send', { to: 'a@example.com', subject: 'Hi', body: 'Body' }],
    ])
  })

  it('reports missing Gmail runtime capabilities as unhandled', async () => {
    const result = await dispatchPluginCommandId('gmail.send', runtime(), {
      input: { to: 'a@example.com', subject: 'Hi', body: 'Body' },
    })
    assert.equal(result.handled, false)
  })

  it('maps Gmail execution failures to an MCP failure result', async () => {
    const result = await dispatchPluginCommandIdAsMcpResult(
      'gmail.modify',
      runtime({
        gmailModify: async () => {
          throw new Error('native authorization denied')
        },
      }),
      { input: { messageId: 'm1', action: 'archive' } },
    )

    assert.equal(result.ok, false)
    if (result.ok) assert.fail('expected command failure')
    assert.equal(result.error.code, 'mcp.plugin_command_failed')
    assert.match(result.error.message, /authorization denied/)
  })

  it('does not report input-required Gmail commands as successful MCP mutations', async () => {
    const result = await dispatchPluginCommandIdAsMcpResult(
      'gmail.send',
      runtime({
        gmailSend: async () => ({ status: 'input-required', required: ['to', 'subject', 'body'] }),
      }),
    )

    assert.equal(result.ok, false)
    if (result.ok) assert.fail('expected input-required failure')
    assert.equal(result.error.code, 'mcp.plugin_command_input_required')
    assert.match(result.error.message, /to, subject, body/)
  })

  it('opens Gmail Manager only for the explicit open command at dispatch level', async () => {
    let opens = 0
    const testRuntime = runtime({ openGmailManager: () => { opens += 1 } })
    const open = await dispatchPluginCommandId('gmail.open', testRuntime)
    const unknown = await dispatchPluginCommandId('gmail.unknown', testRuntime)
    assert.equal(open.handled, true)
    assert.equal(unknown.handled, false)
    assert.equal(opens, 1)
  })
})
