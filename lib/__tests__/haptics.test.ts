import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { tapFeedback, withTapFeedback } from '../haptics'

type FakeNavigator = { vibrate?: unknown }

const g = globalThis as { navigator?: FakeNavigator }
const original = Object.prototype.hasOwnProperty.call(g, 'navigator') ? g.navigator : undefined

function setNavigator(value: FakeNavigator | undefined) {
  if (value === undefined) delete g.navigator
  else Object.defineProperty(g, 'navigator', { value, configurable: true, writable: true })
}

afterEach(() => setNavigator(original))

test('振動APIがある環境では短く鳴らす', () => {
  const calls: unknown[] = []
  setNavigator({ vibrate: (ms: number) => calls.push(ms) })
  tapFeedback()
  assert.deepEqual(calls, [10])
})

test('navigator が無くても落ちない', () => {
  setNavigator(undefined)
  assert.doesNotThrow(() => tapFeedback())
})

test('vibrate を持たない環境でも落ちない（iOS Safari を想定）', () => {
  setNavigator({})
  assert.doesNotThrow(() => tapFeedback())
})

test('vibrate が例外を投げても飲み込む', () => {
  setNavigator({
    vibrate: () => {
      throw new Error('端末の設定で拒否された')
    },
  })
  assert.doesNotThrow(() => tapFeedback())
})

test('withTapFeedback は元のハンドラを必ず呼ぶ', () => {
  setNavigator({ vibrate: () => true })
  const received: string[] = []
  const handler = withTapFeedback((value: string) => received.push(value))
  handler('a')
  assert.deepEqual(received, ['a'])
})

test('withTapFeedback は振動できなくてもハンドラを呼ぶ', () => {
  setNavigator({})
  let called = false
  withTapFeedback(() => {
    called = true
  })()
  assert.equal(called, true)
})

test('withTapFeedback はハンドラより先に振動させる', () => {
  const order: string[] = []
  setNavigator({ vibrate: () => order.push('vibrate') })
  withTapFeedback(() => order.push('handler'))()
  assert.deepEqual(order, ['vibrate', 'handler'])
})
