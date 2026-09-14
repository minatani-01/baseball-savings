'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, SectionLabel, inputClassCompact } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { IconPlus, IconTrash } from '@/components/icons'
import { DEFAULT_SAVING_RULES } from '@/lib/savings'
import type { SavingCustomPreset, SavingRules } from '@/types'

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
    items: [
      { key: 'win_amount', label: '勝利' },
      { key: 'draw_amount', label: '引き分け' },
      { key: 'lose_amount', label: '敗北' },
    ],
  },
  {
    // マルチ安打と打点は NPB 公式が1試合ごとの個人成績を公開していないため、
    // 自動登録の対象から外した。定型にも入れていないので、
    // 積み立てるならカスタム登録で内容と金額を直接入力する。
    title: '打撃',
    note: '満塁ホームランはホームラン本数に含めず別に数えます',
    items: [
      { key: 'home_run_amount', label: 'ホームラン（1本あたり）' },
      { key: 'grand_slam_amount', label: '満塁ホームラン（1本あたり）' },
    ],
  },
  {
    title: '投手',
    note: '先発ハイライトは最上位のみ加算、セーブは独立して加算されます',
    items: [
      { key: 'shutout_amount', label: '完封' },
      { key: 'complete_game_amount', label: '完投' },
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
  initialPresets,
  canEdit,
}: {
  userId: string
  initialRules: SavingRules
  /** カスタム登録の定型 */
  initialPresets: SavingCustomPreset[]
  /** 共通ルールを変更できるか。できない人には読み取り専用で見せる */
  canEdit: boolean
}) {
  const router = useRouter()
  const [rules, setRules] = useState<SavingRules>(initialRules)
  const [presets, setPresets] = useState<SavingCustomPreset[]>(initialPresets)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [presetBusy, setPresetBusy] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 定型は行なので、ルールの「保存する」とは別にその場で反映する。
   * まとめて保存にすると、追加したのに保存を押し忘れる事故が起きる。
   */
  const addPreset = async () => {
    const label = newLabel.trim()
    const amount = Math.max(0, Number.parseInt(newAmount || '0', 10) || 0)
    if (!label || amount <= 0) return

    setPresetBusy(true)
    setPresetError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('saving_custom_presets')
      .insert({
        label,
        amount,
        // 末尾に足す
        sort_order: presets.reduce((max, p) => Math.max(max, p.sort_order), 0) + 10,
        updated_by: userId,
      })
      .select('id, label, amount, sort_order')
      .single()
    setPresetBusy(false)

    if (error || !data) {
      setPresetError(
        error?.code === '23505' ? '同じ名前の定型があります' : '定型を追加できませんでした'
      )
      return
    }
    setPresets((prev) => [...prev, data])
    setNewLabel('')
    setNewAmount('')
    router.refresh()
  }

  const updatePresetAmount = async (id: string, raw: string) => {
    const amount = Math.max(0, Number.parseInt(raw, 10) || 0)
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, amount } : p)))

    const supabase = createClient()
    const { error } = await supabase
      .from('saving_custom_presets')
      .update({ amount, updated_by: userId })
      .eq('id', id)
    if (error) setPresetError('定型の金額を保存できませんでした')
    else setPresetError(null)
  }

  const removePreset = async (id: string) => {
    const before = presets
    setPresets((prev) => prev.filter((p) => p.id !== id))

    const supabase = createClient()
    const { error } = await supabase.from('saving_custom_presets').delete().eq('id', id)
    if (error) {
      // 消えたように見せたまま残るのは分かりにくいので戻す
      setPresets(before)
      setPresetError('定型を削除できませんでした')
      return
    }
    setPresetError(null)
    router.refresh()
  }

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
        <SectionLabel>カスタム登録の定型</SectionLabel>
        <Card>
          <p className="mb-3 text-[11px] leading-relaxed text-fg-mute">
            NPBから取得できない記録を、カスタム登録のプルダウンに並べます。
            ここで追加したものがそのまま選べるようになります。
          </p>

          {presets.length === 0 ? (
            <p className="py-2 text-[13px] text-fg-mute">定型はまだありません。</p>
          ) : (
            <div className="divide-hairline">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg-dim">
                    {preset.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-fg-mute">¥</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      value={preset.amount}
                      onChange={(e) => updatePresetAmount(preset.id, e.target.value)}
                      disabled={!canEdit}
                      aria-label={`${preset.label}の金額`}
                      className={numberInput}
                    />
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={`${preset.label}を削除`}
                        onClick={() => removePreset(preset.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-mute transition-colors hover:border-danger/50 hover:text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="例: サイクルヒット"
                  aria-label="定型の名前"
                  className={inputClassCompact}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="金額"
                  aria-label="定型の金額"
                  className={`${numberInput} shrink-0`}
                />
                <button
                  type="button"
                  aria-label="定型を追加"
                  onClick={addPreset}
                  disabled={presetBusy || !newLabel.trim() || !newAmount}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-fg-dim transition-colors hover:border-marine/50 hover:text-marine disabled:opacity-40"
                >
                  <IconPlus size={16} />
                </button>
              </div>
              {presetError ? <p className="text-[13px] text-danger">{presetError}</p> : null}
              <p className="text-[11px] text-fg-mute">
                定型の追加・変更・削除は、この場ですぐ反映されます。
              </p>
            </div>
          ) : null}
        </Card>
      </div>

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
