'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Amount, Button, Chip, Field, Sheet, inputClass } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { today } from '@/lib/format'
import type { SavingEntryRow, SavingRules } from '@/types'

const QUICK_AMOUNTS = [300, 500, 1000, 3000]

/**
 * カスタム登録（試合結果から自動計算できない分を積み立てる）。
 * saving_entries に kind='custom' / game_id=null で保存する。
 *
 * NPB 公式から取得できない項目はここで登録する。
 * 定型をタップすると、貯金ルールの単価が内容と金額に入る。
 * 珍記録のように決まった単価が無いものは、そのまま手で入力する。
 */

/**
 * 自動登録では扱えない定型。
 *
 * サヨナラ勝利      イニングスコアから推定はできるが、公式に項目が無い
 * ノーヒットノーラン 個人投手成績に該当する列が無い
 * 完全試合          同上
 *
 * （docs/npb-data-sources.md 3章）
 */
const PRESETS: { key: string; label: string; ruleKey: keyof SavingRules }[] = [
  { key: 'sayonara', label: 'サヨナラ勝利', ruleKey: 'sayonara_bonus' },
  { key: 'no_hitter', label: 'ノーヒットノーラン', ruleKey: 'no_hitter_amount' },
  { key: 'perfect_game', label: '完全試合', ruleKey: 'perfect_game_amount' },
]

export default function CustomSavingSheet({
  entry,
  rules,
  userId,
  onClose,
}: {
  entry: SavingEntryRow | null
  rules: SavingRules
  userId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [date, setDate] = useState(entry?.entry_date ?? today())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [note, setNote] = useState(entry?.other_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = Math.max(0, Number.parseInt(amount || '0', 10) || 0)
  const canSubmit = title.trim().length > 0 && parsedAmount > 0 && Boolean(date)

  /** 定型をタップしたら、内容と金額をその場で埋める（どちらも後から直せる） */
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setTitle(preset.label)
    setAmount(String(Number(rules[preset.ruleKey])))
  }

  const save = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const payload = {
      user_id: userId,
      game_id: null,
      kind: 'custom' as const,
      title: title.trim(),
      entry_date: date,
      amount: parsedAmount,
      breakdown: [{ key: 'custom', label: title.trim(), amount: parsedAmount }],
      other_amount: 0,
      other_note: note.trim(),
    }

    const supabase = createClient()
    const { error } = entry
      ? await supabase.from('saving_entries').update(payload).eq('id', entry.id)
      : await supabase.from('saving_entries').insert(payload)

    setSaving(false)
    if (error) {
      setError('保存に失敗しました')
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <Sheet
      title={entry ? 'カスタム登録を編集' : 'カスタム登録'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button variant="primary" full onClick={save} disabled={saving || !canSubmit}>
            {saving ? '保存中' : entry ? '更新する' : 'この内容で貯金する'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="日付">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="定型" hint="NPBから取得できないため、ここで積み立てます">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((preset) => (
              <Chip
                key={preset.key}
                selected={title === preset.label}
                onClick={() => applyPreset(preset)}
                sub={`¥${Number(rules[preset.ruleKey]).toLocaleString()}`}
              >
                {preset.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="内容" hint="定型を選ぶと入ります。珍記録などは直接書いてください">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 代打逆転満塁ホームラン"
            className={inputClass}
          />
        </Field>

        <Field label="金額">
          <div className="flex flex-col gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass} tnum`}
            />
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <Chip key={v} selected={parsedAmount === v} onClick={() => setAmount(String(v))}>
                  ¥{v.toLocaleString()}
                </Chip>
              ))}
            </div>
          </div>
        </Field>

        <Field label="メモ" hint="任意">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="残しておきたいこと"
            className={inputClass}
          />
        </Field>

        <div className="glass rounded-2xl p-4 text-center">
          <div className="eyebrow">積立額</div>
          <div className="mt-2">
            <Amount value={parsedAmount} size="lg" tone="marine" />
          </div>
          <p className="mt-2 text-[11px] text-fg-mute">
            カスタム登録にフェーズ倍率は適用されません。
          </p>
        </div>
      </div>
    </Sheet>
  )
}
