import webpush from 'web-push'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * サーバーからの通知送信。
 *
 * 購読先は端末ごとにあり、いつの間にか無効になる（アプリを消した、
 * ブラウザが購読を作り直した など）。送信のたびに 404 / 410 を見て
 * 消えた購読を掃除する。放っておくと毎回失敗し続けて無駄になる。
 */

/**
 * 通知の種類。notification_preferences の列名と揃える。
 *
 * 通知1つずつに設定を分けると多くなりすぎるので、利用者から見たまとまりで持つ。
 */
export const NOTIFY_CATEGORIES = ['games', 'savings', 'split', 'link'] as const

export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number]

export type PushMessage = {
  title: string
  body: string
  /**
   * どの設定で止まるか。'always' は設定に関わらず送る。
   *
   * 必須にしてあるのは、書き忘れた通知が素通りしないようにするため。
   * テスト送信のように本人が今まさに押したものだけ 'always' にする。
   */
  category: NotifyCategory | 'always'
  /** タップしたときに開くパス */
  url?: string
  /** 同じ種類の通知をまとめるための印 */
  tag?: string
}

export type PushResult = {
  /** 届いた購読の数 */
  sent: number
  /** 無効になっていて消した購読の数 */
  removed: number
  /** それ以外の理由で送れなかった数 */
  failed: number
}

type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

let configured = false

/** VAPID の設定。鍵が無ければ送らない */
function configure(): boolean {
  if (configured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  // 送信先に「誰が送っているか」を伝える連絡先。mailto: か URL である必要がある
  const subject = process.env.VAPID_SUBJECT || 'https://marine-wallet.vercel.app'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function pushConfigured(): boolean {
  return configure()
}

/**
 * 受け取る設定になっている人だけに絞る。
 *
 * 設定の行が無い人は「全部受け取る」とみなす。あとから設定を足したときに、
 * 既に使っている人の通知が黙って止まらないようにするため。
 */
async function allowedUsers(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  category: PushMessage['category']
): Promise<string[]> {
  if (category === 'always') return userIds

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, games, savings, split, link')
    .in('user_id', userIds)

  // 設定を引けなかったときは止めない。通知が来ないより、来る方がまだ分かる
  if (error || !data) return userIds

  const off = new Set(
    data.filter((row) => row[category] === false).map((row) => row.user_id as string)
  )
  return userIds.filter((id) => !off.has(id))
}

/**
 * 指定したユーザーたちへ送る。
 *
 * 1人が複数の端末を持つので、購読の数だけ送る。
 * 送れなかった購読があっても、他の購読への送信は止めない。
 */
export async function sendPushToUsers(
  userIds: string[],
  message: PushMessage
): Promise<PushResult> {
  const empty: PushResult = { sent: 0, removed: 0, failed: 0 }
  if (userIds.length === 0) return empty
  if (!configure()) return empty

  const supabase = createAdminClient()

  const targets = await allowedUsers(supabase, userIds, message.category)
  if (targets.length === 0) return empty

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', targets)

  if (error || !data || data.length === 0) return empty

  const payload = JSON.stringify(message)
  const deadIds: string[] = []
  let sent = 0
  let failed = 0

  await Promise.all(
    (data as SubscriptionRow[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          // 端末が圏外でも、しばらくは配送を試みてもらう
          { TTL: 60 * 60 * 12 }
        )
        sent += 1
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode
        // 404 と 410 は「その購読はもう無い」という意味。消してよい
        if (status === 404 || status === 410) deadIds.push(row.id)
        else failed += 1
      }
    })
  )

  if (deadIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', deadIds)
  }

  return { sent, removed: deadIds.length, failed }
}

/** 購読しているユーザー全員へ送る。試合の取得など、全員に関わる知らせ用 */
export async function sendPushToAll(message: PushMessage): Promise<PushResult> {
  if (!configure()) return { sent: 0, removed: 0, failed: 0 }

  const supabase = createAdminClient()
  const { data } = await supabase.from('push_subscriptions').select('user_id')
  const userIds = [...new Set((data ?? []).map((row) => row.user_id as string))]
  return sendPushToUsers(userIds, message)
}
