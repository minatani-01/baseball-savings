'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Segmented, inputClass } from '@/components/ui'
import { APP_NAME, TEAM_NAME } from '@/lib/constants'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      <div className="mb-10 text-center">
        <p className="eyebrow">{TEAM_NAME}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[0.14em]">{APP_NAME}</h1>
        <p className="mt-4 text-[13px] leading-relaxed text-fg-mute">
          マリーンズを応援する毎日を、
          <br />
          記録し、つなぎ、未来へ積み立てる。
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

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
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
