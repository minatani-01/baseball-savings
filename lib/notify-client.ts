'use client'

import type { NotifyKind } from '@/lib/notifications'

/**
 * 相手への通知を頼む。
 *
 * 通知は飾りなので、失敗しても呼び出し元の処理は止めない。
 * 割り勘を保存できたのに「通知に失敗しました」と出しても、
 * 何を直せばよいか分からないため、黙って諦める。
 *
 * 文面はサーバーで組み立てる。ここから渡すのは種類と相手だけ。
 */
export function notifyPartner(kind: NotifyKind, targetUserId: string | null | undefined): void {
  if (!targetUserId) return

  void fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, targetUserId }),
    // 画面を離れても送り切る
    keepalive: true,
  }).catch(() => {})
}

/**
 * 月の金額を確定したことを知らせる。
 *
 * 送り先はサーバーが決める。まとめて締められた相手にも入金が要るので、
 * 「いま確定された人」を DB から引いて送る。
 */
export function notifyMonthConfirmed(month: string): void {
  void fetch('/api/push/month-confirmed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ month }),
    keepalive: true,
  }).catch(() => {})
}
