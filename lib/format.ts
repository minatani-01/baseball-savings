/** 金額を「¥12,400」形式にする */
export function yen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`
}

/** 金額を符号付きにする（+¥500 / -¥500） */
export function signedYen(amount: number): string {
  const sign = amount < 0 ? '-' : '+'
  return `${sign}¥${Math.abs(Math.round(amount)).toLocaleString('ja-JP')}`
}

/** 'YYYY-MM-DD' → '9/13(土)' */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${weekday})`
}

/** 'YYYY-MM' → '2026年9月' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  if (!y || !m) return month
  return `${y}年${Number(m)}月`
}

/** 'YYYY-MM' → 'SEPTEMBER 2026' */
export function monthLabelEn(month: string): string {
  const names = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  ]
  const [y, m] = month.split('-')
  const index = Number(m) - 1
  if (!y || index < 0 || index > 11) return month
  return `${names[index]} ${y}`
}

/** ローカルタイムの今日を 'YYYY-MM-DD' で返す（UTC変換でずらさない） */
export function today(): string {
  const now = new Date()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function toMonth(date: string): string {
  return date.slice(0, 7)
}

/** 当月を 'YYYY-MM' で返す */
export function currentMonth(): string {
  return toMonth(today())
}

/** その月が終わっているか（月末確定を促すかの判定に使う） */
export function isMonthClosed(month: string): boolean {
  return month < currentMonth()
}
