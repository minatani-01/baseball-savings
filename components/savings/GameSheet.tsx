'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Amount,
  Button,
  Chip,
  Field,
  Row,
  Segmented,
  Sheet,
  inputClass,
} from '@/components/ui'
import { IconMinus, IconPlus } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import { calcSaving } from '@/lib/savings'
import { today } from '@/lib/format'
import {
  HOME_AWAY,
  OPPONENTS,
  PHASES,
  PITCHING_HIGHLIGHTS,
  RESULTS,
} from '@/lib/constants'
import type {
  GameResult,
  HomeAway,
  Phase,
  PitchingHighlight,
  SavingEntryRow,
  SavingRules,
} from '@/types'

type FormState = {
  game_date: string
  opponent: string
  phase: Phase
  home_away: HomeAway
  stadium: string
  result: GameResult
  is_sayonara: boolean
  marines_score: string
  opponent_score: string
  home_runs: number
  grand_slams: number
  multi_hits: number
  rbi: number
  pitching_highlight: PitchingHighlight
  is_winning_pitcher: boolean
  has_save: boolean
  other_amount: string
  other_note: string
}

function toForm(entry: SavingEntryRow | null): FormState {
  // カスタム貯金（game が null）は GameSheet では編集しないため、新規と同じ初期値にする
  if (!entry || !entry.game) {
    return {
      game_date: today(),
      opponent: 'fighters',
      phase: 'regular',
      home_away: 'home',
      stadium: '',
      result: 'win',
      is_sayonara: false,
      marines_score: '',
      opponent_score: '',
      home_runs: 0,
      grand_slams: 0,
      multi_hits: 0,
      rbi: 0,
      pitching_highlight: 'none',
      is_winning_pitcher: false,
      has_save: false,
      other_amount: '0',
      other_note: '',
    }
  }
  const g = entry.game
  return {
    game_date: g.game_date,
    opponent: g.opponent,
    phase: g.phase,
    home_away: g.home_away ?? 'home',
    stadium: g.stadium ?? '',
    result: g.result,
    is_sayonara: g.is_sayonara,
    marines_score: g.marines_score === null ? '' : String(g.marines_score),
    opponent_score: g.opponent_score === null ? '' : String(g.opponent_score),
    home_runs: g.home_runs,
    grand_slams: g.grand_slams,
    multi_hits: g.multi_hits ?? 0,
    rbi: g.rbi ?? 0,
    pitching_highlight: g.pitching_highlight,
    is_winning_pitcher: g.is_winning_pitcher ?? false,
    has_save: g.has_save,
    other_amount: String(entry.other_amount ?? 0),
    other_note: entry.other_note ?? '',
  }
}

