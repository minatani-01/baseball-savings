'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, SectionLabel } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SAVING_RULES } from '@/lib/savings'
import type { SavingRules } from '@/types'

type AmountKey = Exclude<
  keyof SavingRules,
  | 'user_id'
  | 'multiplier_regular'
  | 'multiplier_interleague'
  | 'multiplier_cs'
  | 'multiplier_nippon_series'
>

type MultiplierKey =
  | 'multiplier_regular'
  | 'multiplier_interleague'
  | 'multiplier_cs'
  | 'multiplier_nippon_series'

const AMOUNT_SECTIONS: { title: string; note?: string; items: { key: AmountKey; label: string }[] }[] = [
  {
    title: '試合結果',
    note: 'サヨナラ勝利は勝利に加算されます',
    items: [
      { key: 'win_amount', label: '勝利' },
      { key: 'sayonara_bonus', label: 'サヨナラ勝利（加算）' },
      { key: 'draw_amount', label: '引き分け' },
      { key: 'lose_amount', label: '敗北' },
    ],
  },
  {
    title: '打撃',
    note: '満塁ホームランはホームラン本数に含めず別に数えます',
    items: [
      { key: 'home_run_amount', label: 'ホームラン（1本あたり）' },
      { key: 'grand_slam_amount', label: '満塁ホームラン（1本あたり）' },
      { key: 'multi_hit_amount', label: 'マルチ安打（1人あたり）' },
      { key: 'rbi_amount', label: '打点（1点あたり）' },
    ],
  },
  {
    title: '投手',
    note: '先発ハイライトは最上位のみ加算、セーブは独立して加算されます',
    items: [
      { key: 'perfect_game_amount', label: '完全試合' },
      { key: 'no_hitter_amount', label: 'ノーヒットノーラン' },
      { key: 'shutout_amount', label: '完封' },
      { key: 'complete_game_amount', label: '完投' },
      { key: 'quality_start_amount', label: 'QS' },
      { key: 'winning_pitcher_amount', label: '勝利投手' },
      { key: 'save_amount', label: 'セーブ' },
    ],
  },
]

const MULTIPLIERS: { key: MultiplierKey; label: string }[] = [
  { key: 'multiplier_regular', label: 'レギュラー' },
  { key: 'multiplier_interleague', label: '交流戦' },
  { key: 'multiplier_cs', label: 'CS' },
  { key: 'multiplier_nippon_series', label: '日本シリーズ' },
]

export default function RulesClient({
  userId,
  initialRules,
  canEdit,
}: {
  userId: string
  initialRules: SavingRules
  /** 共通ルールを変更できるか。できない人には読み取り専用で見せる */
  canEdit: boolean
}) {
  const router = useRouter()
  const [rules, setRules] = useState<SavingRules>(initialRules)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setAmount = (key: AmountKey, raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    setRules((prev) => ({ ...prev, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }))
    setSaved(false)
  }

  const setMultiplier = (key: MultiplierKey, raw: string) => {
    const parsed = Number.parseFloat(raw)
    setRules((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 10) : 0,
    }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('saving_rule_settings')
      .update({ ...rules, updated_by: userId })
      .eq('id', true)
    setSaving(false)
    if (error) {
      setError('保存に失敗しました')
      return
    }
    setSaved(true)
    router.refresh()
  }

  const numberInput =
    'tnum w-28 rounded-lg border border-line bg-ink-2/80 px-3 py-2 text-right text-fg outline-none transition-colors focus:border-marine/70 disabled:opacity-60'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[13px] leading-relaxed text-fg-mute">
          試合ごとの入力を減らし、ここで決めたルールから積立予定額を自動計算します。
          ルールは全アカウント共通です。過去に記録済みの試合の金額は、
          ルールを変更しても書き換わりません。
        </p>
        {canEdit ? null : (
          <p className="mt-2 text-[13px] leading-relaxed text-warn">
            変更する権限がありません。表示のみです。
            変更できるようにするには、マスターのメンバー画面で、あなたとの接続の
            「共有設定」から「貯金ルール」をONにしてもらってください。
          </p>
        )}
      </div>

      {AMOUNT_SECTIONS.map((section) => (
        <div key={section.title}>
          <SectionLabel>{section.title}</SectionLabel>
          <Card>
            {section.note ? <p className="mb-3 text-[11px] text-fg-mute">{section.note}</p> : null}
            <div className="divide-hairline">
              {section.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-2.5">
                  <label htmlFor={item.key} className="text-[13px] text-fg-dim">
                    {item.label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-fg-mute">¥</span>
                    <input
                      id={item.key}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      value={rules[item.key]}
                      onChange={(e) => setAmount(item.key, e.target.value)}
                      disabled={!canEdit}
                className={numberInput}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}

      <div>
        <SectionLabel>フェーズ倍率</SectionLabel>
        <Card>
          <div className="divide-hairline">
            {MULTIPLIERS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 py-2.5">
                <label htmlFor={item.key} className="text-[13px] text-fg-dim">
                  {item.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-fg-mute">×</span>
                  <input
                    id={item.key}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.1}
                    value={rules[item.key]}
                    onChange={(e) => setMultiplier(item.key, e.target.value)}
                    disabled={!canEdit}
                className={numberInput}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {canEdit ? (
        <div className="flex flex-col gap-2">
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          {saved ? <p className="text-[13px] text-teal">保存しました</p> : null}
          <Button variant="primary" full onClick={save} disabled={saving}>
            {saving ? '保存中' : 'ルールを保存する'}
          </Button>
          <Button
            variant="ghost"
            full
            onClick={() => {
              setRules({ ...DEFAULT_SAVING_RULES })
              setSaved(false)
            }}
          >
            初期値に戻す
          </Button>
        </div>
      ) : null}
    </div>
  )
}
