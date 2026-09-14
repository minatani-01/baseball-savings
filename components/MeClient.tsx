'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Row, SectionLabel, inputClass } from '@/components/ui'
import AvatarPicker from '@/components/AvatarPicker'
import {
  IconBell,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconLink,
  IconLogout,
  IconUsers,
} from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import { rejectReason, removeAvatarFile, uploadAvatar } from '@/lib/avatar'
import type { Profile } from '@/types'

export default function MeClient({
  userId,
  email,
  initialProfile,
  avatarUrl,
  signInMethod,
}: {
  userId: string
  email: string
  initialProfile: Profile | null
  /** プロフィールアイコンの署名付きURL。未設定・発行失敗のときは null */
  avatarUrl: string | null
  /** ログインに使っている方法の表示名（'Google' / 'メールアドレス'） */
  signInMethod: string
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  // アイコンのエラーはアイコンの近くに出す。画面末尾だと操作した場所から遠くて気付けない
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Marine ID はプロフィール行の作成時に採番される。未作成なら初回訪問時に作る。
  useEffect(() => {
    if (profile) return
    let cancelled = false
    const create = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .insert({ id: userId, display_name: email.split('@')[0] ?? '' })
        .select()
        .single()
      if (cancelled) return
      if (error) {
        setError('プロフィールの作成に失敗しました。DBマイグレーションの適用状況を確認してください。')
        return
      }
      setProfile(data as Profile)
      setDisplayName((data as Profile).display_name)
    }
    create()
    return () => {
      cancelled = true
    }
  }, [profile, userId, email])

  const saveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', userId)
    setSavingProfile(false)
    if (error) {
      setError('保存に失敗しました')
      return
    }
    setProfileSaved(true)
    router.refresh()
  }

  /**
   * プロフィールアイコンを差し替える。
   *
   * 先に新しいファイルを上げてから profiles を書き換え、最後に古いファイルを消す。
   * この順なら途中で失敗しても、表示中のアイコンが消えた状態にはならない。
   */
  const uploadAvatarPhoto = async (file: File) => {
    if (!profile) return
    const reason = rejectReason(file)
    if (reason) {
      setAvatarError(reason)
      return
    }

    setUploadingAvatar(true)
    setAvatarError(null)
    const supabase = createClient()
    try {
      const path = await uploadAvatar(supabase, userId, 'profile', file)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', userId)
      if (updateError) {
        // 参照されないファイルを残さない
        await removeAvatarFile(supabase, path)
        throw new Error('アイコンの保存に失敗しました')
      }

      await removeAvatarFile(supabase, profile.avatar_path)
      setProfile({ ...profile, avatar_path: path })
      router.refresh()
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'アイコンの保存に失敗しました')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatarPhoto = async () => {
    if (!profile?.avatar_path) return
    setUploadingAvatar(true)
    setAvatarError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', userId)
    if (error) {
      setUploadingAvatar(false)
      setAvatarError('アイコンの削除に失敗しました')
      return
    }
    await removeAvatarFile(supabase, profile.avatar_path)
    setProfile({ ...profile, avatar_path: null })
    setUploadingAvatar(false)
    router.refresh()
  }

  const copyMarineId = async () => {
    if (!profile) return
    try {
      await navigator.clipboard.writeText(profile.marine_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Marine ID', profile.marine_id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>Marine ID</SectionLabel>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="tnum text-2xl font-semibold tracking-[0.16em] text-marine">
                {profile?.marine_id ?? '------'}
              </div>
              <p className="mt-1 text-[11px] text-fg-mute">
                アカウント同士を Marine Link で接続するときに使うIDです。
              </p>
            </div>
            <button
              type="button"
              onClick={copyMarineId}
              disabled={!profile}
              aria-label="Marine IDをコピー"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-fg-mute transition-colors hover:border-marine/50 hover:text-marine disabled:opacity-40"
            >
              {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            </button>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Account</SectionLabel>
        <Card>
          {/* アイコンと表示名。アイコンをタップすると端末の画像選択が開く */}
          <div className="flex items-center gap-3 pb-4">
            <AvatarPicker
              name={displayName || email}
              src={avatarUrl}
              hasPhoto={Boolean(profile?.avatar_path)}
              selected
              size={56}
              disabled={!profile || uploadingAvatar}
              onFile={uploadAvatarPhoto}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{displayName || '表示名が未設定です'}</div>
              <div className="mt-1 text-[11px] text-fg-mute">
                {uploadingAvatar
                  ? 'アイコンを保存しています'
                  : profile?.avatar_path
                    ? 'アイコンをタップすると変更できます'
                    : 'アイコンをタップすると写真を設定できます'}
              </div>
            </div>
            {profile?.avatar_path ? (
              <button
                type="button"
                onClick={removeAvatarPhoto}
                disabled={uploadingAvatar}
                className="shrink-0 text-[11px] text-fg-mute transition-colors hover:text-danger disabled:opacity-40"
              >
                削除
              </button>
            ) : null}
          </div>

          {avatarError ? (
            <p className="-mt-2 pb-4 text-[13px] text-danger">{avatarError}</p>
          ) : null}

          <div className="divide-hairline border-t border-line pt-4">
            {/* Google で入っているなら「Google」と出す。
                どのアカウントで入っているかが分かるよう、値はメールアドレスのまま */}
            <Row label={signInMethod} value={email} />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <Field label="表示名">
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setProfileSaved(false)
                }}
                placeholder="表示名"
                className={inputClass}
              />
            </Field>
            <div className="mt-3 flex flex-col gap-2">
              {profileSaved ? <p className="text-[13px] text-teal">保存しました</p> : null}
              <Button full onClick={saveProfile} disabled={savingProfile || !profile}>
                {savingProfile ? '保存中' : '表示名を保存'}
              </Button>
            </div>
          </div>

          {/* ログアウトはアカウント操作なのでここに置く。
              画面の末尾に置くと他のセクションの下に埋もれて見つからない */}
          <form action="/auth/signout" method="post" className="mt-4 border-t border-line pt-4">
            <Button type="submit" variant="danger" full>
              <IconLogout size={17} />
              ログアウト
            </Button>
          </form>
        </Card>
      </div>

      <div id="notifications" className="scroll-mt-20">
        <SectionLabel>お知らせ</SectionLabel>
        <Card>
          <div className="flex items-start gap-3">
            <IconBell size={18} className="mt-0.5 shrink-0 text-fg-mute" />
            <div>
              <p className="text-[13px]">通知はまだありません</p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
                試合開始・貯金額確定・月末入金・割り勘の精算依頼などのプッシュ通知は Phase 6
                で実装予定です。
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>メンバー</SectionLabel>
        <Link
          href="/me/members"
          prefetch={false}
          className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-marine/50"
        >
          <IconUsers size={18} className="shrink-0 text-fg-mute" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">一緒に使う人</p>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
              Marine ID の登録と、割り勘・貯金それぞれへの参加を設定します。
            </p>
          </div>
          <IconChevronRight size={18} className="shrink-0 text-fg-mute" />
        </Link>
      </div>

      <div>
        <SectionLabel>Marine Link</SectionLabel>
        <Link
          href="/me/link"
          prefetch={false}
          className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-marine/50"
        >
          <IconLink size={18} className="shrink-0 text-fg-mute" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">アカウント間のデータ共有</p>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
              Marine ID で接続し、貯金や割り勘を項目ごとに共有します。
            </p>
          </div>
          <IconChevronRight size={18} className="shrink-0 text-fg-mute" />
        </Link>
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <p className="pb-2 text-center text-[11px] text-fg-mute">
        Marine Wallet / 完全個人利用・非商用
      </p>
    </div>
  )
}
