'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Amount,
  Button,
  Card,
  DeltaBadge,
  EmptyState,
  IconButton,
  IconFrame,
  PillTabs,
  ProgressBar,
  Row,
  SectionLabel,
  Segmented,
  StatusPill,
} from '@/components/ui'
import {
  IconBaseball,
  IconChevronRight,
  IconEdit,
  IconRules,
  IconSpark,
  IconTrash,
} from '@/components/icons'
import { CopyAmountButton, OpenAppButton } from '@/components/HandoffActions'
import GameSheet from '@/components/savings/GameSheet'
import CustomSavingSheet from '@/components/savings/CustomSavingSheet'
import { createClient } from '@/lib/supabase/client'
import { BREAKDOWN_GROUP_LABEL, groupBreakdown } from '@/lib/savings'
import { goalProgress, monthOverMonth } from '@/lib/insights'
import { currentMonth, monthLabel, monthLabelEn, shortDate, yen } from '@/lib/format'
import {
  MONTHLY_STATUS_LABEL,
  opponentLabel,
  phaseLabel,
  pitchingHighlightLabel,
  resultLabel,
} from '@/lib/constants'
import type { MonthlySaving, MonthlyStatus, SavingEntryRow, SavingRules } from '@/types'

const STATUS_TONE: Record<MonthlyStatus, 'neutral' | 'marine' | 'warn' | 'done'> = {
  calculating: 'neutral',
  ready: 'marine',
  deposit_pending: 'warn',
  deposited: 'done',
}

type SheetMode = 'game' | 'custom'

