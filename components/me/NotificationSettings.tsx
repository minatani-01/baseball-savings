'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, SectionLabel, Toggle } from '@/components/ui'
import { IconBell, IconCheck } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import {
  PushError,
  isIos,
  pushStatus,
  subscribePush,
  unsubscribePush,
  type PushStatus,
} from '@/lib/push-client'
import type { NotificationPreferences } from '@/types'

/**
 * 通知の設定。
 *
 * 2つの別々の設定が並ぶので、見出しで分けている。
 *   この端末   … どの端末に届けるか。端末ごとの設定で、ブラウザに聞かないと分からない
 *   受け取る通知 … 何を届けるか。人ごとの設定で、端末を増やしても引き継がれる
 *
 * iOS は、ホーム画面に追加した PWA からでないと通知を扱えない
 * （iOS 16.4 以降）。Safari のタブで開いていると許可すら求められないので、
 * その場合は追加の手順を案内する。
 */

/** 状態ごとの見出しと説明 */
const COPY: Record<PushStatus, { label: string; hint: string }> = {
  subscribed: {
    label: 'この端末で受け取ります',
    hint: '下で選んだ通知が、この端末に届きます。',
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

/** 受け取る通知の一覧。並びと文言はここだけで決める */
const CATEGORIES: {
  key: keyof NotificationPreferences
  label: string
  hint: string
}[] = [
  { key: 'games', label: '試合の取り込み', hint: '前日までの試合を毎朝取り込んだとき' },
  {
    key: 'savings',
    label: '貯金の確定と入金',
    hint: '月末のリマインドと、確定したあとの入金のお願い',
  },
  { key: 'split', label: '割り勘', hint: '接続している相手が割り勘を登録したとき' },
  { key: 'link', label: '接続（Marine Link）', hint: '接続のリクエストと、接続が成立したとき' },
]

export default function NotificationSettings({
  userId,
  initialPreferences,
}: {
  userId: string
  initialPreferences: NotificationPreferences
}) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState(initialPreferences)

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

  /**
   * 受け取る通知の切り替え。
   *
   * 押した瞬間に画面へ反映し、保存に失敗したら元に戻す。
   * 通信を待たせると、切り替えたのに動かないように見えるため。
   */
  const toggleCategory = async (key: keyof NotificationPreferences, next: boolean) => {
    const before = preferences
    setPreferences({ ...preferences, [key]: next })
    setError(null)

    const supabase = createClient()
    const { error: saveError } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...before, [key]: next }, { onConflict: 'user_id' })

    if (saveError) {
      setPreferences(before)
      setError('設定を保存できませんでした。')
    }
  }

  // 判定はブラウザに聞くので、描画が終わるまで決まらない
  const copy = status ? COPY[status] : null

  return (
    <div id="notifications" className="scroll-mt-20">
      <SectionLabel>通知設定</SectionLabel>

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
            届け先は端末ごとの設定です。別の端末でも受け取るには、その端末でも登録してください。
            {isIos() ? 'iPhone では、ホーム画面のアイコンから開いたときだけ扱えます。' : null}
          </p>
        ) : null}
      </Card>

      {/* 受け取る通知は人ごとの設定なので、端末を登録する前でも決めておける */}
      <div className="mt-3">
        <Card>
          <p className="text-[13px]">受け取る通知</p>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
            この設定はアカウントごとです。登録したすべての端末に効きます。
          </p>
          <div className="mt-2 divide-y divide-line">
            {CATEGORIES.map((category) => (
              <Toggle
                key={category.key}
                checked={preferences[category.key]}
                onChange={(next) => void toggleCategory(category.key, next)}
                label={category.label}
                hint={category.hint}
              />
            ))}
          </div>
          <p className="mt-2 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-mute">
            すべて切っても、テスト通知だけは届きます。
          </p>
        </Card>
      </div>
    </div>
  )
}
