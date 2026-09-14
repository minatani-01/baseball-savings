'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  SectionLabel,
  Sheet,
  StatusPill,
  Toggle,
  inputClass,
} from '@/components/ui'
import { IconCheck, IconClose, IconCopy, IconLink, IconTrash } from '@/components/icons'
import SharedGoals from '@/components/link/SharedGoals'
import { createClient } from '@/lib/supabase/client'
import { LINK_RESOURCE_META } from '@/lib/constants'
import { monthLabel, yen } from '@/lib/format'
import type {
  LinkMonthlyCompare,
  LinkResource,
  MarineLinkView,
  SharedGoalView,
} from '@/types'

/**
 * Marine Link（仕様書 13章・14章・16章 / Phase 4）。
 *
 *   Marine ID入力 -> 共有リクエスト -> 相手が承認 -> CONNECTED
 *
 * 権限は「自分が相手に何を見せるか」を自分で決める。相手が自分に何を見せているかは
 * 表示のみで、こちらからは変えられない（DB側の RLS も owner 本人しか更新できない）。
 */
export default function LinkClient({
  userId,
  marineId,
  initialLinks,
  month,
  myMonthTotal,
  compare,
  goals,
}: {
  userId: string
  marineId: string
  initialLinks: MarineLinkView[]
  month: string
  myMonthTotal: number
  compare: LinkMonthlyCompare[]
  goals: SharedGoalView[]
}) {
  const router = useRouter()
  const [links, setLinks] = useState(initialLinks)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [permissionTarget, setPermissionTarget] = useState<MarineLinkView | null>(null)

  const connected = links.filter((l) => l.status === 'accepted')
  const incoming = links.filter((l) => l.status === 'pending' && !l.outgoing)
  const outgoing = links.filter((l) => l.status === 'pending' && l.outgoing)

  const partnerName = (link: MarineLinkView) =>
    link.partner_name.trim() || link.partner_marine_id || '相手'

  /** 相手の名前とID。表示名が未設定なら Marine ID を主にして重複表示を避ける */
  const PartnerLine = ({ link }: { link: MarineLinkView }) => {
    const named = link.partner_name.trim().length > 0
    return (
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-medium ${named ? '' : 'tnum tracking-[0.08em]'}`}>
          {named ? link.partner_name : link.partner_marine_id || '相手'}
        </div>
        <div className="tnum text-[11px] text-fg-mute">
          {named ? link.partner_marine_id : '表示名は未設定です'}
        </div>
      </div>
    )
  }

  const copyMarineId = async () => {
    if (!marineId) return
    try {
      await navigator.clipboard.writeText(marineId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Marine ID', marineId)
    }
  }

  const request = async () => {
    const target = input.trim()
    if (!target) return
    setBusy(true)
    setError(null)
    setSent(false)
    const supabase = createClient()
    const { error } = await supabase.rpc('request_marine_link', { target_marine_id: target })
    setBusy(false)
    if (error) {
      // RPC 側で日本語のメッセージを投げているのでそのまま出す
      setError(error.message)
      return
    }
    setInput('')
    setSent(true)
    router.refresh()
  }

  const respond = async (link: MarineLinkView, status: 'accepted' | 'rejected') => {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('marine_links').update({ status }).eq('id', link.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    router.refresh()
  }

  const disconnect = async (link: MarineLinkView, confirmText: string) => {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('marine_links').delete().eq('id', link.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setLinks((prev) => prev.filter((l) => l.id !== link.id))
    setPermissionTarget(null)
    router.refresh()
  }

  const setPermission = async (link: MarineLinkView, resource: LinkResource, next: boolean) => {
    // 先に画面へ反映し、失敗したら戻す
    const apply = (value: boolean) => {
      const update = (l: MarineLinkView) =>
        l.id === link.id ? { ...l, shared: { ...l.shared, [resource]: value } } : l
      setLinks((prev) => prev.map(update))
      setPermissionTarget((prev) => (prev && prev.id === link.id ? update(prev) : prev))
    }
    apply(next)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('link_permissions')
      .update({ permission: next })
      .eq('marine_link_id', link.id)
      .eq('owner_id', userId)
      .eq('resource_type', resource)

    if (error) {
      apply(!next)
      setError(error.message)
      return
    }
    router.refresh()
  }

  const sharedCount = (link: MarineLinkView) =>
    LINK_RESOURCE_META.filter((r) => link.shared[r.id]).length

  return (
    <div className="flex flex-col gap-6">
      {/* 自分の Marine ID */}
      <div>
        <SectionLabel>あなたの Marine ID</SectionLabel>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="tnum text-2xl font-semibold tracking-[0.16em] text-marine">
                {marineId || '------'}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
                このIDを相手に伝えると、相手から接続をリクエストしてもらえます。
              </p>
            </div>
            <button
              type="button"
              onClick={copyMarineId}
              disabled={!marineId}
              aria-label="Marine IDをコピー"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-fg-mute transition-colors hover:border-marine/50 hover:text-marine disabled:opacity-40"
            >
              {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            </button>
          </div>
        </Card>
      </div>

      {/* 接続をリクエスト */}
      <div>
        <SectionLabel>接続をリクエスト</SectionLabel>
        <Card>
          <Field label="相手の Marine ID" hint="MW-XXXXXX">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value.toUpperCase())
                setSent(false)
                setError(null)
              }}
              placeholder="MW-XXXXXX"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${inputClass} tnum tracking-[0.12em]`}
            />
          </Field>
          {sent ? (
            <p className="mt-3 text-[13px] text-teal">
              リクエストを送りました。相手が承認すると接続されます。
            </p>
          ) : null}
          <Button
            variant="primary"
            full
            className="mt-3"
            onClick={request}
            disabled={busy || !input.trim()}
          >
            <IconLink size={17} />
            {busy ? '送信中' : 'リクエストを送る'}
          </Button>
        </Card>
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {/* 受信したリクエスト */}
      {incoming.length > 0 ? (
        <div>
          <SectionLabel>届いているリクエスト</SectionLabel>
          <div className="flex flex-col gap-2">
            {incoming.map((link) => (
              <Card key={link.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={partnerName(link)} />
                  <PartnerLine link={link} />
                  <StatusPill tone="warn">承認待ち</StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => respond(link, 'rejected')} disabled={busy}>
                    <IconClose size={16} />
                    拒否
                  </Button>
                  <Button variant="primary" onClick={() => respond(link, 'accepted')} disabled={busy}>
                    <IconCheck size={16} />
                    承認
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 送信したリクエスト */}
      {outgoing.length > 0 ? (
        <div>
          <SectionLabel>承認待ち</SectionLabel>
          <div className="flex flex-col gap-2">
            {outgoing.map((link) => (
              <Card key={link.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={partnerName(link)} />
                  <PartnerLine link={link} />
                  <button
                    type="button"
                    onClick={() => disconnect(link, 'この接続リクエストを取り消しますか？')}
                    disabled={busy}
                    className="text-[12px] text-fg-mute transition-colors hover:text-danger disabled:opacity-40"
                  >
                    取り消す
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 接続済み */}
      <div>
        <SectionLabel>接続済み</SectionLabel>
        {connected.length === 0 ? (
          <EmptyState
            title="まだ接続していません"
            description="相手の Marine ID を入力してリクエストを送るか、あなたの Marine ID を相手に伝えてください。"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {connected.map((link) => (
              <Card key={link.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={partnerName(link)} selected />
                  <PartnerLine link={link} />
                  <StatusPill tone="done">Connected</StatusPill>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-[11px] text-fg-mute">
                    公開中 {sharedCount(link)} / {LINK_RESOURCE_META.length} 項目
                  </p>
                  <button
                    type="button"
                    onClick={() => setPermissionTarget(link)}
                    className="text-[12px] text-marine transition-colors hover:text-teal"
                  >
                    共有設定
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 共同貯金（仕様書 17章） */}
      <SharedGoals userId={userId} goals={goals} connected={connected} />

      {/* 月間比較（仕様書 16章） */}
      {compare.length > 0 ? (
        <div>
          <SectionLabel>{monthLabel(month)}の比較</SectionLabel>
          <Card>
            <div className="divide-hairline">
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-[13px]">あなた</span>
                <span className="tnum text-sm font-semibold">{yen(myMonthTotal)}</span>
              </div>
              {compare.map((row) => (
                <div key={row.partner_id} className="flex items-center justify-between gap-4 py-2">
                  <span className="truncate text-[13px]">{row.partner_name || '接続相手'}</span>
                  {row.partner_amount === null ? (
                    <span className="text-[11px] text-fg-mute">非公開</span>
                  ) : (
                    <span className="tnum text-sm font-semibold">{yen(row.partner_amount)}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3">
              <span className="eyebrow">Combined</span>
              <span className="tnum text-lg font-semibold text-marine">
                {yen(
                  myMonthTotal +
                    compare.reduce((sum, row) => sum + (row.partner_amount ?? 0), 0)
                )}
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-mute">
              合計は表示上のものです。入金はそれぞれ自分のワンバンクへ行います（仕様書16章）。
            </p>
          </Card>
        </div>
      ) : null}

      {/* 共有設定 */}
      {permissionTarget ? (
        <Sheet
          title={`${partnerName(permissionTarget)} との共有設定`}
          onClose={() => setPermissionTarget(null)}
        >
          <p className="mb-4 text-[11px] leading-relaxed text-fg-mute">
            あなたのデータのうち、相手に見せるものを選びます。相手からは閲覧のみで、
            書き換えはできません。試合結果は全ユーザー共通のデータなので、常に共有されます。
          </p>

          <div className="divide-hairline">
            {LINK_RESOURCE_META.map((resource) => (
              <Toggle
                key={resource.id}
                checked={permissionTarget.shared[resource.id]}
                onChange={(next) => setPermission(permissionTarget, resource.id, next)}
                label={resource.label}
                hint={resource.hint}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="eyebrow mb-2">相手があなたに公開しているもの</p>
            <div className="flex flex-wrap gap-1.5">
              {LINK_RESOURCE_META.filter((r) => permissionTarget.received[r.id]).length === 0 ? (
                <p className="text-[12px] text-fg-mute">なし</p>
              ) : (
                LINK_RESOURCE_META.filter((r) => permissionTarget.received[r.id]).map((r) => (
                  <span
                    key={r.id}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-dim"
                  >
                    {r.label}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <Button
              variant="danger"
              full
              disabled={busy}
              onClick={() =>
                disconnect(
                  permissionTarget,
                  `${partnerName(permissionTarget)} との接続を解除しますか？\n\n共有は双方向に停止します。再接続するには、もう一度リクエストと承認が必要です。`
                )
              }
            >
              <IconTrash size={17} />
              接続を解除
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
