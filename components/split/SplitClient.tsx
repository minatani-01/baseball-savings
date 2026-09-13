'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Amount,
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconFrame,
  PillTabs,
  ProgressBar,
  SectionLabel,
  Segmented,
} from '@/components/ui'
import { IconChevronRight, IconEdit, IconPlus, IconTrash, IconUsers } from '@/components/icons'
import CategoryIcon from '@/components/CategoryIcon'
import { CopyAmountButton, OpenAppButton } from '@/components/HandoffActions'
import SplitSheet from '@/components/split/SplitSheet'
import { createClient } from '@/lib/supabase/client'
import { distributeEqual, simplifyDebts } from '@/lib/warikan'
import { shortDate, yen } from '@/lib/format'
import { categoryLabel } from '@/lib/constants'
import type { Share, SortOrder, SplitFilter, SplitMember, SplitRecord } from '@/types'

function sharesOf(record: SplitRecord, fallbackNames: string[]): Share[] {
  if (record.shares && record.shares.length > 0) return record.shares
  const names = fallbackNames.slice(0, Math.max(2, record.member_count))
  const burdens = distributeEqual(record.amount, names.length)
  return names.map((m, i) => ({ member: m, value: null, burden: burdens[i] }))
}

export default function SplitClient({
  userId,
  records,
  members,
}: {
  userId: string
  records: SplitRecord[]
  members: SplitMember[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<SplitFilter>('unpaid')
  const [sort, setSort] = useState<SortOrder>('desc')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SplitRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const memberNames = useMemo(() => members.map((m) => m.name), [members])
  const unpaid = useMemo(() => records.filter((r) => r.status === 'unpaid'), [records])
  const paid = useMemo(() => records.filter((r) => r.status === 'paid'), [records])

  const { paidTotals, transfers, unpaidTotal, settledTotal, grandTotal } = useMemo(() => {
    const paidMap = new Map<string, number>(memberNames.map((m) => [m, 0]))
    const burdenMap = new Map<string, number>(memberNames.map((m) => [m, 0]))

    for (const record of unpaid) {
      paidMap.set(record.payer, (paidMap.get(record.payer) ?? 0) + record.amount)
      for (const share of sharesOf(record, memberNames)) {
        burdenMap.set(share.member, (burdenMap.get(share.member) ?? 0) + share.burden)
      }
    }

    const names = new Set([...memberNames, ...paidMap.keys(), ...burdenMap.keys()])
    const balances = [...names].map((member) => ({
      member,
      balance: (paidMap.get(member) ?? 0) - (burdenMap.get(member) ?? 0),
    }))

    return {
      paidTotals: paidMap,
      transfers: simplifyDebts(balances),
      unpaidTotal: unpaid.reduce((sum, r) => sum + r.amount, 0),
      settledTotal: paid.reduce((sum, r) => sum + r.amount, 0),
      grandTotal: records.reduce((sum, r) => sum + r.amount, 0),
    }
  }, [unpaid, paid, records, memberNames])

  const visible = useMemo(() => {
    const base = filter === 'unpaid' ? unpaid : filter === 'paid' ? paid : records
    return [...base].sort((a, b) => {
      const diff = b.date.localeCompare(a.date)
      return sort === 'desc' ? diff : -diff
    })
  }, [records, unpaid, paid, filter, sort])

  const toggleStatus = async (record: SplitRecord) => {
    setBusy(true)
    const supabase = createClient()
    await supabase
      .from('records')
      .update({ status: record.status === 'unpaid' ? 'paid' : 'unpaid' })
      .eq('id', record.id)
    setBusy(false)
    router.refresh()
  }

  const remove = async (record: SplitRecord) => {
    if (!window.confirm(`「${record.content}」を削除しますか？`)) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from('records').delete().eq('id', record.id)
    setBusy(false)
    router.refresh()
  }

  const settleAll = async () => {
    if (unpaid.length === 0) return
    if (!window.confirm(`未精算 ${unpaid.length} 件をすべて精算済みにしますか？`)) return
    setBusy(true)
    const supabase = createClient()
    await supabase
      .from('records')
      .update({ status: 'paid' })
      .in(
        'id',
        unpaid.map((r) => r.id)
      )
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 未精算サマリー */}
      <Card className="glow">
        <div className="flex items-start gap-3">
          <IconFrame tone="marine">
            <IconUsers size={17} />
          </IconFrame>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">未精算の合計</div>
            <div className="mt-1.5">
              <Amount value={unpaidTotal} size="xl" tone="marine" />
            </div>
            <p className="mt-1 text-xs text-fg-mute">{unpaid.length}件の割り勘が未精算です</p>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <ProgressBar
            value={settledTotal}
            max={grandTotal}
            label="支払い状況"
            caption={`${yen(settledTotal)} / ${yen(grandTotal)}`}
          />
        </div>
      </Card>

      {/* メンバー */}
      <div>
        <SectionLabel
          action={
            <Link
              href="/split/members"
              className="inline-flex items-center gap-1 text-[12px] text-fg-dim hover:text-marine"
            >
              編集
              <IconChevronRight size={13} />
            </Link>
          }
        >
          メンバー
        </SectionLabel>
        <Card>
          {members.length === 0 ? (
            <p className="text-[13px] text-fg-mute">
              メンバーが未登録です。「編集」から追加してください。
            </p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {members.map((m) => (
                <div key={m.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <Avatar name={m.name} selected={m.is_self} />
                  <span className="w-full truncate text-center text-[11px] text-fg-dim">
                    {m.is_self ? 'あなた' : m.name}
                  </span>
                  <span className="tnum text-center text-[11px] text-fg-mute">
                    {yen(paidTotals.get(m.name) ?? 0)}
                  </span>
                </div>
              ))}
              <Link
                href="/split/members"
                aria-label="メンバーを追加"
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line text-fg-mute">
                  <IconPlus size={17} />
                </span>
                <span className="text-[11px] text-fg-mute">追加</span>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* 精算 */}
      <div>
        <SectionLabel>精算</SectionLabel>
        {transfers.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-teal">精算は不要です</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {transfers.map((t) => (
              <Card key={`${t.from}-${t.to}-${t.amount}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <Avatar name={t.from} size={26} />
                    <span className="truncate">{t.from}</span>
                    <span className="text-fg-mute">→</span>
                    <Avatar name={t.to} size={26} />
                    <span className="truncate">{t.to}</span>
                  </div>
                  <Amount value={t.amount} size="md" tone="marine" />
                </div>
                <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
                  <CopyAmountButton amount={t.amount} label={`${yen(t.amount)}をコピー`} />
                  <OpenAppButton app="paypay" />
                </div>
              </Card>
            ))}
            <Button full onClick={settleAll} disabled={busy}>
              未精算をすべて精算済みにする
            </Button>
          </div>
        )}
      </div>

      {/* 支出一覧 */}
      <div>
        <SectionLabel
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setSheetOpen(true)
              }}
              className="inline-flex items-center gap-1.5 text-[12px] text-marine"
            >
              <IconPlus size={15} />
              支出を登録
            </button>
          }
        >
          支出一覧
        </SectionLabel>

        <div className="mb-3">
          <PillTabs
            value={filter}
            options={[
              { id: 'unpaid', label: `未精算 (${unpaid.length})` },
              { id: 'all', label: 'すべて' },
              { id: 'paid', label: `完了 (${paid.length})` },
            ]}
            onChange={setFilter}
          />
        </div>

        <div className="mb-3">
          <Segmented
            value={sort}
            options={[
              { id: 'desc', label: '新しい順' },
              { id: 'asc', label: '古い順' },
            ]}
            onChange={setSort}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="記録がありません"
            description="観戦チケットや飲食などの立替を登録すると、精算額が自動で計算されます。"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((record) => (
              <Card key={record.id} className="!p-3.5">
                <div className="flex items-start gap-3">
                  <IconFrame>
                    <CategoryIcon category={record.category} />
                  </IconFrame>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{record.content}</div>
                    <div className="mt-1 truncate text-[11px] text-fg-mute">
                      <span className="tnum">{shortDate(record.date)}</span>
                      {' / '}
                      {categoryLabel(record.category)}
                      {' / '}
                      {record.payer} が立替
                    </div>
                  </div>

                  <Amount value={record.amount} size="sm" />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <div className="flex min-w-0 items-center gap-1">
                    {sharesOf(record, memberNames)
                      .slice(0, 4)
                      .map((s) => (
                        <Avatar key={s.member} name={s.member} size={22} />
                      ))}
                    {record.member_count > 4 ? (
                      <span className="text-[11px] text-fg-mute">+{record.member_count - 4}</span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleStatus(record)}
                      disabled={busy}
                      className={`h-9 rounded-lg border px-3 text-[11px] whitespace-nowrap transition-colors disabled:opacity-40 ${
                        record.status === 'unpaid'
                          ? 'border-line text-fg-mute hover:border-marine/50 hover:text-marine'
                          : 'border-teal/40 text-teal'
                      }`}
                    >
                      {record.status === 'unpaid' ? '精算する' : '完了'}
                    </button>
                    <IconButton
                      label="編集"
                      onClick={() => {
                        setEditing(record)
                        setSheetOpen(true)
                      }}
                    >
                      <IconEdit size={15} />
                    </IconButton>
                    <IconButton
                      label="削除"
                      onClick={() => remove(record)}
                      className="hover:border-danger/50 hover:text-danger"
                    >
                      <IconTrash size={15} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {sheetOpen ? (
        <SplitSheet
          record={editing}
          members={members}
          userId={userId}
          onClose={() => {
            setSheetOpen(false)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
