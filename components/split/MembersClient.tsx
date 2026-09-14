'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  SectionLabel,
  inputClass,
} from '@/components/ui'
import { IconCheck, IconLink, IconPlus, IconTrash } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import type { SplitMember } from '@/types'

export default function MembersClient({
  userId,
  members,
}: {
  userId: string
  members: SplitMember[]
}) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 編集中の Marine ID（メンバーID -> 入力値）。保存するまでDBには書かない
  const [draftIds, setDraftIds] = useState<Record<string, string>>({})
  const [savedId, setSavedId] = useState<string | null>(null)

  const draftOf = (member: SplitMember) => draftIds[member.id] ?? member.marine_id ?? ''

  const setJoin = async (member: SplitMember, field: 'join_split' | 'join_saving', next: boolean) => {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('split_members')
      .update({ [field]: next })
      .eq('id', member.id)
    setBusy(false)
    if (error) {
      setError('参加設定の保存に失敗しました')
      return
    }
    router.refresh()
  }

  const saveMarineId = async (member: SplitMember) => {
    const raw = draftOf(member).trim().toUpperCase()
    // 空欄は「登録しない」。書式が違うものは DB の CHECK に弾かれる前にここで止める
    if (raw !== '' && !/^MW-[0-9A-Z]{6}$/.test(raw)) {
      setError('Marine ID は MW- に続く6文字で入力してください')
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('split_members')
      .update({ marine_id: raw === '' ? null : raw })
      .eq('id', member.id)
    setBusy(false)
    if (error) {
      setError('Marine ID の保存に失敗しました')
      return
    }
    setSavedId(member.id)
    setTimeout(() => setSavedId((prev) => (prev === member.id ? null : prev)), 1800)
    router.refresh()
  }

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    if (members.some((m) => m.name === name)) {
      setError('同じ名前のメンバーがすでにいます')
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('split_members').insert({
      user_id: userId,
      name,
      sort_order: members.length,
    })
    setBusy(false)
    if (error) {
      setError('追加に失敗しました')
      return
    }
    setNewName('')
    router.refresh()
  }

  const markSelf = async (member: SplitMember) => {
    setBusy(true)
    const supabase = createClient()
    // 「あなた」は1人だけ。まず全員を解除してから対象だけ立てる
    await supabase.from('split_members').update({ is_self: false }).eq('user_id', userId)
    if (!member.is_self) {
      await supabase.from('split_members').update({ is_self: true }).eq('id', member.id)
    }
    setBusy(false)
    router.refresh()
  }

  const remove = async (member: SplitMember) => {
    if (
      !window.confirm(
        `${member.name} を削除しますか？\n過去の記録に保存された名前と金額はそのまま残ります。`
      )
    ) {
      return
    }
    setBusy(true)
    const supabase = createClient()
    await supabase.from('split_members').delete().eq('id', member.id)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] leading-relaxed text-fg-mute">
        Marine Wallet を一緒に使う人をここで管理します。人数の上限はありません。
        名前を変更・削除しても、過去の記録に保存された名前と負担額は変わりません。
        {'\n'}
        相手が Marine Wallet を使っているなら Marine ID を登録し、参加する機能を選んでください。
        割り勘は、Marine Link で接続済みかつ Marine ID が一致するメンバーが参加している記録だけが
        相手から見えます（参加していない記録は見えません。相手が書き換えることもできません）。
        貯金は、参加しているメンバーの確定済みの積立額が総累計貯金額に合算されます。
      </p>

      <div>
        <SectionLabel>Members</SectionLabel>
        {members.length === 0 ? (
          <EmptyState title="メンバーがいません" description="下のフォームから追加してください。" />
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <Card key={member.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} selected={member.is_self} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{member.name}</div>
                    {member.is_self ? (
                      <div className="text-[11px] text-marine">あなた</div>
                    ) : null}
                  </div>
                  <IconButton
                    label={member.is_self ? '「あなた」を解除' : '「あなた」に設定'}
                    onClick={() => markSelf(member)}
                    disabled={busy}
                    className={member.is_self ? 'border-marine/60 text-marine' : ''}
                  >
                    <IconCheck size={15} />
                  </IconButton>
                  <IconButton
                    label="削除"
                    onClick={() => remove(member)}
                    disabled={busy}
                    className="hover:border-danger/50 hover:text-danger"
                  >
                    <IconTrash size={15} />
                  </IconButton>
                </div>

                <div className="mt-2.5 border-t border-line pt-2.5">
                  {/* Marine ID。登録するとこの人が参加した割り勘が相手から見えるようになる */}
                  {member.is_self ? null : (
                    <div className="flex items-center gap-2">
                      <IconLink size={15} className="shrink-0 text-fg-mute" />
                      <input
                        type="text"
                        value={draftOf(member)}
                        onChange={(e) => {
                          setDraftIds((prev) => ({
                            ...prev,
                            [member.id]: e.target.value.toUpperCase(),
                          }))
                          setError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveMarineId(member)
                        }}
                        placeholder="Marine ID（未登録）"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className={`${inputClass} tnum !py-1.5 text-[13px] tracking-[0.1em]`}
                      />
                      <Button
                        onClick={() => saveMarineId(member)}
                        disabled={busy || draftOf(member) === (member.marine_id ?? '')}
                        className="shrink-0 !min-h-[36px] !px-3 text-[12px]"
                      >
                        {savedId === member.id ? <IconCheck size={15} /> : '保存'}
                      </Button>
                    </div>
                  )}

                  {/* 参加する機能 */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-fg-mute">参加</span>
                    <Checkbox
                      checked={member.join_split}
                      onChange={(next) => setJoin(member, 'join_split', next)}
                      disabled={busy}
                      label="割り勘"
                    />
                    <Checkbox
                      checked={member.join_saving}
                      onChange={(next) => setJoin(member, 'join_saving', next)}
                      disabled={busy}
                      label="貯金"
                    />
                  </div>

                  {member.join_saving && !member.is_self && !member.marine_id ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-warn">
                      貯金に参加するには Marine ID の登録が必要です。
                    </p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>メンバーを追加</SectionLabel>
        <Card>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
              }}
              placeholder="名前"
              className={inputClass}
            />
            <Button onClick={add} disabled={busy || !newName.trim()} className="shrink-0">
              <IconPlus size={16} />
              追加
            </Button>
          </div>
          {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
        </Card>
      </div>
    </div>
  )
}