function Counter({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="text-[12px] text-fg-dim">{label}</div>
      <div className="text-[10px] text-fg-mute">{hint}</div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label}を減らす`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-dim hover:border-marine/50 hover:text-marine"
        >
          <IconMinus size={16} />
        </button>
        <span className="tnum flex-1 text-center text-xl font-semibold">{value}</span>
        <button
          type="button"
          aria-label={`${label}を増やす`}
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-dim hover:border-marine/50 hover:text-marine"
        >
          <IconPlus size={16} />
        </button>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-3.5 transition-colors ${
        checked ? 'border-marine/70 bg-marine/10 text-marine' : 'border-line bg-white/[0.02] text-fg-dim'
      }`}
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-marine' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export default function GameSheet({
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
  const [form, setForm] = useState<FormState>(() => toForm(entry))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upd = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const otherAmount = Math.max(0, Number.parseInt(form.other_amount || '0', 10) || 0)

  const calc = useMemo(
    () =>
      calcSaving(
        {
          phase: form.phase,
          result: form.result,
          is_sayonara: form.result === 'win' && form.is_sayonara,
          home_runs: form.home_runs,
          grand_slams: form.grand_slams,
          multi_hits: form.multi_hits,
          rbi: form.rbi,
          pitching_highlight: form.pitching_highlight,
          is_winning_pitcher: form.is_winning_pitcher,
          has_save: form.has_save,
        },
        rules,
        otherAmount
      ),
    [form, rules, otherAmount]
  )

  const save = async () => {
    setSaving(true)
    setError(null)
    const supabase = createClient()

    const toScore = (raw: string) => {
      const parsed = Number.parseInt(raw, 10)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    }

    const gamePayload = {
      game_date: form.game_date,
      opponent: form.opponent,
      phase: form.phase,
      home_away: form.home_away,
      stadium: form.stadium.trim(),
      result: form.result,
      is_sayonara: form.result === 'win' && form.is_sayonara,
      marines_score: toScore(form.marines_score),
      opponent_score: toScore(form.opponent_score),
      home_runs: form.home_runs,
      grand_slams: form.grand_slams,
      multi_hits: form.multi_hits,
      rbi: form.rbi,
      pitching_highlight: form.pitching_highlight,
      is_winning_pitcher: form.is_winning_pitcher,
      has_save: form.has_save,
      source: 'manual' as const,
      created_by: userId,
    }

    const { data: game, error: gameError } = await supabase
      .from('games')
      .upsert(gamePayload, { onConflict: 'game_date,opponent' })
      .select()
      .single()

    if (gameError || !game) {
      setError('試合データの保存に失敗しました')
      setSaving(false)
      return
    }

    const { error: entryError } = await supabase.from('saving_entries').upsert(
      {
        user_id: userId,
        game_id: game.id,
        kind: 'game',
        title: '',
        entry_date: form.game_date,
        amount: calc.amount,
        breakdown: calc.lines,
        other_amount: otherAmount,
        other_note: form.other_note.trim(),
      },
      { onConflict: 'user_id,game_id' }
    )

    if (entryError) {
      setError('積立額の保存に失敗しました')
      setSaving(false)
      return
    }

    onClose()
    router.refresh()
  }

  return (
    <Sheet
      title={entry ? '試合記録を編集' : '試合を記録'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button variant="primary" full onClick={save} disabled={saving}>
            {saving ? '保存中' : entry ? '更新する' : '記録する'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="試合日">
          <input
            type="date"
            value={form.game_date}
            onChange={(e) => upd('game_date', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="対戦相手">
          <div className="grid grid-cols-3 gap-2">
            {OPPONENTS.map((o) => (
              <Chip
                key={o.id}
                selected={form.opponent === o.id}
                onClick={() => upd('opponent', o.id)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="開催" hint="球場名は任意">
          <div className="flex flex-col gap-2">
            <Segmented value={form.home_away} options={HOME_AWAY} onChange={(v) => upd('home_away', v)} />
            <input
              type="text"
              value={form.stadium}
              onChange={(e) => upd('stadium', e.target.value)}
              placeholder="ZOZOマリンスタジアム"
              className={inputClass}
            />
          </div>
        </Field>

        <Field label="フェーズ" hint="倍率が変わります">
          <div className="grid grid-cols-4 gap-2">
            {PHASES.map((p) => (
              <Chip
                key={p.id}
                selected={form.phase === p.id}
                onClick={() => upd('phase', p.id)}
                sub={`×${Number(rules[p.ruleKey]).toFixed(1)}`}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="試合結果">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {RESULTS.map((r) => (
                <Chip
                  key={r.id}
                  selected={form.result === r.id}
                  onClick={() => {
                    upd('result', r.id)
                    if (r.id !== 'win') upd('is_sayonara', false)
                  }}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
            {form.result === 'win' ? (
              <Toggle
                label="サヨナラ勝利"
                checked={form.is_sayonara}
                onChange={(v) => upd('is_sayonara', v)}
              />
            ) : null}
          </div>
        </Field>

        <Field label="スコア" hint="任意">
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.marines_score}
              onChange={(e) => upd('marines_score', e.target.value)}
              placeholder="MARINES"
              className={`${inputClass} tnum text-center`}
            />
            <span className="text-fg-mute">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.opponent_score}
              onChange={(e) => upd('opponent_score', e.target.value)}
              placeholder="OPPONENT"
              className={`${inputClass} tnum text-center`}
            />
          </div>
        </Field>

        <Field label="打撃ボーナス" hint="満塁HRはホームランに含めず別に数える">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Counter
                label="ホームラン"
                hint={`+¥${rules.home_run_amount}/本`}
                value={form.home_runs}
                onChange={(v) => upd('home_runs', v)}
              />
              <Counter
                label="満塁ホームラン"
                hint={`+¥${rules.grand_slam_amount}/本`}
                value={form.grand_slams}
                onChange={(v) => upd('grand_slams', v)}
              />
            </div>
            <div className="flex gap-3">
              <Counter
                label="マルチ安打"
                hint={`+¥${rules.multi_hit_amount}/人`}
                value={form.multi_hits}
                onChange={(v) => upd('multi_hits', v)}
              />
              <Counter
                label="打点"
                hint={`+¥${rules.rbi_amount}/点`}
                value={form.rbi}
                onChange={(v) => upd('rbi', v)}
              />
            </div>
          </div>
        </Field>

        <Field label="投手ボーナス" hint="先発ハイライトは最上位のみ加算">
          <div className="flex flex-col gap-2">
            <select
              value={form.pitching_highlight}
              onChange={(e) => upd('pitching_highlight', e.target.value as PitchingHighlight)}
              className={inputClass}
            >
              {PITCHING_HIGHLIGHTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Toggle
              label="勝利投手"
              checked={form.is_winning_pitcher}
              onChange={(v) => upd('is_winning_pitcher', v)}
            />
            <Toggle label="セーブ" checked={form.has_save} onChange={(v) => upd('has_save', v)} />
          </div>
        </Field>

        <Field label="その他ボーナス" hint="珍記録など">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={form.other_note}
              onChange={(e) => upd('other_note', e.target.value)}
              placeholder="例: 代打逆転満塁ホームラン"
              className={inputClass}
            />
            <div className="grid grid-cols-4 gap-2">
              {[0, 100, 500, 1000].map((amount) => (
                <Chip
                  key={amount}
                  selected={otherAmount === amount}
                  onClick={() => upd('other_amount', String(amount))}
                >
                  {amount === 0 ? 'なし' : `¥${amount}`}
                </Chip>
              ))}
            </div>
          </div>
        </Field>

        <div className="glass rounded-2xl p-4">
          <div className="eyebrow">This game</div>
          <div className="mt-2 divide-hairline">
            {calc.lines.length === 0 ? (
              <p className="py-2 text-[13px] text-fg-mute">加算対象がありません</p>
            ) : (
              calc.lines.map((line) => (
                <Row key={line.key} label={line.label} value={`+¥${line.amount.toLocaleString()}`} />
              ))
            )}
            <Row label="小計" value={`¥${calc.subtotal.toLocaleString()}`} />
            <Row label="フェーズ倍率" value={`×${calc.multiplier.toFixed(1)}`} />
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="eyebrow">積立予定額</span>
            <Amount value={calc.amount} size="lg" tone="marine" />
          </div>
        </div>
      </div>
    </Sheet>
  )
}
