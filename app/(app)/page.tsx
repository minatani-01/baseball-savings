import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Amount, Card, DeltaBadge, EmptyState, IconFrame, SectionLabel, StatusPill } from '@/components/ui'
import {
  IconBaseball,
  IconChevronRight,
  IconSpark,
  IconUsers,
  IconWallet,
} from '@/components/icons'
import CategoryIcon from '@/components/CategoryIcon'
import {
  getMonthlySavings,
  getSavingEntries,
  getSavingRules,
  getSessionUser,
  getSplitRecords,
} from '@/lib/queries'
import { monthOverMonth, streakDays } from '@/lib/insights'
import { currentMonth, isMonthClosed, monthLabel, shortDate, yen } from '@/lib/format'
import { MONTHLY_STATUS_LABEL, opponentLabel, resultLabel } from '@/lib/constants'
import type { ExpenseCategory, MonthlyStatus } from '@/types'

type Activity = {
  key: string
  date: string
  title: string
  caption: string
  amount: number
  kind: 'saving' | 'split'
  category?: ExpenseCategory
  isCustom?: boolean
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

  const [entries, monthlySavings, records, rules] = await Promise.all([
    getSavingEntries(user.id),
    getMonthlySavings(user.id),
    getSplitRecords(user.id),
    getSavingRules(user.id),
  ])

  const month = currentMonth()
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const monthEntries = entries.filter((e) => e.month === month)
  const monthTotal = monthEntries.reduce((sum, e) => sum + e.amount, 0)
  const unpaid = records.filter((r) => r.status === 'unpaid')
  const unpaidTotal = unpaid.reduce((sum, r) => sum + r.amount, 0)
  const delta = monthOverMonth(entries, month)
  const streak = streakDays(entries)

  const monthly = monthlySavings.find((m) => m.month === month) ?? null
  const status: MonthlyStatus = monthly?.status ?? 'calculating'

  // 締めが終わっているのに入金まで進んでいない月をホームで先に促す
  const pendingMonth = monthlySavings.find((m) => m.status !== 'deposited' && isMonthClosed(m.month))
  const unconfirmedClosedMonth = [...new Set(entries.map((e) => e.month))]
    .filter((m) => isMonthClosed(m))
    .sort((a, b) => b.localeCompare(a))
    .find((m) => !monthlySavings.some((row) => row.month === m))
  const alertMonth = pendingMonth?.month ?? unconfirmedClosedMonth ?? null

  const activities: Activity[] = [
    ...entries.slice(0, 10).map<Activity>((entry) => ({
      key: `saving-${entry.id}`,
      date: entry.entry_date,
      title: entry.game
        ? `${resultLabel(entry.game.result, entry.game.is_sayonara)} vs ${opponentLabel(entry.game.opponent)}`
        : entry.title,
      caption: entry.game ? '試合貯金' : 'カスタム貯金',
      amount: entry.amount,
      kind: 'saving',
      isCustom: entry.kind === 'custom',
    })),
    ...records.slice(0, 10).map<Activity>((record) => ({
      key: `split-${record.id}`,
      date: record.date,
      title: record.content,
      caption: `割り勘 / ${record.payer} が立替`,
      amount: record.amount,
      kind: 'split',
      category: record.category,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      {/* ヒーロー */}
      <div>
        <p className="text-[22px] leading-snug font-semibold tracking-wide">
          好きが、
          <br />
          未来をつくる。
        </p>
        <p className="mt-2 text-[10px] tracking-[0.28em] text-fg-mute uppercase">More than a game</p>
      </div>

      {/* 累計 */}
      <Card className="glow">
        <div className="eyebrow">累計貯金額</div>
        <div className="mt-2 flex items-baseline gap-3">
          <Amount value={total} size="xl" tone="marine" />
          <DeltaBadge percent={delta} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute">今月のつみたて額</div>
            <div className="tnum mt-1 text-lg font-semibold">{yen(monthTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute">目標金額</div>
            <div className="tnum mt-1 text-lg font-semibold text-marine">
              {rules.monthly_goal_amount > 0 ? yen(rules.monthly_goal_amount) : '未設定'}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wider text-fg-mute">継続日数</div>
            <div className="tnum mt-1 text-lg font-semibold">{streak}日</div>
          </div>
        </div>
      </Card>

      {/* 主要CTA */}
      <div className="flex flex-col gap-2">
        <Link
          href="/savings"
          prefetch={false}
          className="flex min-h-[54px] items-center justify-between gap-3 rounded-2xl bg-marine px-4 font-semibold text-ink shadow-[0_0_40px_-16px_rgba(34,211,238,0.9)] transition-colors hover:bg-teal"
        >
          <span className="flex items-center gap-2.5">
            <IconWallet size={19} />
            貯金する
          </span>
          <IconChevronRight size={18} />
        </Link>
        <Link
          href="/split"
          prefetch={false}
          className="glass flex min-h-[54px] items-center justify-between gap-3 rounded-2xl px-4 transition-colors hover:border-marine/50"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <IconUsers size={19} />
            割り勘を作成
          </span>
          <IconChevronRight size={18} />
        </Link>
      </div>

      {/* 未精算 */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <div className="text-[10px] tracking-wider text-fg-mute">未精算</div>
          <div className="tnum mt-1.5 text-xl font-semibold">{yen(unpaidTotal)}</div>
          <div className="mt-1 text-[11px] text-fg-mute">{unpaid.length}件</div>
        </Card>
        <Card>
          <div className="text-[10px] tracking-wider text-fg-mute">今月の試合</div>
          <div className="tnum mt-1.5 text-xl font-semibold">
            {monthEntries.filter((e) => e.game).length} Games
          </div>
          <div className="mt-1 text-[11px] text-fg-mute">{MONTHLY_STATUS_LABEL[status]}</div>
        </Card>
      </div>

      {/* 月末の入金誘導 */}
      {alertMonth ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">
              {pendingMonth
                ? `${monthLabel(pendingMonth.month)}分のワンバンク入金が完了していません`
                : `${monthLabel(alertMonth)}分の金額がまだ確定していません`}
            </p>
            {pendingMonth ? (
              <StatusPill tone={STATUS_TONE[pendingMonth.status]}>
                {MONTHLY_STATUS_LABEL[pendingMonth.status]}
              </StatusPill>
            ) : null}
          </div>
          <Link
            href="/savings"
            prefetch={false}
            className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-marine/60 px-4 text-sm font-medium text-marine transition-colors hover:bg-marine/10"
          >
            月末の積立状況を見る
          </Link>
        </Card>
      ) : null}

      {/* 最近のアクティビティ */}
      <div>
        <SectionLabel
          action={
            <Link
              href="/history"
              prefetch={false}
              className="text-[12px] text-fg-dim hover:text-marine"
            >
              すべて見る
            </Link>
          }
        >
          最近のアクティビティ
        </SectionLabel>

        {activities.length === 0 ? (
          <EmptyState
            title="まだ記録がありません"
            description="貯金タブから試合を登録するか、割り勘タブで支出を登録してください。"
          />
        ) : (
          <Card padded={false}>
            <div className="divide-hairline px-4">
              {activities.map((activity) => (
                <div key={activity.key} className="flex items-center gap-3 py-3">
                  <IconFrame tone={activity.kind === 'saving' ? 'marine' : 'default'}>
                    {activity.kind === 'saving' ? (
                      activity.isCustom ? (
                        <IconSpark size={16} />
                      ) : (
                        <IconBaseball size={16} />
                      )
                    ) : (
                      <CategoryIcon category={activity.category ?? 'other'} size={16} />
                    )}
                  </IconFrame>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{activity.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-mute">
                      <span className="tnum">{shortDate(activity.date)}</span>
                      <span className="truncate">{activity.caption}</span>
                    </div>
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
