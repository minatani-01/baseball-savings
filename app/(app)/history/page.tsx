import { redirect } from 'next/navigation'
import { Amount, Card, EmptyState, Row, SectionLabel } from '@/components/ui'
import CumulativeChart, { type ChartPoint } from '@/components/charts/CumulativeChart'
import { getSavingEntries, getSessionUser, getSplitRecords } from '@/lib/queries'
import { monthLabel, shortDate, yen } from '@/lib/format'
import { categoryLabel, opponentLabel, resultLabel } from '@/lib/constants'
import type { ExpenseCategory } from '@/types'

export default async function HistoryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, records] = await Promise.all([
    getSavingEntries(user.id),
    getSplitRecords(user.id),
  ])

  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  const chartPoints: ChartPoint[] = (() => {
    const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    let cumulative = 0
    return sorted.map((entry) => {
      cumulative += entry.amount
      return { date: entry.entry_date, value: cumulative }
    })
  })()

  // 月次サマリー
  const months = new Map<
    string,
    { savings: number; games: number; wins: number; spend: number; unpaid: number }
  >()
  const ensure = (month: string) => {
    if (!months.has(month)) {
      months.set(month, { savings: 0, games: 0, wins: 0, spend: 0, unpaid: 0 })
    }
    return months.get(month)!
  }

  for (const entry of entries) {
    const row = ensure(entry.month)
    row.savings += entry.amount
    row.games += 1
    if (entry.game.result === 'win') row.wins += 1
  }
  for (const record of records) {
    const row = ensure(record.date.slice(0, 7))
    row.spend += record.amount
    if (record.status === 'unpaid') row.unpaid += record.amount
  }

  const sortedMonths = [...months.keys()].sort((a, b) => b.localeCompare(a))

  // カテゴリ別の観戦支出
  const byCategory = new Map<ExpenseCategory, number>()
  for (const record of records) {
    byCategory.set(record.category, (byCategory.get(record.category) ?? 0) + record.amount)
  }
  const categoryRows = [...byCategory.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  // 統合タイムライン
  const timeline = [
    ...entries.map((entry) => ({
      key: `saving-${entry.id}`,
      date: entry.entry_date,
      kind: '貯金' as const,
      title: `${resultLabel(entry.game.result, entry.game.is_sayonara)} vs ${opponentLabel(entry.game.opponent)}`,
      amount: entry.amount,
    })),
    ...records.map((record) => ({
      key: `split-${record.id}`,
      date: record.date,
      kind: '割り勘' as const,
      title: `${record.content}（${categoryLabel(record.category)}）`,
      amount: record.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))

  const totalSpend = records.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>Savings trend</SectionLabel>
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[13px] text-fg-dim">累計貯金額</span>
            <Amount value={total} size="md" tone="marine" />
          </div>
          <CumulativeChart points={chartPoints} />
        </Card>
      </div>

      <div>
        <SectionLabel>Monthly</SectionLabel>
        {sortedMonths.length === 0 ? (
          <EmptyState title="集計できる記録がありません" />
        ) : (
          <div className="flex flex-col gap-2">
            {sortedMonths.map((month) => {
              const row = months.get(month)!
              const winRate = row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0
              return (
                <Card key={month}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{monthLabel(month)}</div>
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

      {categoryRows.length > 0 ? (
        <div>
          <SectionLabel>Stadium wallet</SectionLabel>
          <Card>
            <div className="divide-hairline">
              {categoryRows.map(([category, value]) => (
                <Row key={category} label={categoryLabel(category)} value={yen(value)} />
              ))}
              <Row label="合計" value={yen(totalSpend)} strong />
            </div>
          </Card>
        </div>
      ) : null}

      <div>
        <SectionLabel>Timeline</SectionLabel>
        {timeline.length === 0 ? (
          <EmptyState title="まだ記録がありません" />
        ) : (
          <Card padded={false}>
            <div className="divide-hairline px-4">
              {timeline.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-fg-mute">
                      <span className="tnum">{shortDate(item.date)}</span>
                      <span>{item.kind}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px]">{item.title}</div>
                  </div>
                  <span
                    className={`tnum shrink-0 text-sm font-semibold ${
                      item.kind === '貯金' ? 'text-marine' : 'text-fg'
                    }`}
                  >
                    {yen(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
