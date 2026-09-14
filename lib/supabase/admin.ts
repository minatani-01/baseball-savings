import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * service role を使うサーバー専用クライアント。
 *
 * Cron のようにログイン中のユーザーがいない処理でだけ使う。
 * このキーは RLS を迂回するため、ブラウザに渡る場所では絶対に使わない
 * （NEXT_PUBLIC_ を付けない環境変数に置くこと）。
 *
 * npb_games などの取得データ用テーブルは書き込みポリシーを持たないので、
 * 書けるのはこのクライアントだけになる。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL が設定されていません')
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
