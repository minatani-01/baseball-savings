/**
 * npb.jp からページを取る。
 *
 * npb.jp はボット系の User-Agent を接続レベルで遮断する。
 * 正直にボット名を名乗ると TLS 接続のあとで一方的に切られ、
 * HTTP ステータスすら返らない（docs/npb-data-sources.md 1.2）。
 * そのため通常のブラウザと同じヘッダーを送る。
 *
 * 相手に負担をかけないよう、1回の実行で取るページ数は最小限にし、
 * 連続した取得の間に必ず間隔を空ける。
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const BASE = 'https://npb.jp'

/** 連続取得の間隔（ミリ秒） */
export const FETCH_INTERVAL_MS = 1000

export const NPB_BASE_URL = BASE

/** マリーンズの球団コード（URL の idb1_m / idp1_m の m） */
export const MARINES_TEAM_CODE = 'm'

/** 日程・結果ページでのマリーンズの表記 */
export const MARINES_TEAM_LABEL = 'ロッテ'

export function scheduleUrl(year: number, month: number): string {
  return `${BASE}/games/${year}/schedule_${String(month).padStart(2, '0')}_detail.html`
}

export function battingStatsUrl(year: number, team = MARINES_TEAM_CODE): string {
  return `${BASE}/bis/${year}/stats/idb1_${team}.html`
}

export function pitchingStatsUrl(year: number, team = MARINES_TEAM_CODE): string {
  return `${BASE}/bis/${year}/stats/idp1_${team}.html`
}

/** 日程ページの href（/scores/...）を絶対 URL にする */
export function boxScoreUrl(path: string): string {
  return path.startsWith('http') ? path : `${BASE}${path}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class NpbFetchError extends Error {
  // パラメータプロパティは使わない。Node の型ストリップが対応しておらず、
  // node:test でそのまま実行できなくなるため
  readonly url: string
  readonly status: number | null

  constructor(url: string, status: number | null, message: string) {
    super(message)
    this.name = 'NpbFetchError'
    this.url = url
    this.status = status
  }
}

/**
 * 1ページ取得する。文字コードは UTF-8（npb.jp は <meta charset="utf-8">）。
 */
export async function fetchNpbPage(url: string, signal?: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      signal,
      redirect: 'follow',
      // 常に取り直す。取りこぼすと差分が壊れるため、古い応答を使わない
      cache: 'no-store',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Upgrade-Insecure-Requests': '1',
      },
    })
  } catch (cause) {
    throw new NpbFetchError(url, null, `接続できませんでした: ${String(cause)}`)
  }

  if (!res.ok) {
    throw new NpbFetchError(url, res.status, `HTTP ${res.status} が返りました`)
  }

  const html = await res.text()
  if (html.length < 1000) {
    throw new NpbFetchError(url, res.status, `応答が短すぎます（${html.length} バイト）`)
  }
  return html
}
