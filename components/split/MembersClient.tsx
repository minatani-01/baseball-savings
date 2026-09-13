'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { IconChevronRight } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import type { MemberSettings } from '@/types'

export default function MembersClient({
  userId,
  settings,
}: {
  userId: string
  settings: MemberSettings
}) {
  const router = useRouter()
  const [memberA, setMemberA] = useState(settings.member_a)
  const [memberB, setMemberB] = useState(settings.member_b)
  const [memberC, setMemberC] = useState(settings.member_c ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!memberA.trim() || !memberB.trim()) {
      setError('メンバーAとBの名前は必須です')
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: userId,
        member_a: memberA.trim(),
        member_b: memberB.trim(),
        member_c: memberC.trim() || null,
      },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    if (error) {
      setError('保存に失敗しました')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/split"
          className="inline-flex items-center gap-1 text-[12px] text-fg-mute hover:text-marine"
        >
          <IconChevronRight size={13} className="rotate-180" />
          割り勘へ戻る
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-wide">メンバー管理</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-mute">
          割り勘に参加するメンバーの表示名です。名前を変更しても過去の記録に保存された名前は変わりません。
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <Field label="メンバーA">
            <input
              type="text"
              value={memberA}
              onChange={(e) => {
                setMemberA(e.target.value)
                setSaved(false)
              }}
              className={inputClass}
            />
          </Field>
          <Field label="メンバーB">
            <input
              type="text"
              value={memberB}
              onChange={(e) => {
                setMemberB(e.target.value)
                setSaved(false)
              }}
              className={inputClass}
            />
          </Field>
          <Field label="メンバーC" hint="3人で割り勘する場合のみ">
            <input
              type="text"
              value={memberC}
              onChange={(e) => {
                setMemberC(e.target.value)
                setSaved(false)
              }}
              placeholder="未設定"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        {saved ? <p className="text-[13px] text-teal">保存しました</p> : null}
        <Button variant="primary" full onClick={save} disabled={saving}>
          {saving ? '保存中' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
