/**
 * npb.jp の HTML を読むための小さな道具。
 *
 * DOM パーサーは使わない。対象のページは静的な HTML で構造も安定しており、
 * 必要なのは決まった位置のテキストだけなので、依存を増やす理由がない。
 */

/** HTML の実体参照を戻す。npb.jp で実際に出てくるものだけを扱う */
export function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

/** タグを落とし、実体参照を戻し、連続する空白を1つにまとめて前後を削る */
export function text(html: string | null | undefined): string {
  if (!html) return ''
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 属性値やタグを含まない素のテキストを取り出す。
 * 全角スペースは選手名の姓名区切りなので残す。
 */
export function nameText(html: string | null | undefined): string {
  if (!html) return ''
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/[ \t\r\n]+/g, '')
    .trim()
}

/** 最初に一致した捕捉グループを返す。無ければ null */
export function match1(source: string, re: RegExp): string | null {
  const m = source.match(re)
  return m ? m[1] : null
}

/** 全ての一致の1番目の捕捉グループを配列で返す */
export function matchAll1(source: string, re: RegExp): string[] {
  const out: string[] = []
  for (const m of source.matchAll(re)) out.push(m[1])
  return out
}

/**
 * `<div class="foo">中身</div>` の中身を取り出してテキスト化する。
 * npb.jp の該当箇所は入れ子を持たないので、貪欲でない一致で足りる。
 */
export function divText(source: string, className: string): string {
  return text(match1(source, new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`)))
}

/**
 * `<div class="foo">` の中身をテキスト化する。img の alt も拾う。
 *
 * npb.jp の天候欄は文字ではなく天気アイコンで、情報は alt 属性にだけ入る
 * （例: `<img src="/img/common/weather/17.gif" alt="雨時々止む">`）。
 * タグを落とすだけだと中止の告知を取りこぼすため、alt を本文として扱う。
 */
export function divTextWithAlt(source: string, className: string): string {
  const inner = match1(source, new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`))
  if (!inner) return ''
  const alts = matchAll1(inner, /<img[^>]*\salt="([^"]*)"[^>]*>/g).map((a) => decodeEntities(a))
  const body = text(inner)
  return [body, ...alts].map((s) => s.trim()).filter(Boolean).join(' ')
}

/** 数値に変換する。数字が無ければ null（未実施の試合のスコアなど） */
export function toInt(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const cleaned = raw.replace(/,/g, '').trim()
  if (!/^-?\d+$/.test(cleaned)) return null
  return Number.parseInt(cleaned, 10)
}

/**
 * 投球回をアウト数に直す。
 *
 * npb.jp は `<span class="integer">15</span><span class="decimal">.1</span>` の形で
 * 投球回を書く。小数部は三進法で、.1 が 1/3 回、.2 が 2/3 回を表す。
 * 小数として足すと 0.1 + 0.2 = 0.3 のようにずれるため、アウト数に直して扱う。
 *
 *   15回1/3 -> 15 * 3 + 1 = 46 アウト
 */
export function inningsToOuts(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '')
  const m = cleaned.match(/^(\d+)(?:\.(\d))?$/)
  if (!m) return null
  const whole = Number.parseInt(m[1], 10)
  const third = m[2] ? Number.parseInt(m[2], 10) : 0
  if (third > 2) return null
  return whole * 3 + third
}

/** アウト数を表示用の投球回に戻す（15回1/3 なら "15 1/3"） */
export function outsToInnings(outs: number): string {
  const whole = Math.floor(outs / 3)
  const third = outs % 3
  if (third === 0) return String(whole)
  return `${whole} ${third}/3`
}
