import { currentMonth, toMonth, today } from '@/lib/format'
import type { MonthlySaving, SavingEntryRow } from '@/types'

/** 'YYYY-MM' の N か月前を返す */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

export function sumByMonth(entries: SavingEntryRow[], month: string): number {
  return entries.filter((e) => e.month === month).reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 前月比（%）。前月の実績が0の場合は比較不能として null を返す。
 */
export function monthOverMonth(entries: SavingEntryRow[], month = currentMonth()): number | null {
  const prev = sumByMonth(entries, shiftMonth(month, -1))
  if (prev <= 0) return null
  const current = sumByMonth(entries, month)
  return Math.round(((current - prev) / prev) * 1000) / 10
}

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

export type GoalProgress = {
  goal: number
  current: number
  /** 0〜100 に丸めた進捗率。目標未設定なら null */
  percent: number | null
  remaining: number
}

export function goalProgress(current: number, goal: number): GoalProgress {
  if (goal <= 0) return { goal: 0, current, percent: null, remaining: 0 }
  return {
    goal,
    current,
    percent: Math.min(100, Math.round((current / goal) * 100)),
    remaining: Math.max(0, goal - current),
  }
}

/** 年ごとの積立額 */
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
 * 月末に「確定」した月だけを数える。今月のようにまだ確定していない月は含めない。
 * 画面ごとに entries を素朴に合計すると、確定前の今月分が混ざって数字がずれるため、
 * 累計を出すところは必ずこの関数を通す。
 */
export function confirmedMonthSet(monthlySavings: MonthlySaving[]): Set<string> {
  return new Set(
    monthlySavings
      .filter(
        (m) =>
          m.confirmed_amount !== null &&
          (m.status === 'ready' || m.status === 'deposited')
      )
      .map((m) => m.month)
  )
}

/** 確定した月だけの積立合計 */
export function confirmedTotal(monthlySavings: MonthlySaving[]): number {
  return monthlySavings
    .filter(
      (m) =>
        m.confirmed_amount !== null &&
        (m.status === 'ready' || m.status === 'deposited')
    )
    .reduce((sum, m) => sum + (m.confirmed_amount ?? 0), 0)
}

/** まだ確定していない月の積立合計（見込み。累計には足さない） */
export function pendingTotal(
  entries: { month: string; amount: number }[],
  monthlySavings: MonthlySaving[]
): number {
  const confirmed = confirmedMonthSet(monthlySavings)
  return entries
    .filter((e) => !confirmed.has(e.month))
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 今季の戦績。
 *
 * 貯金の記録（saving_entries）に紐づく試合から数える。
 * このアプリは全試合を貯金の対象にするため、記録＝その年の試合そのものになる
 * （本番DBで 2026年の試合116件と試合貯金116行が1対1であることを確認済み）。
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
