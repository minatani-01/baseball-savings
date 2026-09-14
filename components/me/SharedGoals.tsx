'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  EmptyState,
  Field,
  ProgressBar,
  SectionLabel,
  Sheet,
  inputClass,
} from '@/components/ui'
import { IconPlus, IconTrash } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import { withTapFeedback } from '@/lib/haptics'
import { yen } from '@/lib/format'
import type { MarineLinkView, SharedGoalView } from '@/types'

/**
 * 共同貯金（仕様書17章）。独立サービスではなくロッテ貯金内の機能として扱う。
 *
 *   目標 ¥100,000
 *   Account A ¥28,500 / Account B ¥31,200
 *   TOTAL ¥59,700 (59.7%)
 *
 * 達成率は「ワンバンクへ入金した月次金額」の合計で見る。確定しただけの月は
 * 見込みとして別に出し、合計には足さない。資金は各自のワンバンクのままで、
 * ここで管理するのは記録上の共同目標だけ（仕様書16章・17章）。
 */
export default function SharedGoals({
  userId,
  goals,
  connected,
}: {
  userId: string
  goals: SharedGoalView[]
  /** 接続済みの相手。共同目標はこの接続に紐づけて作る */
  connected: MarineLinkView[]
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [linkId, setLinkId] = useState('')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openForm = () => {
    setLinkId(connected[0]?.id ?? '')
    setTitle('')
    setTarget('')
    setStartMonth('')
    setEndMonth('')
    setError(null)
    setFormOpen(true)
  }

  const create = async () => {
    const amount = Number(target.replace(/[^0-9]/g, ''))
    if (!linkId) {
      setError('接続済みの相手がいません')
      return
    }
    if (!title.trim()) {
      setError('目標の名前を入力してください')
      return
    }
    if (!amount || amount <= 0) {
      setError('目標金額は1円以上で入力してください')
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('create_shared_goal', {
      p_link_id: linkId,
      p_title: title.trim(),
      p_target_amount: amount,
      p_start_month: startMonth.trim() || null,
      p_end_month: endMonth.trim() || null,
    })
    setBusy(false)
    if (error) {
      // RPC 側で日本語のメッセージを投げているのでそのまま出す
      setError(error.message)
      return
    }
    setFormOpen(false)
    router.refresh()
  }

  const remove = async (goal: SharedGoalView) => {
    if (
      !window.confirm(
        `「${goal.title}」を削除しますか？\n\n貯金の記録そのものは消えません。共同目標の設定だけが削除されます。`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('shared_goals').delete().eq('id', goal.id)
    setBusy(false)
    if (error) {
      setError('削除に失敗しました。作成した本人だけが削除できます。')
      return
    }
    router.refresh()
  }

  const periodLabel = (goal: SharedGoalView) => {
    if (!goal.start_month && !goal.end_month) return '期間の指定なし'
    return `${goal.start_month ?? '開始不問'} 〜 ${goal.end_month ?? '終了不問'}`
  }

  return (
    <div>
      <SectionLabel
        action={
          connected.length > 0 ? (
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-1 text-[12px] text-marine transition-colors hover:text-teal"
            >
              <IconPlus size={14} />
              目標を作る
            </button>
          ) : null
        }
      >
        共同貯金
      </SectionLabel>

      {goals.length === 0 ? (
        <EmptyState
          title="共同目標はまだありません"
          description={
            connected.length > 0
              ? '接続済みの相手と目標額を決めて、達成率を一緒に追えます。'
              : '先に Marine Link で接続してください。'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{goal.title}</div>
                  <div className="mt-0.5 text-[11px] text-fg-mute">{periodLabel(goal)}</div>
                </div>
                {goal.created_by === userId ? (
                  <button
                    type="button"
                    onClick={() => remove(goal)}
                    disabled={busy}
                    aria-label="共同目標を削除"
                    className="shrink-0 text-fg-mute transition-colors hover:text-danger disabled:opacity-40"
                  >
                    <IconTrash size={16} />
                  </button>
                ) : null}
              </div>

              <div className="mt-3 divide-hairline">
                {goal.progress.map((row) => (
                  <div key={row.user_id} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="truncate text-[13px]">
                      {row.display_name || row.marine_id || 'メンバー'}
                      {row.user_id === userId ? (
                        <span className="ml-1.5 text-[11px] text-marine">あなた</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum text-sm font-semibold">{yen(row.confirmed)}</span>
                      {row.pending > 0 ? (
                        <span className="tnum ml-2 text-[11px] text-fg-mute">
                          +{yen(row.pending)} 見込み
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <ProgressBar
                  value={goal.confirmed_total}
                  max={goal.target_amount}
                  label="TOTAL"
                  caption={`${yen(goal.confirmed_total)} / ${yen(goal.target_amount)}`}
                />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-fg-mute">
                達成率はワンバンクへ入金した金額の合計です（確定しただけの月は含みません）。
                入金はそれぞれ自分のワンバンクへ行います。
              </p>
            </Card>
          ))}
        </div>
      )}

      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}

      {formOpen ? (
        <Sheet
          title="共同目標を作る"
          onClose={() => setFormOpen(false)}
          footer={
            <Button variant="primary" full onClick={create} disabled={busy}>
              {busy ? '作成中' : '作成する'}
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="一緒に貯める相手">
              <select
                value={linkId}
                onChange={withTapFeedback((e) => setLinkId(e.target.value))}
                className={inputClass}
              >
                {connected.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.partner_name.trim() || link.partner_marine_id}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="目標の名前" hint="例: 2027 OPENING GAME TRIP">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="目標の名前"
                className={inputClass}
              />
            </Field>

            <Field label="目標金額">
              <input
                type="text"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="100000"
                className={`${inputClass} tnum`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="開始月" hint="任意">
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className={`${inputClass} tnum`}
                />
              </Field>
              <Field label="終了月" hint="任意">
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className={`${inputClass} tnum`}
                />
              </Field>
            </div>

            <p className="text-[11px] leading-relaxed text-fg-mute">
              期間を指定すると、その範囲で確定した月次金額だけを合算します。
              指定しなければ全期間が対象です。
            </p>

            {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
