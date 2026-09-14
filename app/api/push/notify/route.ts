import { NextResponse } from 'next/server'

import { getProfile, getSessionUser } from '@/lib/queries'
import { isNotifyKind, messageForKind } from '@/lib/notifications'
import { pushConfigured, sendPushToUsers } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 相手の操作を知らせる通知。
 *
 * 割り勘の追加や接続のリクエストは、操作した人のブラウザから呼ぶ。
 * DB のトリガーから送る手もあるが、そのためだけに pg_net を入れて
 * 鍵を持たせるより、すでに認証のある経路に乗せる方が単純で追いやすい。
 *
 * 呼び出し側から受け取るのは「種類」と「誰に」だけ。
 * 本文はサーバーで組み立てる。相手の画面に出る文字列を、
 * 呼び出し側が自由に決められるようにはしない。
 *
 * 送り先は、自分と接続が成立している相手に限る。
 * 相手のIDさえ分かれば誰にでも送れる、という状態にしない。
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { kind?: unknown; targetUserId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const { kind, targetUserId } = body
  if (!isNotifyKind(kind) || typeof targetUserId !== 'string' || !targetUserId) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: '自分には送りません' }, { status: 400 })
  }

  // 接続の確認は service role で行う。
  // link_request は相手が承認する前なので、本人の権限では行が見えないことがある。
  // 設定漏れをここで拾う。try の外で例外にすると本文の無い 500 になる
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return NextResponse.json({ error: message }, { status: 503 })
  }
  const { data: links } = await admin
    .from('marine_links')
    .select('id, status, user_a, user_b')
    .or(
      `and(user_a.eq.${user.id},user_b.eq.${targetUserId}),` +
        `and(user_a.eq.${targetUserId},user_b.eq.${user.id})`
    )

  // 絞り込みを信用しきらず、取れた行が本当に両者のものか確かめる。
  // ここを通ると相手の端末に通知が出るので、条件は自分で見て確定させる
  const link = (links ?? []).find(
    (row) =>
      (row.user_a === user.id && row.user_b === targetUserId) ||
      (row.user_a === targetUserId && row.user_b === user.id)
  )
  if (!link) {
    return NextResponse.json({ error: '接続していない相手です' }, { status: 403 })
  }
  // リクエストの知らせだけは、まだ承認されていなくても送る。
  // それ以外は成立している接続に限る
  if (link.status !== 'accepted' && kind !== 'link_request') {
    return NextResponse.json({ error: '接続が成立していません' }, { status: 403 })
  }

  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: '通知の鍵が未設定' })
  }

  const profile = await getProfile(user.id)
  const result = await sendPushToUsers(
    [targetUserId],
    messageForKind(kind, profile?.display_name ?? '')
  )

  // 相手が通知を登録していないのは失敗ではない。呼び出し側の処理は止めない
  return NextResponse.json({ ok: true, ...result })
}
