import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Amount, Card, EmptyState, SectionLabel, StatusPill } from '@/components/ui'
import { IconChevronRight, IconSavings, IconSplit } from '@/components/icons'
import {
  getMemberSettings,
  getMonthlySavings,
  getSavingEntries,
  getSessionUser,
  getSplitRecords,
} from '@/lib/queries'
import { currentMonth, isMonthClosed, monthLabel, monthLabelEn, shortDate, yen } from '@/lib/format'
import { MONTHLY_STATUS_LABEL, opponentLabel, resultLabel } from '@/lib/constants'
import type { MonthlyStatus } from '@/types'

type Activity = {
  key: string
  date: string
  title: string
  detail: string
  amount: number
  kind: 'saving' | 'split'
}

const STATUS_TONE: Record<MonthlyStatus, 'neutral' | 'marine' | 'warn' | 'done'> = {
  calculating: 'neutral',
  ready: 'marine',
  deposit_pending: 'warn',
  deposited: 'done',
}

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, monthlySavings, records, settings] = await Promise.all([
    getSavingEntries(user.id),
    getMonthlySavings(user.id),
    getSplitRecords(user.id),
    getMemberSettings(user.id),
  ])

  const month = currentMonth()
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const monthEntries = entries.filter((e) => e.month === month)
  const monthTotal = monthEntries.reduce((sum, e) => sum + e.amount, 0)
  const unpaid = records.filter((r) => r.status === 'unpaid')
  const unpaidTotal = unpaid.reduce((sum, r) => sum + r.amount, 0)

  const monthly = monthlySavings.find((m) => m.month === month) ?? null
  const status: MonthlyStatus = monthly?.status ?? 'calculating'

  // 前月が未入金のまま残っていれば、ホームで先に促す
  const pendingMonth = monthlySavings.find(
    (m) => m.status !== 'deposited' && isMonthClosed(m.month)
  )
  const unconfirmedClosedMonth = [...new Set(entries.map((e) => e.month))]
    .filter((m) => isMonthClosed(m))
    .sort((a, b) => b.localeCompare(a))
    .find((m) => !monthlySavings.some((row) => row.month === m))

  const activities: Activity[] = [
    ...entries.slice(0, 10).map<Activity>((entry) => ({
      key: `saving-${entry.id}`,
      date: entry.entry_date,
      title: `${resultLabel(entry.game.result, entry.game.is_sayonara)} vs ${opponentLabel(entry.game.opponent)}`,
      detail: '貯金',
      amount: entry.amount,
      kind: 'saving',
    })),
    ...records.slice(0, 10).map<Activity>((record) => ({
      key: `split-${record.id}`,
      date: record.date,
      title: record.content,
      detail: `割り勘 / ${record.payer} 立替`,
      amount: record.amount,
      kind: 'split',
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <Card className="glow">
        <div className="eyebrow">Total lotte savings</div>
        <div className="mt-2">
          <Amount value={total} size="xl" tone="marine" />
        </div>
        <p className="mt-2 text-xs text-fg-mute">{entries.length} Games / 累計</p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute uppercase">今月の積立予定</div>
            <div className="tnum mt-1 text-lg font-semibold">{yen(monthTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute uppercase">未精算</div>
            <div className="tnum mt-1 text-lg font-semibold">{yen(unpaidTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute uppercase">今月の試合</div>
            <div className="tnum mt-1 text-lg font-semibold">{monthEntries.length} Games</div>
          </div>
        </div>
      </Card>

      {/* 月末の入金誘導 */}
      {pendingMonth || unconfirmedClosedMonth ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">
                {monthLabelEn(pendingMonth?.month ?? unconfirmedClosedMonth!)}
              </div>
              <p className="mt-2 text-sm">
                {pendingMonth
                  ? `${monthLabel(pendingMonth.month)}分のワンバンク入金が完了していません`
                  : `${monthLabel(unconfirmedClosedMonth!)}分の金額がまだ確定していません`}
              </p>
            </div>
            {pendingMonth ? (
              <StatusPill tone={STATUS_TONE[pendingMonth.status]}>
                {MONTHLY_STATUS_LABEL[pendingMonth.status]}
              </StatusPill>
            ) : null}
          </div>
          <Link
            href="/savings"
            className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-marine px-4 text-sm font-semibold text-ink transition-colors hover:bg-teal"
          >
            月末の積立状況を見る
          </Link>
        </Card>
      ) : null}

      {/* CTA */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/savings"
          className="glass flex min-h-[84px] flex-col justify-between rounded-2xl p-4 transition-colors hover:border-marine/50"
        >
          <IconSavings size={20} className="text-marine" />
          <span className="text-[13px]">
            今月の積立状況
            <IconChevronRight size={13} className="ml-1 inline align-middle text-fg-mute" />
          </span>
        </Link>
        <Link
          href="/split"
          className="glass flex min-h-[84px] flex-col justify-between rounded-2xl p-4 transition-colors hover:border-marine/50"
        >
          <IconSplit size={20} className="text-marine" />
          <span className="text-[13px]">
            割り勘を作成
            <IconChevronRight size={13} className="ml-1 inline align-middle text-fg-mute" />
          </span>
        </Link>
      </div>

      {/* 当月ステータス */}
      <div>
        <SectionLabel>{monthLabelEn(month)}</SectionLabel>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-fg-dim">今月の積立予定額</p>
              <div className="mt-1">
                <Amount value={monthTotal} size="md" tone="marine" />
              </div>
            </div>
            <StatusPill tone={STATUS_TONE[status]}>{MONTHLY_STATUS_LABEL[status]}</StatusPill>
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-mute">
            ワンバンクへの入金は月末に1回だけ行います。Marine Wallet
            は金額の記録と誘導のみを行い、資金は保有・移動しません。
          </p>
        </Card>
      </div>

      {/* 最近のアクティビティ */}
      <div>
        <SectionLabel
          action={
            <Link href="/history" className="text-[12px] text-fg-dim hover:text-marine">
              すべて見る
            </Link>
          }
        >
          Recent activity
        </SectionLabel>

        {activities.length === 0 ? (
          <EmptyState
            title="まだ記録がありません"
            description={`貯金タブから試合を記録するか、割り勘タブで支出を登録してください。（メンバー: ${settings.member_a} / ${settings.member_b}）`}
          />
        ) : (
          <Card padded={false}>
            <div className="divide-hairline px-4">
              {activities.map((activity) => (
                <div key={activity.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-fg-mute">
                      <span className="tnum">{shortDate(activity.date)}</span>
                      <span>{activity.detail}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px]">{activity.title}</div>
                  </div>
                  <span
                    className={`tnum shrink-0 text-sm font-semibold ${
                      activity.kind === 'saving' ? 'text-marine' : 'text-fg'
                    }`}
                  >
                    {yen(activity.amount)}
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
