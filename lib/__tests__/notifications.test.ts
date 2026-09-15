import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isNotifyKind, messageForMonthConfirmed, messageForMonthEnd } from '../notifications'

test('確定したときの文面には月が入り、金額は入らない', () => {
  const message = messageForMonthConfirmed('2026-09')
  assert.equal(message.title, '入金をお願いします')
  assert.match(message.body, /2026年9月/)
  // 額は人によって違ううえ、ロック画面に出るので入れない
  assert.doesNotMatch(message.body, /[¥\d]{1,3},\d{3}/)
  assert.equal(message.url, '/savings')
})

test('月は先頭の0を落として読む', () => {
  assert.match(messageForMonthConfirmed('2026-01').body, /2026年1月/)
  assert.match(messageForMonthConfirmed('2026-12').body, /2026年12月/)
})

test('確定のお願いと月末のリマインドは別の印にする', () => {
  // 印が同じだと、後から来た方が先の通知を置き換えてしまう
  assert.notEqual(messageForMonthConfirmed('2026-09').tag, messageForMonthEnd('2026-09').tag)
})

test('受け付ける通知の種類は決まったものだけ', () => {
  assert.equal(isNotifyKind('split_added'), true)
  assert.equal(isNotifyKind('month_confirmed'), false)
  assert.equal(isNotifyKind(''), false)
  assert.equal(isNotifyKind(null), false)
})
