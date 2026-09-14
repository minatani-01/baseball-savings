import { toMonth, today } from '@/lib/format'
import type { MonthlySaving, SavingEntryRow } from '@/types'

/**
 * 継続日数。
 * 「最初に貯金を記録した日から今日までの日数」と定義する（初日を1日目とする）。
 * 記録が1件もなければ0。
 */
export function streakDays(entries: SavingEntryRow[]): number {
  if (entries.length === 0) return 0
  const first = entries.reduce(
    (min, e) => (e.entry_date < min ? e.entry_date : min),
    entries[0].entry_date
  )
  const start = Date.parse(`${first}T00:00:00`)
  const now = Date.parse(`${today()}T00:00:00`)
  if (Number.isNaN(start) || Number.isNaN(now) || now < start) return 1
  return Math.floor((now - start) / 86_400_000) + 1
}

export function sumByYear(entries: SavingEntryRow[]): { year: string; amount: number; count: number }[] {
  const years = new Map<string, { amount: number; count: number }>()
  for (const entry of entries) {
    const year = entry.entry_date.slice(0, 4)
    const row = years.get(year) ?? { amount: 0, count: 0 }
    row.amount += entry.amount
    row.count += 1
    years.set(year, row)
  }
  return [...years.entries()]
    .map(([year, row]) => ({ year, ...row }))
    .sort((a, b) => b.year.localeCompare(a.year))
}

/** 支出日付から 'YYYY-MM' を得る（割り勘レコード用） */
export function recordMonth(date: string): string {
  return toMonth(date)
}

/**
 * 「累計貯金額」の定義（アプリ全体で唯一の定義）。
 *
 * ワンバンクへ入金した月だけを数える。月末に「確定」しただけの月は、
 * 金額が決まっただけで手元からはまだ動いていないので、累計には入れない。
 * 画面ごとに entries を素朴に合計すると確定前の月が混ざって数字がずれるため、
 * 累計を出すところは必ずこの関数を通す。
 */
export function depositedMonthSet(monthlySavings: MonthlySaving[]): Set<string> {
  return new Set(
    monthlySavings
      .filter((m) => m.status === 'deposited' && m.confirmed_amount !== null)
      .map((m) => m.month)
  )
}

/** 入金済みの月だけの積立合計 */
export function depositedTotal(monthlySavings: MonthlySaving[]): number {
  return monthlySavings
    .filter((m) => m.status === 'deposited' && m.confirmed_amount !== null)
    .reduce((sum, m) => sum + (m.confirmed_amount ?? 0), 0)
}

/**
 * まだ入金していない分。
 *
 * 確定済み（ready）の月は確定額で、確定前の月は積立予定額で数える。
 * 確定した月を積立予定額で数え直すと、月末に金額を締めた意味が無くなるため。
 */
export function notDepositedTotal(
  entries: { month: string; amount: number }[],
  monthlySavings: MonthlySaving[]
): number {
  const readyTotal = monthlySavings
    .filter((m) => m.status === 'ready' && m.confirmed_amount !== null)
    .reduce((sum, m) => sum + (m.confirmed_amount ?? 0), 0)

  const settled = new Set(
    monthlySavings
      .filter(
        (m) => m.confirmed_amount !== null && (m.status === 'ready' || m.status === 'deposited')
      )
      .map((m) => m.month)
  )
  const notSettled = entries
    .filter((e) => !settled.has(e.month))
    .reduce((sum, e) => sum + e.amount, 0)

  return readyTotal + notSettled
}

/**
 * 今季の戦績。
 *
 * 貯金の記録（saving_entries）に紐づく試合から数える。
 * このアプリは全試合を貯金の対象にするため、記録＝その年の試合そのものになる
 * （本番DBで 2026年の試合116件と自動登録116行が1対1であることを確認済み）。
 * games を別に引かずに済むぶん、ホームのクエリを増やさない。
 *
 * 勝率は引き分けを除いて 勝 ÷（勝＋負）。NPBの表記に合わせて小数第3位まで持つ。
 * 記録が最後に入った日も返す。登録は試合のあとなので、
 * 「いつ時点の成績か」を画面に出せるようにしておく。
 */
export type SeasonRecord = {
  win: number
  lose: number
  draw: number
  /** 勝率。勝敗が1つもない場合は null（0.000 と区別する） */
  rate: number | null
  /** 最後に記録した試合の日付（'YYYY-MM-DD'）。1件も無ければ null */
  lastGameDate: string | null
}

export function seasonRecord(entries: SavingEntryRow[], year: number): SeasonRecord {
  const games = entries
    .map((e) => e.game)
    .filter((g): g is NonNullable<typeof g> => Boolean(g) && g!.game_date.startsWith(`${year}-`))

  let win = 0
  let lose = 0
  let draw = 0
  let lastGameDate: string | null = null

  for (const game of games) {
    if (game.result === 'win') win += 1
    else if (game.result === 'lose') lose += 1
    else if (game.result === 'draw') draw += 1
    if (!lastGameDate || game.game_date > lastGameDate) lastGameDate = game.game_date
  }

  const decided = win + lose
  return {
    win,
    lose,
    draw,
    rate: decided === 0 ? null : Math.round((win / decided) * 1000) / 1000,
    lastGameDate,
  }
}

/** 勝率を .469 の形にする。比較できないときは '---' */
export function formatWinRate(rate: number | null): string {
  if (rate === null) return '---'
  return rate.toFixed(3).replace(/^0/, '')
}
