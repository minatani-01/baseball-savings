'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Segmented, inputClass } from '@/components/ui'
import Brand from '@/components/Brand'
import { TEAM_NAME } from '@/lib/constants'

type Mode = 'signin' | 'signup'

/** Google の公式カラーマーク。ブランドの識別性を保つためここだけ多色にする */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: 'Googleログインがキャンセルされました',
  oauth_no_code: 'Googleログインの応答が不正でした。もう一度お試しください',
  oauth_failed: 'Googleログインに失敗しました。もう一度お試しください',
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // /auth/callback がエラーで戻したときに理由を出す。
  // useSearchParams() を使うとこのページが静的生成できなくなるため、
  // マウント後に location から直接読む。
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code) setError(OAUTH_ERRORS[code] ?? 'ログインに失敗しました')
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    setMessage(null)
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 戻り先は同じオリジンの /auth/callback。
        // 本番・Preview・ローカルでホストが変わるので location から組み立てる
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setGoogleLoading(false)
      setError('Googleログインを開始できませんでした')
      return
    }
    // 成功時は Google の認可画面へ遷移するため、ここでは何もしない
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const supabase = createClient()
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('メールアドレスまたはパスワードが違います')
        setLoading(false)
        return
      }
      router.replace('/')
      router.refresh()
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      router.replace('/')
      router.refresh()
      return
    }
    setMessage('確認メールを送信しました。メール内のリンクを開いてからログインしてください。')
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <p className="eyebrow">{TEAM_NAME}</p>
        <div className="mt-5">
          <Brand size="lg" withTagline />
        </div>
        <p className="mt-6 text-[15px] leading-relaxed font-medium">
          好きが、未来をつくる。
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-mute">
          野球を、もっと特別な毎日に。
        </p>
      </div>

      <div className="glass glow rounded-2xl p-5">
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next)
            setError(null)
            setMessage(null)
          }}
          options={[
            { id: 'signin', label: 'ログイン' },
            { id: 'signup', label: '新規登録' },
          ]}
        />

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googleLoading || loading}
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white/[0.04] px-4 text-sm font-medium text-fg transition-colors hover:border-marine/60 disabled:opacity-40"
        >
          <GoogleMark />
          {googleLoading ? '接続中' : 'Googleで続ける'}
        </button>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] text-fg-mute">または</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <Field label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="パスワード" hint="6文字以上">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          {message ? <p className="text-[13px] text-teal">{message}</p> : null}

          <Button type="submit" variant="primary" full disabled={loading}>
            {loading ? '処理中' : mode === 'signin' ? 'ログイン' : '登録する'}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-fg-mute">
        完全個人利用 / 非商用。Marine Wallet は資金を保有・移動しません。
      </p>
    </div>
  )
}
