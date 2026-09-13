'use client'

import { useState } from 'react'

/**
 * Marine Wallet のロゴロックアップ。
 *
 * 確定アイコン（M + ボール + 波のマーク）は `public/brand/mark.png` に置く。
 * ファイルが無い環境では読み込みエラーを検知してワードマークだけを表示する。
 */
export default function Brand({
  size = 'sm',
  withTagline = false,
}: {
  size?: 'sm' | 'lg'
  withTagline?: boolean
}) {
  // 画像が存在しない環境で壊れ画像アイコンを出さないよう、読み込み成功後に表示する
  const [markLoaded, setMarkLoaded] = useState(false)

  const markPx = size === 'lg' ? 56 : 26
  const wordClass =
    size === 'lg'
      ? 'text-[30px] leading-none font-semibold tracking-[0.1em]'
      : 'text-[15px] leading-none font-semibold tracking-[0.08em]'

  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark.png"
        alt=""
        width={markPx}
        height={markPx}
        className="shrink-0 object-contain"
        style={{ width: markPx, height: markPx, display: markLoaded ? 'block' : 'none' }}
        onLoad={() => setMarkLoaded(true)}
      />
      <span className="flex flex-col">
        <span className={wordClass}>
          Marine <span className="text-marine">Wallet</span>
        </span>
        {withTagline ? (
          <span className="mt-2 text-[10px] tracking-[0.28em] text-fg-mute uppercase">
            Fans save more than memories
          </span>
        ) : null}
      </span>
    </span>
  )
}
