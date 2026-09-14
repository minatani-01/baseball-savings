'use client'

import { useMemo, useState } from 'react'
import {
  Amount,
  Card,
  DeltaBadge,
  EmptyState,
  IconFrame,
  PillTabs,
  Row,
  SectionLabel,
} from '@/components/ui'
import { IconBaseball, IconCalendar, IconFlame, IconSpark } from '@/components/icons'
import CategoryIcon from '@/components/CategoryIcon'
import CumulativeChart, { type ChartPoint } from '@/components/charts/CumulativeChart'
import { depositedMonthSet, depositedTotal, monthOverMonth, notDepositedTotal, streakDays, sumByYear } from '@/lib/insights'
import { currentMonth, monthLabel, shortDate, yen } from '@/lib/format'
import { categoryLabel, opponentLabel, resultLabel } from '@/lib/constants'
import type { ExpenseCategory, MonthlySaving, SavingEntryRow, SplitRecord } from '@/types'

type Tab = 'trend' | 'transactions' | 'monthly' | 'yearly'

type TimelineItem = {
  key: string
  date: string
  kind: 'saving' | 'split'
  title: string
  caption: string
  amount: number
  category?: ExpenseCategory
  isCustom?: boolean
}

export default function HistoryClient({
  entries,
  records,
  monthlySavings,
}: {
  entries: SavingEntryRow[]
  records: SplitRecord[]
  monthlySavings: MonthlySaving[]
}) {
  const [tab, setTab] = useState<Tab>('trend')

  // 累計は「ワンバンクへ入金した月」だけを数える（ホーム・貯金と同じ定義）
  const total = useMemo(() => depositedTotal(monthlySavings), [monthlySavings])
  const notDeposited = useMemo(
    () => notDepositedTotal(entries, monthlySavings),
    [entries, monthlySavings]
  )
  const deposited = useMemo(() => depositedMonthSet(monthlySavings), [monthlySavings])
  const month = currentMonth()
  const monthTotal = useMemo(
    () => entries.filter((e) => e.month === month).reduce((sum, e) => sum + e.amount, 0),
    [entries, month]
  )
  const delta = useMemo(() => monthOverMonth(entries, month), [entries, month])
  const streak = useMemo(() => streakDays(entries), [entries])

  // 推移も入金済みの月だけを積む。グラフの終点と上の累計額を必ず一致させる
  const chartPoints: ChartPoint[] = useMemo(() => {
    const sorted = [...entries]
      .filter((e) => deposited.has(e.month))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    let cumulative = 0
    return sorted.map((entry) => {
      cumulative += entry.amount
      return { date: entry.entry_date, value: cumulative }
    })
  }, [entries, deposited])

  const timeline: TimelineItem[] = useMemo(
    () =>
      [
        ...entries.map<TimelineItem>((entry) => ({
          key: `saving-${entry.id}`,
          date: entry.entry_date,
          kind: 'saving',
          title: entry.game
            ? `${resultLabel(entry.game.result, entry.game.is_sayonara)} vs ${opponentLabel(entry.game.opponent)}`
            : entry.title,
          caption: entry.game ? '試合貯金' : 'カスタム貯金',
          amount: entry.amount,
          isCustom: entry.kind === 'custom',
        })),
        ...records.map<TimelineItem>((record) => ({
          key: `split-${record.id}`,
          date: record.date,
          kind: 'split',
          title: record.content,
          caption: `${categoryLabel(record.category)} / ${record.payer} が立替`,
          amount: record.amount,
          category: record.category,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)),
    [entries, records]
  )

  const monthlyRows = useMemo(() => {
    const map = new Map<
      string,
      { savings: number; games: number; wins: number; spend: number; unpaid: number }
    >()
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { savings: 0, games: 0, wins: 0, spend: 0, unpaid: 0 })
      return map.get(key)!
    }
    for (const entry of entries) {
      const row = ensure(entry.month)
      row.savings += entry.amount
      if (entry.game) {
        row.games += 1
        if (entry.game.result === 'win') row.wins += 1
      }
    }
    for (const record of records) {
      const row = ensure(record.date.slice(0, 7))
      row.spend += record.amount
      if (record.status === 'unpaid') row.unpaid += record.amount
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries, records])

  const yearlyRows = useMemo(() => {
    const savings = sumByYear(entries)
    const spendByYear = new Map<string, number>()
    for (const record of records) {
      const year = record.date.slice(0, 4)
      spendByYear.set(year, (spendByYear.get(year) ?? 0) + record.amount)
    }
    const years = new Set([...savings.map((s) => s.year), ...spendByYear.keys()])
    return [...years]
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({
        year,
        amount: savings.find((s) => s.year === year)?.amount ?? 0,
        count: savings.find((s) => s.year === year)?.count ?? 0,
        spend: spendByYear.get(year) ?? 0,
      }))
  }, [entries, records])

  return (
    <div className="flex flex-col gap-6">
      <PillTabs
        value={tab}
        options={[
          { id: 'trend', label: '貯金推移' },
          { id: 'transactions', label: '取引履歴' },
          { id: 'monthly', label: '月別' },
          { id: 'yearly', label: '年別' },
        ]}
        onChange={setTab}
      />

      {tab === 'trend' ? (
        <>
          <Card className="glow">
            <div className="eyebrow">累計貯金額</div>
            <div className="mt-2 flex items-baseline gap-3">
              <Amount value={total} size="xl" tone="marine" />
              <DeltaBadge percent={delta} />
            </div>
            <p className="mt-1 text-[11px] text-fg-mute">
              ワンバンクへ入金した金額の合計
              {notDeposited > 0 ? ` / 未入金 ${yen(notDeposited)}` : ''}
            </p>
            <div className="mt-4">
              <CumulativeChart points={chartPoints} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Card>
              <div className="flex items-center gap-2">
                <IconFrame>
                  <IconCalendar size={16} />
                </IconFrame>
                <span className="text-[11px] text-fg-mute">今月の貯金額</span>
              </div>
              <div className="tnum mt-2 text-xl font-semibold">{yen(monthTotal)}</div>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <IconFrame>
                  <IconFlame size={16} />
                </IconFrame>
                <span className="text-[11px] text-fg-mute">貯金継続日数</span>
              </div>
              <div className="tnum mt-2 text-xl font-semibold">{streak}日</div>
            </Card>
          </div>

          <div>
            <SectionLabel>最近の取引</SectionLabel>
            <Timeline items={timeline.slice(0, 6)} />
          </div>
        </>
      ) : null}

      {tab === 'transactions' ? (
        <div>
          <SectionLabel>取引履歴</SectionLabel>
          <Timeline items={timeline} />
        </div>
      ) : null}

      {tab === 'monthly' ? (
        <div>
          <SectionLabel>月別</SectionLabel>
          {monthlyRows.length === 0 ? (
            <EmptyState title="集計できる記録がありません" />
          ) : (
            <div className="flex flex-col gap-2">
              {monthlyRows.map(([key, row]) => {
                const winRate = row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0
                return (
                  <Card key={key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold">{monthLabel(key)}</div>
                        <p className="tnum mt-1 text-[11px] text-fg-mute">
                          {row.games} Games / {row.wins} Wins / 勝率 {winRate}%
                        </p>
                      </div>
                      <Amount value={row.savings} size="md" tone="marine" />
                    </div>
                    {row.spend > 0 ? (
                      <div className="mt-3 divide-hairline border-t border-line pt-1">
                        <Row label="観戦・立替支出" value={yen(row.spend)} />
                        {row.unpaid > 0 ? <Row label="うち未精算" value={yen(row.unpaid)} /> : null}
                      </div>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'yearly' ? (
        <div>
          <SectionLabel>年別</SectionLabel>
          {yearlyRows.length === 0 ? (
            <EmptyState title="集計できる記録がありません" />
          ) : (
            <div className="flex flex-col gap-2">
              {yearlyRows.map((row) => (
                <Card key={row.year}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="tnum text-[15px] font-semibold">{row.year}年</div>
                      <p className="tnum mt-1 text-[11px] text-fg-mute">{row.count} 件の記録</p>
                    </div>
                    <Amount value={row.amount} size="md" tone="marine" />
                  </div>
                  {row.spend > 0 ? (
                    <div className="mt-3 divide-hairline border-t border-line pt-1">
                      <Row label="観戦・立替支出" value={yen(row.spend)} />
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <EmptyState title="まだ記録がありません" />

  return (
    <Card padded={false}>
      <div className="divide-hairline px-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 py-3">
            <IconFrame tone={item.kind === 'saving' ? 'marine' : 'default'}>
              {item.kind === 'saving' ? (
                item.isCustom ? (
                  <IconSpark size={16} />
                ) : (
                  <IconBaseball size={16} />
                )
              ) : (
                <CategoryIcon category={item.category ?? 'other'} size={16} />
              )}
            </IconFrame>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px]">{item.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-mute">
                <span className="tnum">{shortDate(item.date)}</span>
                <span className="truncate">{item.caption}</span>
              </div>
            </div>

            <span
              className={`tnum shrink-0 text-sm font-semibold ${
                item.kind === 'saving' ? 'text-marine' : 'text-fg'
              }`}
            >
              {yen(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
