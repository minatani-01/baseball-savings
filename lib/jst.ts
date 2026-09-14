/**
 * 日本時間の日付を扱う小さな道具。
 *
 * Cron は UTC で動く（日本時間 05:00 は UTC 20:00 で、前日になる）。
 * 「今日が月末か」「昨日はいつか」を UTC のまま数えると1日ずれるので、
 * 日本時間に直してから判断する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** その瞬間の日本時間の日付を YYYY-MM-DD で返す */
export function jstDate(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** その瞬間の日本時間の月を YYYY-MM で返す */
export function jstMonth(at: Date): string {
  return jstDate(at).slice(0, 7)
}

/** 日本時間で1日前の日付 */
export function jstYesterday(at: Date): string {
  return jstDate(new Date(at.getTime() - 24 * 60 * 60 * 1000))
}

/**
 * 日本時間で、今日が月の最終日か。
 *
 * 翌日の月が変わっていれば最終日とみなす。
 * 月ごとの日数やうるう年を自分で数えずに済む。
 */
export function isJstMonthEnd(at: Date): boolean {
  const today = jstMonth(at)
  const tomorrow = jstMonth(new Date(at.getTime() + 24 * 60 * 60 * 1000))
  return today !== tomorrow
}
