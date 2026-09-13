'use client'

import { useEffect, useState } from 'react'
import { IconCheck, IconCopy, IconExternal } from '@/components/icons'
import { APP_LINK_STORAGE_KEY, EXTERNAL_APPS, type ExternalAppKey } from '@/lib/constants'

export type AppLinks = Partial<Record<ExternalAppKey, string>>

export function loadAppLinks(): AppLinks {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(APP_LINK_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppLinks) : {}
  } catch {
    return {}
  }
}

export function saveAppLinks(links: AppLinks) {
  try {
    window.localStorage.setItem(APP_LINK_STORAGE_KEY, JSON.stringify(links))
  } catch {
    /* localStorage が使えない環境では設定を保持しないだけで動作は継続する */
  }
}

/** 金額をクリップボードへコピーする。Marine Wallet 自身は送金しない（仕様書 11.2） */
export function CopyAmountButton({ amount, label }: { amount: number; label?: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const text = String(Math.round(amount))
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // クリップボードAPIが使えない場合は選択用のプロンプトで代替する
      window.prompt('金額をコピーしてください', text)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.02] px-4 text-sm text-fg transition-colors hover:border-marine/60 hover:text-marine"
    >
      {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
      {copied ? 'コピーしました' : (label ?? '金額をコピー')}
    </button>
  )
}

/** 外部アプリの起動。URL未設定ならマイページでの設定を促す。 */
export function OpenAppButton({ app }: { app: ExternalAppKey }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(loadAppLinks()[app]?.trim() || null)
  }, [app])

  const meta = EXTERNAL_APPS[app]

  if (!url) {
    return (
      <p className="text-xs text-fg-mute">
        {meta.label}の起動URLはマイページから設定できます。
      </p>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-marine px-4 text-sm font-semibold text-ink transition-colors hover:bg-teal"
    >
      <IconExternal size={17} />
      {meta.label}を開く
    </a>
  )
}
