'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Chip, Field, Segmented, Sheet, inputClass } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { distributeEqual, distributeRatio } from '@/lib/warikan'
import { today, yen } from '@/lib/format'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import type {
  ExpenseCategory,
  MemberCount,
  MemberSettings,
  Share,
  SplitRecord,
  SplitStatus,
  SplitType,
} from '@/types'

const SPLIT_TYPES: { id: SplitType; label: string }[] = [
  { id: 'equal', label: '均等' },
  { id: 'ratio', label: '比率' },
  { id: 'amount', label: '金額' },
]

function resizeInputs(prev: string[], size: number): string[] {
  if (prev.length === size) return prev
  if (prev.length > size) return prev.slice(0, size)
  return [...prev, ...Array.from({ length: size - prev.length }, () => '')]
}

export default function SplitSheet({
  record,
  settings,
  userId,
  onClose,
}: {
  record: SplitRecord | null
  settings: MemberSettings
  userId: string
  onClose: () => void
}) {
  const router = useRouter()
  const hasMemberC = Boolean(settings.member_c?.trim())

  const [date, setDate] = useState(record?.date ?? today())
  const [content, setContent] = useState(record?.content ?? '')
  const [amount, setAmount] = useState(record ? String(record.amount) : '')
  const [category, setCategory] = useState<ExpenseCategory>(record?.category ?? 'other')
  const [memberCount, setMemberCount] = useState<MemberCount>(record?.member_count ?? 2)
  const [payer, setPayer] = useState(record?.payer ?? settings.member_a)
  const [status, setStatus] = useState<SplitStatus>(record?.status ?? 'unpaid')
  const [splitType, setSplitType] = useState<SplitType>(record?.split_type ?? 'equal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const members = useMemo(() => {
    const all = [settings.member_a, settings.member_b, settings.member_c?.trim() || 'Cさん']
    return all.slice(0, memberCount)
  }, [settings, memberCount])

  const [ratioInputs, setRatioInputs] = useState<string[]>(() => {
    if (record?.split_type === 'ratio' && record.shares?.length === record.member_count) {
      return record.shares.map((s) => (s.value != null ? String(s.value) : ''))
    }
    return members.map(() => '')
  })
  const [amountInputs, setAmountInputs] = useState<string[]>(() => {
    if (record?.shares?.length === record?.member_count && record?.shares) {
      return record.shares.map((s) => String(s.burden))
    }
    return members.map(() => '')
  })

  useEffect(() => {
    setRatioInputs((prev) => resizeInputs(prev, members.length))
    setAmountInputs((prev) => resizeInputs(prev, members.length))
    setPayer((prev) => (members.includes(prev) ? prev : members[0]))
  }, [members])

  const parsedAmount = Number.parseInt(amount, 10) || 0

  const equalBurdens = useMemo(
    () => distributeEqual(parsedAmount, members.length),
    [parsedAmount, members.length]
  )

  const ratioValues = useMemo(
    () => ratioInputs.map((v) => Number.parseFloat(v) || 0),
    [ratioInputs]
  )
  const ratioTotal = ratioValues.reduce((sum, v) => sum + v, 0)
  const ratioBurdens = useMemo(() => {
    if (ratioTotal <= 0) return members.map(() => 0)
    return distributeRatio(parsedAmount, ratioValues)
  }, [parsedAmount, ratioValues, ratioTotal, members])

  const amountBurdens = amountInputs.map((v) => Number.parseInt(v, 10) || 0)
  const amountSum = amountBurdens.reduce((sum, v) => sum + v, 0)
  const amountDiff = parsedAmount - amountSum

  const buildShares = (): Share[] => {
    if (splitType === 'equal') {
      return members.map((m, i) => ({ member: m, value: null, burden: equalBurdens[i] ?? 0 }))
    }
    if (splitType === 'ratio') {
      return members.map((m, i) => ({
        member: m,
        value: ratioValues[i] ?? 0,
        burden: ratioBurdens[i] ?? 0,
      }))
    }
    return members.map((m, i) => ({
      member: m,
      value: amountBurdens[i] ?? 0,
      burden: amountBurdens[i] ?? 0,
    }))
  }

  const canSubmit =
    Boolean(date) &&
    content.trim().length > 0 &&
    parsedAmount > 0 &&
    Boolean(payer) &&
    (splitType !== 'amount' || amountDiff === 0) &&
    (splitType !== 'ratio' || ratioTotal > 0)

  const save = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const shares = buildShares()
    // 負担額の合計は必ず金額と一致させる（DB側の整合性を保つ）
    if (shares.reduce((sum, s) => sum + s.burden, 0) !== parsedAmount) {
      setError('負担額の合計が金額と一致していません')
      setSaving(false)
      return
    }

    const payload = {
      user_id: userId,
      date,
      content: content.trim(),
      amount: parsedAmount,
      payer,
      status,
      split_type: splitType,
      member_count: memberCount,
      shares,
      category,
    }

    const supabase = createClient()
    const { error } = record
      ? await supabase.from('records').update(payload).eq('id', record.id)
      : await supabase.from('records').insert(payload)

    setSaving(false)
    if (error) {
      setError('保存に失敗しました')
      return
    }
    onClose()
    router.refresh()
  }

  const smallInput =
    'tnum w-24 rounded-lg border border-line bg-ink-2/80 px-2.5 py-1.5 text-right text-fg outline-none focus:border-marine/70'

  return (
    <Sheet
      title={record ? '支出を編集' : '支出を登録'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button variant="primary" full onClick={save} disabled={saving || !canSubmit}>
            {saving ? '保存中' : record ? '更新する' : '登録する'}
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

        <Field label="内容">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例: ZOZOマリン 内野指定席"
            className={inputClass}
          />
        </Field>

        <Field label="金額">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`${inputClass} tnum`}
          />
        </Field>

        <Field label="カテゴリ" hint="観戦支出の集計に使います">
          <div className="grid grid-cols-3 gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label="人数"
          hint={hasMemberC ? undefined : '3人にするにはメンバーCの登録が必要です'}
        >
          <Segmented
            value={String(memberCount)}
            options={[
              { id: '2', label: '2人' },
              { id: '3', label: hasMemberC ? '3人' : '3人（未登録）' },
            ]}
            onChange={(v) => {
              const next = Number(v) as MemberCount
              if (next === 3 && !hasMemberC) return
              setMemberCount(next)
            }}
          />
        </Field>

        <Field label="決済者">
          <select value={payer} onChange={(e) => setPayer(e.target.value)} className={inputClass}>
            {members.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="割り勘方法">
          <div className="flex flex-col gap-2">
            <Segmented value={splitType} options={SPLIT_TYPES} onChange={setSplitType} />

            <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/[0.02] p-3">
              {members.map((m, i) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">{m}</span>

                  {splitType === 'equal' ? (
                    <span className="tnum text-sm text-fg-dim">{yen(equalBurdens[i] ?? 0)}</span>
                  ) : null}

                  {splitType === 'ratio' ? (
                    <>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={ratioInputs[i] ?? ''}
                        onChange={(e) =>
                          setRatioInputs((prev) =>
                            prev.map((p, idx) => (idx === i ? e.target.value : p))
                          )
                        }
                        placeholder="0"
                        className={`${smallInput} w-16`}
                      />
                      <span className="tnum w-24 text-right text-sm text-fg-dim">
                        {yen(ratioBurdens[i] ?? 0)}
                      </span>
                    </>
                  ) : null}

                  {splitType === 'amount' ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={amountInputs[i] ?? ''}
                      onChange={(e) =>
                        setAmountInputs((prev) =>
                          prev.map((p, idx) => (idx === i ? e.target.value : p))
                        )
                      }
                      placeholder="0"
                      className={smallInput}
                    />
                  ) : null}
                </div>
              ))}

              {splitType === 'ratio' ? (
                <p className="text-right text-[11px] text-fg-mute">比率合計 {ratioTotal}</p>
              ) : null}

              {splitType === 'amount' ? (
                <p
                  className={`text-right text-[11px] ${
                    amountDiff === 0 ? 'text-teal' : 'text-warn'
                  }`}
                >
                  {amountDiff === 0
                    ? '合計金額と一致しています'
                    : amountDiff > 0
                      ? `不足 ${yen(amountDiff)}`
                      : `超過 ${yen(Math.abs(amountDiff))}`}
                </p>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label="ステータス">
          <Segmented
            value={status}
            options={[
              { id: 'unpaid', label: '未精算' },
              { id: 'paid', label: '精算済み' },
            ]}
            onChange={setStatus}
          />
        </Field>
      </div>
    </Sheet>
  )
}
