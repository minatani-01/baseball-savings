import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isJstMonthEnd, jstDate, jstMonth, jstYesterday } from '../jst'

// Cron は日本時間 05:00 に動く。UTC では前日の 20:00 になる
const at = (iso: string) => new Date(iso)

test('日本時間の日付に直す', () => {
  // UTC 20:00 は日本時間で翌日の 05:00
  assert.equal(jstDate(at('2026-09-14T20:00:00Z')), '2026-09-15')
  assert.equal(jstDate(at('2026-09-14T14:59:00Z')), '2026-09-14')
  assert.equal(jstDate(at('2026-09-14T15:00:00Z')), '2026-09-15')
})

test('日本時間の月に直す', () => {
  assert.equal(jstMonth(at('2026-09-30T20:00:00Z')), '2026-10')
  assert.equal(jstMonth(at('2026-09-30T14:00:00Z')), '2026-09')
})

test('日本時間の前日', () => {
  assert.equal(jstYesterday(at('2026-09-14T20:00:00Z')), '2026-09-14')
  assert.equal(jstYesterday(at('2026-09-01T20:00:00Z')), '2026-09-01')
})

test('月末の判定は日本時間で行う', () => {
  // 日本時間 2026-09-30 05:00（UTC では 09-29 20:00）は月末
  assert.equal(isJstMonthEnd(at('2026-09-29T20:00:00Z')), true)
  // 日本時間 2026-09-29 05:00 は月末ではない
  assert.equal(isJstMonthEnd(at('2026-09-28T20:00:00Z')), false)
  // 日本時間 2026-10-01 05:00 は月初なので月末ではない
  assert.equal(isJstMonthEnd(at('2026-09-30T20:00:00Z')), false)
})

test('うるう年の2月末も数えなくて済む', () => {
  // 2028 はうるう年。日本時間 2028-02-29 が月末
  assert.equal(isJstMonthEnd(at('2028-02-28T20:00:00Z')), true)
  assert.equal(isJstMonthEnd(at('2028-02-27T20:00:00Z')), false)
  // 2026 はうるう年ではない。日本時間 2026-02-28 が月末
  assert.equal(isJstMonthEnd(at('2026-02-27T20:00:00Z')), true)
})

test('UTC のまま数えると月末を取り違える組み合わせ', () => {
  // UTC では 09-30 だが、日本時間では 10-01。月末として送ってはいけない
  const at1 = at('2026-09-30T20:00:00Z')
  assert.equal(at1.toISOString().slice(0, 10), '2026-09-30')
  assert.equal(jstDate(at1), '2026-10-01')
  assert.equal(isJstMonthEnd(at1), false)
})
