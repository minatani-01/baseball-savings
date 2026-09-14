'use client'

import { useEffect } from 'react'
import { Button, Card } from '@/components/ui'
import { IconAlert, IconRefresh } from '@/components/icons'

/**
 * アプリ内の読み取り失敗をここで受け止める。
 *
 * Supabase の Free プランはアイドル後の初回アクセスで 504 を返すことがあり、
 * かつては空配列にフォールバックして「未精算 0円」と表示してしまっていた。
 * 金額を扱う画面で誤った数字を見せるより、失敗を明示して再試行させる。
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="px-4 pt-6">
      <Card padded={false} className="p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-danger">
            <IconAlert size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold">データを読み込めませんでした</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
              通信が一時的に不安定な可能性があります。金額を誤って表示しないため、
              このページの表示を中断しました。少し待ってから再読み込みしてください。
            </p>
          </div>
        </div>

        <Button variant="primary" full className="mt-5" onClick={() => reset()}>
          <IconRefresh size={18} />
          再読み込み
        </Button>

        {/* 本番ビルドではサーバー側のエラー本文が伏せられるため、digest を出して照合できるようにする */}
        <p className="mt-4 break-words text-[11px] leading-relaxed text-fg-mute">
          {error.digest ? `エラーコード: ${error.digest}` : error.message}
        </p>
      </Card>
    </div>
  )
}
