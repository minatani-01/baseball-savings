'use client'

import { useState } from 'react'
import { Card, PillTabs } from '@/components/ui'
import CumulativeChart, { type ChartPoint } from '@/components/charts/CumulativeChart'

type Unit = 'month' | 'year'

/**
 * ホームの貯金推移。当年の月単位と、年単位を切り替える。
 *
 * 日ごとの点をそのまま並べると線が細かく揺れて、どの時点でいくらなのかが読めない。
 * 見たい粒度は「今年どう積み上がっているか」と「年ごとにどれだけ増えたか」の2つなので、
 * その2つだけを出す。どちらも入金済みの月だけを積む（累計貯金額と同じ定義）。
 */
export default function SavingsTrend({
  year,
  monthly,
  yearly,
}: {
  year: number
  monthly: ChartPoint[]
  yearly: ChartPoint[]
}) {
  const [unit, setUnit] = useState<Unit>('month')
  const points = unit === 'month' ? monthly : yearly

  return (
    <div className="flex flex-col gap-2">
      <PillTabs
        value={unit}
        options={[
          { id: 'month', label: `${year}年の月別` },
          { id: 'year', label: '年別' },
        ]}
        onChange={setUnit}
      />
      <Card>
        <CumulativeChart
          points={points}
          emptyLabel={
            unit === 'month'
              ? `${year}年に入金した月がまだありません`
              : '入金した年がまだありません'
          }
          caption={
            unit === 'month'
              ? `${year}年に入金した月を、古い順に積み上げた額です。確定しただけの月はまだ入りません。`
              : '入金した額を年ごとに積み上げた、全期間の累計です。'
          }
        />
      </Card>
    </div>
  )
}
