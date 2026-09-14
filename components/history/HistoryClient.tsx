'use client'

import { useMemo } from 'react'
import { Card, EmptyState, IconFrame, SectionLabel } from '@/components/ui'
import { IconBaseball, IconSpark } from '@/components/icons'
import CategoryIcon from '@/components/CategoryIcon'
import { shortDate, yen } from '@/lib/format'
import { categoryLabel, opponentLabel, resultLabel } from '@/lib/constants'
import type { ExpenseCategory, SavingEntryRow, SplitRecord } from '@/types'

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

/**
 * 取引履歴。貯金と割り勘を1本の時系列にまとめて出す。
 *
 * 貯金推移のグラフはホームへ移したので、この画面は取引だけを持つ。
 * 同じ一覧を2か所に置かない（ホームは「いまどうなっているか」、ここは「何があったか」）。
 */
export default function HistoryClient({
  entries,
  records,
}: {
  entries: SavingEntryRow[]
  records: SplitRecord[]
}) {
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>最近の取引</SectionLabel>
        {timeline.length === 0 ? (
          <EmptyState title="まだ記録がありません" />
        ) : (
          <Card padded={false}>
            <div className="divide-hairline px-4">
              {timeline.map((item) => (
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
        )}
      </div>
    </div>
  )
}
