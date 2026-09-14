/**
 * ボックススコアのパーサー。
 *
 *   https://npb.jp/scores/2026/0910/m-e-20/
 *
 * 取れるのは責任投手・バッテリー・本塁打・イニングスコアまで。
 * 個人別の打撃成績（打数・安打・打点）は NPB 公式が公開していない
 * （docs/npb-data-sources.md 3章）。
 */

import { match1, nameText, text } from './html'
import type { Phase } from '@/types'

export type HomeRun = {
  /** 球団の略称（【ロッテ】の中身） */
  team: string
  batter: string
  /** 「17号（7回2ラン 岸）」のような原文 */
  detail: string
}

export type BoxScore = {
  /** YYYY-MM-DD。ページ本文の <time> から取る */
  gameDate: string | null
  place: string
  /** h3 の【...】部分。例: パーソル パ・リーグ公式戦 */
  seriesLabel: string
  phase: Phase
  /** 試合終了 / 8回表 など。速報中は途中経過が入る */
  state: string
  isFinished: boolean
  winPitcher: string
  losePitcher: string
  savePitcher: string
  homeRuns: HomeRun[]
}

/**
 * h3 の【...】から、貯金ルールのフェーズに落とす。
 *
 * 実際の表記例:
 *   【パーソル パ・リーグ公式戦】      -> regular
 *   【日本生命セ・パ交流戦】            -> interleague
 *   【クライマックスシリーズ】          -> cs
 *   【日本シリーズ】                    -> nippon_series
 */
export function phaseFromSeriesLabel(label: string): Phase {
  if (label.includes('日本シリーズ')) return 'nippon_series'
  if (label.includes('クライマックス')) return 'cs'
  if (label.includes('交流戦')) return 'interleague'
  return 'regular'
}

/** 【勝投手】のような見出しに続く <td> の中身を取る */
function resultInfoRow(html: string, heading: string): string {
  const re = new RegExp(`<th>【${heading}】</th>\\s*<td>([\\s\\S]*?)</td>`)
  return match1(html, re) ?? ''
}

/** 「高野脩（3勝3敗）」から名前だけを取る */
function pitcherName(cell: string): string {
  const withoutStats = cell.replace(/（[^）]*）/g, '')
  return nameText(withoutStats)
}

export function parseBoxScore(html: string): BoxScore {
  const timeText = text(match1(html, /<time>([\s\S]*?)<\/time>/))
  const ymd = timeText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  const gameDate = ymd
    ? `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
    : null

  const h3 = text(match1(html, /<h3>([\s\S]*?)<\/h3>/))
  const seriesLabel = match1(h3, /【([^】]*)】/) ?? ''

  const gameInfo = text(match1(html, /<p class="game_info">([\s\S]*?)<\/p>/))
  const state = match1(gameInfo, /【([^】]*)】/) ?? ''

  // 本塁打欄は「バッテリー」の次の見出しに続く table
  const homeRunTable =
    match1(html, /<h4>本塁打<\/h4>\s*<table>\s*<tbody>([\s\S]*?)<\/tbody>/) ?? ''
  const homeRuns: HomeRun[] = []
  for (const m of homeRunTable.matchAll(/<th>【([^】]*)】<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    const team = m[1]
    // 1チームで複数本出た場合は「、」で並ぶ
    for (const part of m[2].split('、')) {
      const cell = text(part)
      if (!cell) continue
      // 「佐藤 17号（7回2ラン 岸）」→ 打者名は 号 の手前まで
      const batter = nameText(part.split(/\d+号/)[0] ?? '')
      if (!batter) continue
      homeRuns.push({ team, batter, detail: cell })
    }
  }

  return {
    gameDate,
    place: text(match1(html, /<span class="place">([\s\S]*?)<\/span>/)),
    seriesLabel,
    phase: phaseFromSeriesLabel(seriesLabel),
    state,
    isFinished: state.includes('試合終了'),
    winPitcher: pitcherName(resultInfoRow(html, '勝投手')),
    losePitcher: pitcherName(resultInfoRow(html, '敗投手')),
    // セーブが付かない試合では行そのものが出ない
    savePitcher: pitcherName(resultInfoRow(html, 'セーブ')),
    homeRuns,
  }
}
