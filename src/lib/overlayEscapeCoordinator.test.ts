import assert from 'node:assert/strict'
import test from 'node:test'
import { OverlayEscapeCoordinator } from './overlayEscapeCoordinator.ts'

function escapeEvent() {
  const calls = { prevented: 0, stopped: 0, immediate: 0 }
  return {
    calls,
    event: {
      key: 'Escape',
      preventDefault: () => calls.prevented++,
      stopPropagation: () => calls.stopped++,
      stopImmediatePropagation: () => calls.immediate++,
    },
  }
}

test('only the topmost surface owns Escape and focus is restored after close', () => {
  const scheduled: Array<() => void> = []
  const coordinator = new OverlayEscapeCoordinator(null, (callback) => scheduled.push(callback))
  const closed: string[] = []
  let focusCount = 0
  const unregisterLower = coordinator.register(() => closed.push('lower'))
  const unregisterTop = coordinator.register(() => closed.push('top'), { focus: () => focusCount++ })

  const first = escapeEvent()
  assert.equal(coordinator.handleEscape(first.event), true)
  assert.deepEqual(closed, ['top'])
  assert.deepEqual(first.calls, { prevented: 1, stopped: 1, immediate: 1 })
  scheduled.shift()?.()
  assert.equal(focusCount, 1)

  unregisterTop()
  const second = escapeEvent()
  coordinator.handleEscape(second.event)
  assert.deepEqual(closed, ['top', 'lower'])
  unregisterLower()
})
