'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Row, SectionLabel, inputClass } from '@/components/ui'
import { IconCheck, IconCopy, IconLink, IconLogout } from '@/components/icons'
import { loadAppLinks, saveAppLinks, type AppLinks } from '@/components/HandoffActions'
import { createClient } from '@/lib/supabase/client'
import { EXTERNAL_APPS, type ExternalAppKey } from '@/lib/constants'
import type { Profile } from '@/types'

export default function MeClient({
  userId,
  email,
  initialProfile,
}: {
  userId: string
  email: string
  initialProfile: Profile | null
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '')
  const [links, setLinks] = useState<AppLinks>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [linksSaved, setLinksSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLinks(loadAppLinks())
  }, [])

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

  const updateLink = (key: ExternalAppKey, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }))
    setLinksSaved(false)
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
          <div className="divide-hairline">
            <Row label="メールアドレス" value={email} />
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
        </Card>
      </div>

      <div>
        <SectionLabel>外部アプリ連携</SectionLabel>
        <Card>
          <p className="mb-4 text-[11px] leading-relaxed text-fg-mute">
            Marine Wallet
            は資金を保有・移動しません。金額をコピーして各アプリで入金・送金する運用です。
            起動URL（アプリのURLスキームやWebのURL）は端末ごとに異なるため、ここで設定します。
            設定はこの端末のブラウザにのみ保存されます。
          </p>
          <div className="flex flex-col gap-4">
            {(Object.keys(EXTERNAL_APPS) as ExternalAppKey[]).map((key) => (
              <Field key={key} label={EXTERNAL_APPS[key].label} hint={EXTERNAL_APPS[key].hint}>
                <input
                  type="url"
                  value={links[key] ?? ''}
                  onChange={(e) => updateLink(key, e.target.value)}
                  placeholder="https:// または アプリのURLスキーム"
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {linksSaved ? <p className="text-[13px] text-teal">保存しました</p> : null}
            <Button
              full
              onClick={() => {
                saveAppLinks(links)
                setLinksSaved(true)
              }}
            >
              起動URLを保存
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Marine Link</SectionLabel>
        <Card>
          <div className="flex items-start gap-3">
            <IconLink size={18} className="mt-0.5 shrink-0 text-fg-mute" />
            <div>
              <p className="text-[13px]">アカウント間のデータ共有</p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-mute">
                Marine ID での接続、共有範囲の権限設定、共同貯金は Phase 4
                で実装予定です。現時点ではIDの発行のみ行っています。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="danger" full>
          <IconLogout size={17} />
          ログアウト
        </Button>
      </form>

      <p className="pb-2 text-center text-[11px] text-fg-mute">
        Marine Wallet / 完全個人利用・非商用
      </p>
    </div>
  )
}
