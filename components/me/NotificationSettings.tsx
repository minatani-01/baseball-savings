'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, SectionLabel } from '@/components/ui'
import { IconBell, IconCheck } from '@/components/icons'
import {
  PushError,
  isIos,
  pushStatus,
  subscribePush,
  unsubscribePush,
  type PushStatus,
} from '@/lib/push-client'

/**
 * 通知の設定。
 *
 * 通知は端末ごとの設定なので、他の設定と違ってサーバーの値を出すだけでは足りない。
 * 「この端末で許可されているか」をブラウザに聞いて、その結果で出し分ける。
 *
 * iOS は、ホーム画面に追加した PWA からでないと通知を扱えない
 * （iOS 16.4 以降）。Safari のタブで開いていると許可すら求められないので、
 * その場合は追加の手順を案内する。
 */

/** 状態ごとの見出しと説明 */
const COPY: Record<PushStatus, { label: string; hint: string }> = {
  subscribed: {
    label: 'この端末で受け取ります',
    hint: '試合の登録、月末の入金、割り勘、接続のリクエストをお知らせします。',
  },
  permitted: {
    label: 'この端末はまだ受け取りません',
    hint: '許可は済んでいます。「通知を受け取る」でこの端末を登録してください。',
  },
  default: {
    label: 'この端末では受け取りません',
    hint: '「通知を受け取る」を押すと、ブラウザが許可を尋ねます。',
  },
  denied: {
    label: 'ブラウザが通知を拒否しています',
    hint: '端末の設定で Marine Wallet の通知を許可すると、ここから登録できます。',
  },
  needs_install: {
    label: 'ホーム画面に追加すると使えます',
    hint: 'iPhone では、ホーム画面に追加したアイコンから開いたときだけ通知を使えます。',
  },
  unsupported: {
    label: 'この端末では使えません',
    hint: 'ブラウザが Web Push に対応していません。',
  },
}

export default function NotificationSettings({ userId }: { userId: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await pushStatus())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await subscribePush(userId)
      setMessage('この端末を登録しました。')
    } catch (cause) {
      setError(
        cause instanceof PushError ? cause.message : '通知を登録できませんでした。'
      )
    }
    await refresh()
    setBusy(false)
  }

  const unsubscribe = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await unsubscribePush()
      setMessage('この端末への通知を止めました。')
    } catch {
      setError('通知を止められませんでした。')
    }
    await refresh()
    setBusy(false)
  }

  const sendTest = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = (await res.json()) as { error?: string }
      if (res.ok) setMessage('テスト通知を送りました。')
      else setError(body.error ?? 'テスト通知を送れませんでした。')
    } catch {
      setError('テスト通知を送れませんでした。')
    }
    setBusy(false)
  }

  // 判定はブラウザに聞くので、描画が終わるまで決まらない
  const copy = status ? COPY[status] : null

  return (
    <div id="notifications" className="scroll-mt-20">
      <SectionLabel>お知らせ</SectionLabel>
      <Card>
        <div className="flex items-start gap-3">
          <IconBell size={18} className="mt-0.5 shrink-0 text-fg-mute" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">{copy ? copy.label : '確認しています'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
              {copy ? copy.hint : 'この端末で通知を使えるか調べています。'}
            </p>
          </div>
          {status === 'subscribed' ? (
            <IconCheck size={16} className="mt-0.5 shrink-0 text-teal" />
          ) : null}
        </div>

        {status === 'needs_install' ? (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[11px] leading-relaxed text-fg-mute">
              Safari で開いたまま、画面下の共有ボタンから
              <span className="text-fg-dim">「ホーム画面に追加」</span>
              を選んでください。追加されたアイコンから起動すると、ここで通知を登録できます。
            </p>
          </div>
        ) : null}

        {status === 'default' || status === 'permitted' ? (
          <Button variant="primary" full className="mt-3" onClick={subscribe} disabled={busy}>
            {busy ? '登録中' : '通知を受け取る'}
          </Button>
        ) : null}

        {status === 'subscribed' ? (
          <div className="mt-3 flex flex-col gap-2">
            <Button full onClick={sendTest} disabled={busy}>
              {busy ? '送信中' : 'テスト通知を送る'}
            </Button>
            <Button full onClick={unsubscribe} disabled={busy}>
              この端末への通知を止める
            </Button>
          </div>
        ) : null}

        {message ? <p className="mt-2 text-[12px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}

        {status && status !== 'unsupported' ? (
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-mute">
            通知は端末ごとの設定です。別の端末でも受け取るには、その端末でも登録してください。
            {isIos() ? 'iPhone では、ホーム画面のアイコンから開いたときだけ扱えます。' : null}
          </p>
        ) : null}
      </Card>
    </div>
  )
}
