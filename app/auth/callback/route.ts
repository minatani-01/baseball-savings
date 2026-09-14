import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth（Google）のコールバック。
 *
 * Supabase から ?code= 付きで戻ってくるので、ここでセッションへ交換する。
 * Route Handler ではクッキーを書けるため、createClient の setAll がそのまま効く。
 *
 * 注意: このパスは proxy.ts の認証ガードから除外してある。
 * 除外しないと、セッションがまだ無い状態で /login へ飛ばされ、
 * code を交換する前に流れが切れてしまう。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 戻り先。オープンリダイレクトにならないよう、アプリ内の絶対パスだけを許可する
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  // 認可画面でキャンセルした場合などは error が返る
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')

  const redirectTo = (path: string) => {
    // Vercel では request.url のホストが内部のものになることがあるため、
    // 転送元のホストを優先する
    const forwardedHost = request.headers.get('x-forwarded-host')
    if (process.env.NODE_ENV !== 'development' && forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${path}`)
    }
    return NextResponse.redirect(`${origin}${path}`)
  }

  if (oauthError) {
    return redirectTo(`/login?error=${encodeURIComponent('oauth_cancelled')}`)
  }

  if (!code) {
    return redirectTo(`/login?error=${encodeURIComponent('oauth_no_code')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return redirectTo(`/login?error=${encodeURIComponent('oauth_failed')}`)
  }

  return redirectTo(next)
}