export default function SavingsClient({
  userId,
  entries,
  monthlySavings,
  rules,
}: {
  userId: string
  entries: SavingEntryRow[]
  monthlySavings: MonthlySaving[]
  rules: SavingRules
}) {
  const router = useRouter()
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null)
  const [editing, setEditing] = useState<SavingEntryRow | null>(null)
  const [addMode, setAddMode] = useState<SheetMode>('game')
  const [busy, setBusy] = useState(false)

  const months = useMemo(() => {
    const set = new Set<string>(entries.map((e) => e.month))
    set.add(currentMonth())
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [entries])

  const [month, setMonth] = useState(() => months[0] ?? currentMonth())

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries])
  const delta = useMemo(() => monthOverMonth(entries, month), [entries, month])

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

  const goal = goalProgress(monthTotal, rules.monthly_goal_amount)

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

  const removeEntry = async (entry: SavingEntryRow) => {
    if (!window.confirm(`${shortDate(entry.entry_date)} の記録を削除しますか？`)) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from('saving_entries').delete().eq('id', entry.id)
    setBusy(false)
    router.refresh()
  }

  const openAdd = () => {
    setEditing(null)
    setSheetMode(addMode)
  }

  const closeSheet = () => {
    setSheetMode(null)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 累計 */}
      <Card className="glow">
        <div className="eyebrow">Total lotte savings</div>
        <div className="mt-2 flex items-baseline gap-3">
          <Amount value={total} size="xl" tone="marine" />
          <DeltaBadge percent={delta} />
        </div>
        <p className="mt-2 text-xs text-fg-mute">{entries.length} 件の記録</p>
      </Card>

      {/* 貯金する */}
      <div>
        <SectionLabel
          action={
            <Link
              href="/savings/rules"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-[12px] text-fg-dim hover:text-marine"
            >
              <IconRules size={15} />
              貯金ルール
              <IconChevronRight size={13} />
            </Link>
          }
        >
          貯金する
        </SectionLabel>
        <Card>
          <Segmented
            value={addMode}
            options={[
              { id: 'game', label: '試合登録' },
              { id: 'custom', label: 'カスタム貯金' },
            ]}
            onChange={(v) => setAddMode(v as SheetMode)}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-fg-mute">
            {addMode === 'game'
              ? '試合結果を登録すると、貯金ルールに沿って積立予定額を自動計算します。'
              : '試合に紐づかない任意の金額を積み立てます。フェーズ倍率は適用されません。'}
          </p>
          <Button variant="primary" full className="mt-3" onClick={openAdd}>
            {addMode === 'game' ? '試合を登録する' : 'カスタム貯金を追加する'}
            <IconChevronRight size={16} />
          </Button>
        </Card>
      </div>

      {/* 月選択 */}
      <div>
        <SectionLabel>Monthly</SectionLabel>

        <div className="mb-3">
          <PillTabs
            value={month}
            options={months.map((m) => ({ id: m, label: monthLabel(m) }))}
            onChange={setMonth}
          />
        </div>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">{monthLabelEn(month)}</div>
              <div className="mt-2">
                <Amount value={displayAmount} size="lg" tone="marine" />
              </div>
              <p className="mt-1 text-xs text-fg-mute">
                {monthEntries.length} 件
                {status !== 'calculating' && confirmed !== null && confirmed !== monthTotal
                  ? ` / 集計値 ${yen(monthTotal)}`
                  : ''}
              </p>
            </div>
            <StatusPill tone={STATUS_TONE[status]}>{MONTHLY_STATUS_LABEL[status]}</StatusPill>
          </div>

          {goal.percent !== null ? (
            <div className="mt-4 border-t border-line pt-4">
              <ProgressBar
                value={goal.current}
                max={goal.goal}
                label="目標金額"
                caption={`${yen(goal.current)} / ${yen(goal.goal)}`}
              />
            </div>
          ) : null}

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
                <Button full disabled={busy} onClick={() => updateMonthly({ status: 'deposit_pending' })}>
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

      {/* 記録一覧 */}
      <div>
        <SectionLabel>Records</SectionLabel>

        {monthEntries.length === 0 ? (
          <EmptyState
            title="この月の記録はまだありません"
            description="試合を登録するか、カスタム貯金で任意の金額を積み立ててください。"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {monthEntries.map((entry) => {
              const g = entry.game
              const details = g
                ? [
                    g.home_runs > 0 ? `HR ${g.home_runs}` : null,
                    g.grand_slams > 0 ? `満塁HR ${g.grand_slams}` : null,
                    g.multi_hits > 0 ? `マルチ安打 ${g.multi_hits}` : null,
                    g.rbi > 0 ? `打点 ${g.rbi}` : null,
                    g.pitching_highlight !== 'none'
                      ? pitchingHighlightLabel(g.pitching_highlight)
                      : null,
                    g.is_winning_pitcher ? '勝利投手' : null,
                    g.has_save ? 'セーブ' : null,
                    entry.other_note || null,
                  ].filter(Boolean)
                : [entry.other_note || null].filter(Boolean)

              return (
                <Card key={entry.id} className="!p-3.5">
                  <div className="flex items-start gap-3">
                    <IconFrame tone="marine">
                      {g ? <IconBaseball size={17} /> : <IconSpark size={17} />}
                    </IconFrame>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-fg-mute">
                        <span className="tnum">{shortDate(entry.entry_date)}</span>
                        {g && g.phase !== 'regular' ? <span>{phaseLabel(g.phase)}</span> : null}
                        {g ? (
                          g.home_away ? <span>{g.home_away === 'home' ? 'H' : 'A'}</span> : null
                        ) : (
                          <span>カスタム</span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm">
                        {g ? (
                          <>
                            {resultLabel(g.result, g.is_sayonara)}
                            <span className="text-fg-mute"> vs </span>
                            {opponentLabel(g.opponent)}
                            {g.marines_score !== null && g.opponent_score !== null ? (
                              <span className="tnum text-fg-mute">
                                {' '}
                                {g.marines_score}-{g.opponent_score}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          entry.title
                        )}
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
                            setEditing(entry)
                            setSheetMode(entry.kind === 'custom' ? 'custom' : 'game')
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

      {sheetMode === 'game' ? (
        <GameSheet entry={editing} rules={rules} userId={userId} onClose={closeSheet} />
      ) : null}
      {sheetMode === 'custom' ? (
        <CustomSavingSheet entry={editing} userId={userId} onClose={closeSheet} />
      ) : null}
    </div>
  )
}
