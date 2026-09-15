import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/queries'
import { messageForMonthConfirmed } from '@/lib/notifications'
import { pushConfigured, sendPushToUsers } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 月の金額を確定したときの、入金のお願い。
 *
 * 確定は confirm_month_for_circle（SECURITY DEFINER）が、貯金に参加している
 * 接続済みメンバーの分もまとめて締める。締められた側は自分で操作していないので、
 * 入金が要ることを知らせる必要がある。
 *
 * 送り先は、呼び出し側から受け取らない。
 * 「その月に、いま確定されたばかりの行」を DB から引いて、それを送り先にする。
 * こうすると接続や参加の条件を二重に持たずに済み、実際に締められた人とも必ず一致する。
 *
 * 呼び出した本人の行が含まれていなければ、確定は起きていないとみなして何も送らない。
 * 月を指定しただけで他人へ通知を飛ばせる、という状態にしない。
 */
export const dynamic = 'force-dynamic'

/** 「いま確定した」とみなす幅。確定から通知までの往復を吸収できればよい */
const JUST_NOW_MS = 2 * 60 * 1000

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { month?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const { month } = body
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  // 設定漏れをここで拾う。try の外で例外にすると本文の無い 500 になる
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return NextResponse.json({ error: message }, { status: 503 })
  }

  const since = new Date(Date.now() - JUST_NOW_MS).toISOString()
  const { data, error } = await admin
    .from('monthly_savings')
    .select('user_id')
    .eq('month', month)
    .eq('status', 'ready')
    .gte('confirmed_at', since)

  if (error) {
    return NextResponse.json({ error: '確定した相手を取得できませんでした' }, { status: 500 })
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id as string))]
  if (!userIds.includes(user.id)) {
    return NextResponse.json({ ok: true, skipped: '確定の記録が見つかりません' })
  }

  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: '通知の鍵が未設定' })
  }

  const result = await sendPushToUsers(userIds, messageForMonthConfirmed(month))

  // 誰も通知を登録していないのは失敗ではない。呼び出し側の処理は止めない
  return NextResponse.json({ ok: true, confirmed: userIds.length, ...result })
}
