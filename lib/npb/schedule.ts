/**
 * 月別の試合日程・結果ページのパーサー。
 *
 *   https://npb.jp/games/2026/schedule_09_detail.html
 *
 * 1試合が1つの <tr id="dateMMDD"> に対応する。日付セルは rowspan で
 * 同じ日の2試合目以降が省略されるが、id 属性には必ず日付が入るので
 * そこから取る（docs/npb-data-sources.md 2.1）。
 */

import { divText, divTextWithAlt, match1, matchAll1, text, toInt } from './html'

export type ScheduleGame = {
  /** YYYY-MM-DD */
  gameDate: string
  /** NPB の日程表では team1 がホーム */
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  place: string
  startTime: string
  /** 備考と天候をつないだもの。中止の理由などが入る */
  note: string
  /** 例: /scores/2026/0901/m-l-20/ 。未実施なら空 */
  boxScorePath: string
  /** 勝: / 敗: / 分: / 先発: をそのまま保持する */
  pitchers: string[]
  status: 'scheduled' | 'finished' | 'cancelled'
}

/** 中止を示す文言。備考・天候欄に入る */
const CANCELLED_MARKERS = ['中止', '雨天中止', 'ノーゲーム']

function pitcherOf(pitchers: string[], prefix: string): string {
  const hit = pitchers.find((p) => p.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() : ''
}

/** 「勝：高野脩」の勝利投手名を返す。責任投手が未確定なら空 */
export function winPitcherOf(game: ScheduleGame): string {
  return pitcherOf(game.pitchers, '勝：')
}

export function losePitcherOf(game: ScheduleGame): string {
  return pitcherOf(game.pitchers, '敗：')
}

/**
 * 日程・結果ページから、その月の全試合を取り出す。
 *
 * @param html ページの HTML
 * @param year URL に含まれる年（ページ本文には西暦が無いため外から渡す）
 */
export function parseSchedule(html: string, year: number): ScheduleGame[] {
  const games: ScheduleGame[] = []

  // <tr id="dateMMDD" で区切る。Postgres と違い JavaScript の正規表現は
  // 非貪欲一致が素直に効くが、ここでは分割の方が構造が読みやすい。
  const chunks = html.split('<tr id="date')
  for (const chunk of chunks) {
    const head = chunk.match(/^(\d{2})(\d{2})"/)
    if (!head) continue

    const month = head[1]
    const day = head[2]
    const gameDate = `${year}-${month}-${day}`

    // 1試合分だけを見る（次の行の内容を拾わないように </tr> で切る）
    const row = chunk.split('</tr>')[0]

    const homeTeam = divText(row, 'team1')
    const awayTeam = divText(row, 'team2')
    if (!homeTeam || !awayTeam) continue

    const homeScore = toInt(divText(row, 'score1'))
    const awayScore = toInt(divText(row, 'score2'))

    // 天候欄は天気アイコンで、中止の告知も img の alt に入ることがある
    const noteParts = [divText(row, 'comment'), divTextWithAlt(row, 'weather')]
      .map((s) => s.trim())
      .filter(Boolean)
    const note = noteParts.join(' ')

    const pitchers = matchAll1(row, /<div class="pit">([\s\S]*?)<\/div>/g)
      .map((p) => text(p))
      .filter(Boolean)

    const boxScorePath = match1(row, /href="(\/scores\/[^"]+)"/) ?? ''

    const cancelled = CANCELLED_MARKERS.some((m) => note.includes(m))
    const finished = homeScore !== null && awayScore !== null

    games.push({
      gameDate,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      place: divText(row, 'place'),
      startTime: divText(row, 'time'),
      note,
      boxScorePath,
      pitchers,
      status: cancelled ? 'cancelled' : finished ? 'finished' : 'scheduled',
    })
  }

  return games
}

/** 指定したチームが関わる試合だけに絞る */
export function gamesOf(games: ScheduleGame[], team: string): ScheduleGame[] {
  return games.filter((g) => g.homeTeam === team || g.awayTeam === team)
}
