/**
 * 触覚フィードバック。
 *
 * 値が変わる操作（トグル、チップ、カウンターなど）のときだけ、
 * ごく短く振動させて「効いた」ことを手に返す。
 * 画面遷移や保存ボタンでは鳴らさない。連打すると煩わしくなるため。
 *
 * 対応状況に注意。
 *   Android Chrome  navigator.vibrate が使えるので鳴る
 *   iOS Safari      振動APIを実装していないため鳴らない（回避策も入れていない）
 *   デスクトップ     振動する機構が無いので何も起きない
 *
 * 鳴らない環境でも例外は投げず、画面の動作には一切影響しない。
 */

/** 値が変わったときの短い振動（ミリ秒） */
const TAP_MS = 10

function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'
  )
}

/**
 * 値が変わったことを手に返す。
 *
 * ユーザー操作から呼ぶこと。操作を伴わない呼び出しはブラウザに無視される。
 */
export function tapFeedback(): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(TAP_MS)
  } catch {
    // 端末やブラウザの設定で拒否されることがある。飾りなので黙って諦める
  }
}

/**
 * ハンドラを包んで、呼ばれる直前に振動させる。
 *
 * onChange={withTapFeedback(onChange)} のように使う。
 * 渡されたハンドラは必ず呼ぶ。振動できなくても操作は通す。
 */
export function withTapFeedback<A extends unknown[]>(
  handler: (...args: A) => void
): (...args: A) => void {
  return (...args: A) => {
    tapFeedback()
    handler(...args)
  }
}
