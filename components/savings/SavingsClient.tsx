'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Amount,
  Button,
  Card,
  EmptyState,
  IconButton,
  Row,
  SectionLabel,
  StatusPill,
} from '@/components/ui'
import { IconChevronRight, IconEdit, IconPlus, IconRules, IconTrash } from '@/components/icons'
import { CopyAmountButton, OpenAppButton } from '@/components/HandoffActions'
import GameSheet from '@/components/savings/GameSheet'
import { createClient } from '@/lib/supabase/client'
import { BREAKDOWN_GROUP_LABEL, groupBreakdown } from '@/lib/savings'
import { currentMonth, monthLabel, monthLabelEn, shortDate, yen } from '@/lib/format'
import {
  MONTHLY_STATUS_LABEL,
  opponentLabel,
  phaseLabel,
  pitchingHighlightLabel,
  resultLabel,
} from '@/lib/constants'
import type { MonthlySaving, MonthlyStatus, SavingEntryWithGame, SavingRules } from '@/types'

const STATUS_TONE: Record<MonthlyStatus, 'neutral' | 'marine' | 'warn' | 'done'> = {
  calculating: 'neutral',
  ready: 'marine',
  deposit_pending: 'warn',
  deposited: 'done',
}

export default function SavingsClient({
  userId,
  entries,
  monthlySavings,
  rules,
}: {
  userId: string
  entries: SavingEntryWithGame[]
  monthlySavings: MonthlySaving[]
  rules: SavingRules
}) {
  const router = useRouter()
  const [sheetEntry, setSheetEntry] = useState<SavingEntryWithGame | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const months = useMemo(() => {
    const set = new Set<string>(entries.map((e) => e.month))
    set.add(currentMonth())
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [entries])

  const [month, setMonth] = useState(() => months[0] ?? currentMonth())

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries])

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => e.month === month)
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries, month]
  )

  const monthTotal = useMemo(
    () => monthEntries.reduce((sum, e) => sum + e.amount, 0),
    [monthEntries]
  )

  const groups = useMemo(() => {
    const totals: Record<string, number> = { result: 0, batting: 0, pitching: 0, other: 0 }
    for (const entry of monthEntries) {
      const grouped = groupBreakdown(entry.breakdown ?? [])
      for (const key of Object.keys(totals)) totals[key] += grouped[key] ?? 0
    }
    return totals
  }, [monthEntries])

  const monthly = monthlySavings.find((m) => m.month === month) ?? null
  const status: MonthlyStatus = monthly?.status ?? 'calculating'
  const confirmed = monthly?.confirmed_amount ?? null
  const displayAmount = status === 'calculating' || confirmed === null ? monthTotal : confirmed

  const updateMonthly = async (patch: Partial<MonthlySaving>) => {
    setBusy(true)
    const supabase = createClient()
    await supabase
      .from('monthly_savings')
      .upsert({ user_id: userId, month, ...patch }, { onConflict: 'user_id,month' })
    setBusy(false)
    router.refresh()
  }

  const removeEntry = async (entry: SavingEntryWithGame) => {
    if (!window.confirm(`${shortDate(entry.entry_date)} の記録を削除しますか？`)) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from('saving_entries').delete().eq('id', entry.id)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 累計 */}
      <Card className="glow">
        <div className="eyebrow">Total lotte savings</div>
        <div className="mt-2">
          <Amount value={total} size="xl" tone="marine" />
        </div>
        <p className="mt-2 text-xs text-fg-mute">
          {entries.length} Games / 記録済みの全試合合計
        </p>
      </Card>

      {/* 月選択 */}
      <div>
        <SectionLabel
          action={
            <Link
              href="/savings/rules"
              className="inline-flex items-center gap-1.5 text-[12px] text-fg-dim hover:text-marine"
            >
              <IconRules size={15} />
              貯金ルール
              <IconChevronRight size={13} />
            </Link>
          }
        >
          Monthly
        </SectionLabel>

        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonth(m)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
                m === month
                  ? 'border-marine/70 bg-marine/10 text-marine'
                  : 'border-line text-fg-mute hover:text-fg-dim'
              }`}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">{monthLabelEn(month)}</div>
              <div className="mt-2">
                <Amount value={displayAmount} size="lg" tone="marine" />
              </div>
              <p className="mt-1 text-xs text-fg-mute">
                {monthEntries.length} Games
                {status !== 'calculating' && confirmed !== null && confirmed !== monthTotal
                  ? ` / 集計値 ${yen(monthTotal)}`
                  : ''}
              </p>
            </div>
            <StatusPill tone={STATUS_TONE[status]}>{MONTHLY_STATUS_LABEL[status]}</StatusPill>
          </div>

          {monthEntries.length > 0 ? (
            <div className="mt-4 divide-hairline border-t border-line pt-1">
              {Object.entries(groups)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => (
                  <Row key={key} label={BREAKDOWN_GROUP_LABEL[key]} value={yen(value)} />
                ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {status === 'calculating' ? (
              <Button
                variant="primary"
                full
                disabled={busy || monthTotal <= 0}
                onClick={() =>
                  updateMonthly({
                    status: 'ready',
                    confirmed_amount: monthTotal,
                    confirmed_at: new Date().toISOString(),
                  })
                }
              >
                この月の金額を確定する
              </Button>
            ) : null}

            {status === 'ready' ? (
              <>
                <p className="text-xs leading-relaxed text-fg-mute">
                  ワンバンクへの入金はご自身で行ってください。Marine Wallet
                  は金額の記録と誘導のみを行い、資金は保有・移動しません。
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <CopyAmountButton amount={displayAmount} label={`${yen(displayAmount)}をコピー`} />
                  <OpenAppButton app="onebank" />
                </div>
                <Button
                  full
                  disabled={busy}
                  onClick={() => updateMonthly({ status: 'deposit_pending' })}
                >
                  入金手続き中にする
                </Button>
                <Button
                  variant="ghost"
                  full
                  disabled={busy}
                  onClick={() =>
                    updateMonthly({ status: 'calculating', confirmed_amount: null, confirmed_at: null })
                  }
                >
                  確定を取り消す
                </Button>
              </>
            ) : null}

            {status === 'deposit_pending' ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <CopyAmountButton amount={displayAmount} label={`${yen(displayAmount)}をコピー`} />
                  <OpenAppButton app="onebank" />
                </div>
                <Button
                  variant="primary"
                  full
                  disabled={busy}
                  onClick={() =>
                    updateMonthly({ status: 'deposited', deposited_at: new Date().toISOString() })
                  }
                >
                  入金済みにする
                </Button>
                <Button variant="ghost" full disabled={busy} onClick={() => updateMonthly({ status: 'ready' })}>
                  確定済みに戻す
                </Button>
              </>
            ) : null}

            {status === 'deposited' ? (
              <>
                <p className="text-xs text-fg-mute">
                  {monthly?.deposited_at
                    ? `${new Date(monthly.deposited_at).toLocaleDateString('ja-JP')} に入金済み`
                    : '入金済み'}
                </p>
                <Button
                  variant="ghost"
                  full
                  disabled={busy}
                  onClick={() => updateMonthly({ status: 'deposit_pending', deposited_at: null })}
                >
                  入金済みを取り消す
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      </div>

      {/* 試合一覧 */}
      <div>
        <SectionLabel
          action={
            <button
              type="button"
              onClick={() => {
                setSheetEntry(null)
                setSheetOpen(true)
              }}
              className="inline-flex items-center gap-1.5 text-[12px] text-marine"
            >
              <IconPlus size={15} />
              試合を記録
            </button>
          }
        >
          Games
        </SectionLabel>

        {monthEntries.length === 0 ? (
          <EmptyState
            title="この月の記録はまだありません"
            description="試合結果を登録すると、貯金ルールに沿って積立予定額が計算されます。"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {monthEntries.map((entry) => {
              const g = entry.game
              const details = [
                g.home_runs > 0 ? `HR ${g.home_runs}` : null,
                g.grand_slams > 0 ? `満塁HR ${g.grand_slams}` : null,
                g.pitching_highlight !== 'none' ? pitchingHighlightLabel(g.pitching_highlight) : null,
                g.has_save ? 'セーブ' : null,
                entry.other_note ? entry.other_note : null,
              ].filter(Boolean)

              return (
                <Card key={entry.id} className="!p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-fg-mute">
                        <span className="tnum">{shortDate(entry.entry_date)}</span>
                        {g.phase !== 'regular' ? <span>{phaseLabel(g.phase)}</span> : null}
                        <span>{g.home_away === 'home' ? 'H' : 'A'}</span>
                      </div>
                      <div className="mt-1 truncate text-sm">
                        {resultLabel(g.result, g.is_sayonara)}
                        <span className="text-fg-mute"> vs </span>
                        {opponentLabel(g.opponent)}
                        {g.marines_score !== null && g.opponent_score !== null ? (
                          <span className="tnum text-fg-mute">
                            {' '}
                            {g.marines_score}-{g.opponent_score}
                          </span>
                        ) : null}
                      </div>
                      {details.length > 0 ? (
                        <p className="mt-1 truncate text-[11px] text-fg-mute">{details.join(' / ')}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Amount value={entry.amount} size="sm" tone="marine" />
                      <div className="flex gap-1.5">
                        <IconButton
                          label="編集"
                          onClick={() => {
                            setSheetEntry(entry)
                            setSheetOpen(true)
                          }}
                        >
                          <IconEdit size={15} />
                        </IconButton>
                        <IconButton
                          label="削除"
                          onClick={() => removeEntry(entry)}
                          className="hover:border-danger/50 hover:text-danger"
                        >
                          <IconTrash size={15} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {sheetOpen ? (
        <GameSheet
          entry={sheetEntry}
          rules={rules}
          userId={userId}
          onClose={() => {
            setSheetOpen(false)
            setSheetEntry(null)
          }}
        />
      ) : null}
    </div>
  )
}
