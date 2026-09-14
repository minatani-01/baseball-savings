'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * ブラウザ側の通知まわり。
 *
 * iOS は、ホーム画面に追加した PWA からでないと通知を扱えない
 * （iOS 16.4 以降）。Safari のタブで開いていると、
 * Notification.requestPermission すら呼べないブラウザがある。
 * そのため「なぜ使えないか」を型で返し、画面で案内できるようにする。
 */

export type PushStatus =
  /** この端末では Web Push が使えない */
  | 'unsupported'
  /** iOS で、ホーム画面に追加していない */
  | 'needs_install'
  /** 使えるが、まだ許可していない */
  | 'default'
  /** 許可済みで購読している */
  | 'subscribed'
  /** 許可済みだが、この端末の購読が無い */
  | 'permitted'
  /** ブラウザの設定で拒否されている */
  | 'denied'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari だけ navigator.standalone を使う。他は表示モードで判定する
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return Boolean(iosStandalone) || window.matchMedia('(display-mode: standalone)').matches
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS は Mac を名乗るので、タッチの有無で見分ける
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function canPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Service Worker を用意する。購読にも通知の受信にも要る */
async function ready(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return navigator.serviceWorker.ready
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

export async function pushStatus(): Promise<PushStatus> {
  if (!canPush()) {
    // iOS でホーム画面に追加していないなら、その案内を優先する。
    // 「使えない端末」と言い切ると、追加すれば使えることが伝わらない
    return isIos() && !isStandalone() ? 'needs_install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'permitted'
}

/**
 * base64url の公開鍵を、PushManager が求める形に直す。
 *
 * ArrayBuffer を明示して確保する。Uint8Array の型は SharedArrayBuffer も
 * 取り得るため、そのままでは applicationServerKey に渡せない。
 */
function toApplicationServerKey(base64Url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i)
  return buffer
}

export class PushError extends Error {
  readonly status: PushStatus

  constructor(status: PushStatus, message: string) {
    super(message)
    this.name = 'PushError'
    this.status = status
  }
}

/**
 * 通知を許可してもらい、この端末の購読を保存する。
 *
 * 保存は購読した本人が行う。RLS で自分の行しか作れないので、
 * サーバーを経由せずにそのまま書ける。
 */
export async function subscribePush(userId: string): Promise<void> {
  const status = await pushStatus()
  if (status === 'needs_install') {
    throw new PushError(
      status,
      'iPhone では、ホーム画面に追加したアイコンから開いたときだけ通知を使えます。'
    )
  }
  if (status === 'unsupported') {
    throw new PushError(status, 'この端末のブラウザは通知に対応していません。')
  }
  if (status === 'denied') {
    throw new PushError(
      status,
      '通知がブラウザの設定で拒否されています。設定から許可してください。'
    )
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) throw new PushError('unsupported', '通知の鍵が設定されていません。')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushError('denied', '通知が許可されませんでした。')
  }

  const registration = await ready()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // 通知を出さずに使うことは認められていない
      userVisibleOnly: true,
      applicationServerKey: toApplicationServerKey(publicKey),
    }))

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new PushError('unsupported', '購読の情報を取得できませんでした。')
  }

  const supabase = createClient()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new PushError('permitted', '購読を保存できませんでした。')
}

/** この端末の購読をやめる。他の端末の購読は残す */
export async function unsubscribePush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  const supabase = createClient()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
