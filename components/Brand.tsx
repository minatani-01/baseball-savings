'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Marine Wallet のロゴロックアップ。
 *
 * 確定アイコンは白地に黒のマークなので、ダーク背景では白い角丸タイルに載せて表示する。
 * `public/brand/mark.png` が無い環境でも壊れ画像や空のタイルを出さないよう、
 * 読み込みが成功したときだけタイルを表示する。
 */
export default function Brand({
  size = 'sm',
  withTagline = false,
}: {
  size?: 'sm' | 'lg'
  withTagline?: boolean
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [markLoaded, setMarkLoaded] = useState(false)

  // SSR された img はハイドレーション前に読み込みが終わることがあり、
  // その場合 onLoad が発火しない。マウント時に完了済みかを確認する。
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setMarkLoaded(true)
  }, [])

  const tilePx = size === 'lg' ? 64 : 30
  const wordClass =
    size === 'lg'
      ? 'text-[30px] leading-none font-semibold tracking-[0.1em]'
      : 'text-[15px] leading-none font-semibold tracking-[0.08em]'

  const stacked = size === 'lg'

  return (
    <span
      className={
        stacked ? 'flex flex-col items-center gap-4' : 'flex items-center gap-2.5'
      }
    >
      <span
        className="shrink-0 overflow-hidden rounded-[22%] bg-white"
        style={{ width: tilePx, height: tilePx, display: markLoaded ? 'block' : 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src="/brand/mark.png"
          alt=""
          width={tilePx}
          height={tilePx}
          className="h-full w-full object-contain"
          onLoad={() => setMarkLoaded(true)}
        />
      </span>

      <span className={stacked ? 'flex flex-col items-center' : 'flex flex-col'}>
        <span className={`whitespace-nowrap ${wordClass}`}>
          Marine <span className="text-marine">Wallet</span>
        </span>
        {withTagline ? (
          <span className="mt-2.5 text-[10px] tracking-[0.24em] text-fg-mute uppercase">
            Fans save more than memories
          </span>
        ) : null}
      </span>
    </span>
  )
}
