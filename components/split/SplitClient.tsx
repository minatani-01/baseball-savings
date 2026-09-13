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
  SectionLabel,
  Segmented,
  StatusPill,
} from '@/components/ui'
import { IconChevronRight, IconEdit, IconPlus, IconTrash, IconUser } from '@/components/icons'
import { CopyAmountButton, OpenAppButton } from '@/components/HandoffActions'
import SplitSheet from '@/components/split/SplitSheet'
import { createClient } from '@/lib/supabase/client'
import { distributeEqual, simplifyDebts } from '@/lib/warikan'
import { shortDate, yen } from '@/lib/format'
import { categoryLabel } from '@/lib/constants'
import type { FilterStatus, MemberSettings, Share, SortOrder, SplitRecord } from '@/types'

function sharesOf(record: SplitRecord, settings: MemberSettings): Share[] {
  if (record.shares && record.shares.length > 0) return record.shares
  const members = [settings.member_a, settings.member_b]
  const burdens = distributeEqual(record.amount, members.length)
  return members.map((m, i) => ({ member: m, value: null, burden: burdens[i] }))
}

export default function SplitClient({
  userId,
  records,
  settings,
}: {
  userId: string
  records: SplitRecord[]
  settings: MemberSettings
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortOrder>('desc')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SplitRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const memberNames = useMemo(() => {
    const names = [settings.member_a, settings.member_b]
    if (settings.member_c?.trim()) names.push(settings.member_c.trim())
    return names
  }, [settings])

  const unpaid = useMemo(() => records.filter((r) => r.status === 'unpaid'), [records])

  const { paidTotals, transfers, unpaidTotal } = useMemo(() => {
    const paid = new Map<string, number>(memberNames.map((m) => [m, 0]))
    const burden = new Map<string, number>(memberNames.map((m) => [m, 0]))

    for (const record of unpaid) {
      paid.set(record.payer, (paid.get(record.payer) ?? 0) + record.amount)
      for (const share of sharesOf(record, settings)) {
        burden.set(share.member, (burden.get(share.member) ?? 0) + share.burden)
      }
    }

    const balances = memberNames.map((member) => ({
      member,
      balance: (paid.get(member) ?? 0) - (burden.get(member) ?? 0),
    }))

    return {
      paidTotals: paid,
      transfers: simplifyDebts(balances),
      unpaidTotal: unpaid.reduce((sum, r) => sum + r.amount, 0),
    }
  }, [unpaid, memberNames, settings])

  const visible = useMemo(() => {
    const filtered = filter === 'unpaid' ? unpaid : records
    return [...filtered].sort((a, b) => {
      const diff = b.date.localeCompare(a.date)
      return sort === 'desc' ? diff : -diff
    })
  }, [records, unpaid, filter, sort])

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Unsettled</div>
            <div className="mt-2">
              <Amount value={unpaidTotal} size="xl" tone="marine" />
            </div>
            <p className="mt-2 text-xs text-fg-mute">{unpaid.length} 件の未精算</p>
          </div>
          <Link
            href="/split/members"
            className="inline-flex items-center gap-1 text-[12px] text-fg-dim hover:text-marine"
          >
            <IconUser size={15} />
            メンバー
            <IconChevronRight size={13} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-3">
          {memberNames.map((member) => (
            <div key={member} className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="truncate text-[11px] text-marine">{member}</div>
              <div className="mt-1 text-[10px] text-fg-mute">立替合計</div>
              <div className="tnum mt-0.5 text-lg font-semibold">
                {yen(paidTotals.get(member) ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 精算 */}
      <div>
        <SectionLabel>Settlement</SectionLabel>
        {transfers.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-teal">精算は不要です</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {transfers.map((t) => (
              <Card key={`${t.from}-${t.to}-${t.amount}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <span className="truncate">{t.from}</span>
                    <span className="mx-2 text-fg-mute">→</span>
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

      {/* 一覧 */}
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
          Records
        </SectionLabel>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <Segmented
              value={filter}
              options={[
                { id: 'all', label: 'すべて' },
                { id: 'unpaid', label: '未精算のみ' },
              ]}
              onChange={setFilter}
            />
          </div>
          <div className="flex-1">
            <Segmented
              value={sort}
              options={[
                { id: 'desc', label: '新しい順' },
                { id: 'asc', label: '古い順' },
              ]}
              onChange={setSort}
            />
          </div>
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-fg-mute">
                      <span className="tnum">{shortDate(record.date)}</span>
                      <span>{categoryLabel(record.category)}</span>
                      <StatusPill tone={record.status === 'unpaid' ? 'warn' : 'done'}>
                        {record.status === 'unpaid' ? 'unsettled' : 'settled'}
                      </StatusPill>
                    </div>
                    <div className="mt-1 truncate text-sm">{record.content}</div>
                    <p className="mt-1 truncate text-[11px] text-fg-mute">
                      {record.payer} が立替 / {record.member_count}人
                      {record.shares?.length
                        ? ` / ${record.shares.map((s) => `${s.member} ${yen(s.burden)}`).join('・')}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Amount value={record.amount} size="sm" />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleStatus(record)}
                        disabled={busy}
                        className="h-9 rounded-lg border border-line px-2.5 text-[11px] text-fg-mute transition-colors hover:border-marine/50 hover:text-marine disabled:opacity-40"
                      >
                        {record.status === 'unpaid' ? '精算済みにする' : '未精算に戻す'}
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {sheetOpen ? (
        <SplitSheet
          record={editing}
          settings={settings}
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
