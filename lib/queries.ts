import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SAVING_RULES } from '@/lib/savings'
import type {
  Game,
  MonthlySaving,
  Profile,
  SavingEntryRow,
  SavingRules,
  SplitMember,
  SplitRecord,
} from '@/types'

/**
 * サーバーコンポーネント用の読み取りヘルパー。
 * 書き込みはすべてクライアント側（RLS 経由）で行うため、ここには読み取りだけを置く。
 *
 * 重要: 取得に失敗したときに空配列やデフォルト値を返してはいけない。
 * 金額を扱う画面なので、「未精算 0円」のような “それらしいが誤った値” を
 * 表示するくらいなら、エラーを投げて error.tsx に再試行させる。
 */

/** テーブル名を持つ読み取りエラー。error.tsx でどの取得に失敗したか出すために使う */
export class QueryError extends Error {
  readonly table: string
  readonly code: string

  constructor(table: string, message: string, code = '') {
    super(`${table} の取得に失敗しました: ${message}`)
    this.name = 'QueryError'
    this.table = table
    this.code = code
  }
}

type SupabaseResult<T> = { data: T | null; error: { message: string; code?: string } | null }

const RETRY_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 読み取りを実行し、失敗したら1回だけ再試行してから QueryError を投げる。
 *
 * Supabase の Free プランはアイドル後の初回アクセスでコールドスタートし、
 * ゲートウェイが 504 を返すことがある。読み取りは冪等なので、
 * ここで一度だけ引き直すとその大半を吸収できる。
 */
async function read<T>(table: string, run: () => PromiseLike<SupabaseResult<T>>): Promise<T | null> {
  let lastError: { message: string; code?: string } | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS)

    let result: SupabaseResult<T>
    try {
      result = await run()
    } catch (cause) {
      // fetch 自体が落ちたケース（DNS・接続断など）
      lastError = { message: cause instanceof Error ? cause.message : String(cause) }
      continue
    }

    if (!result.error) return result.data
    lastError = result.error
  }

  throw new QueryError(table, lastError?.message ?? 'unknown error', lastError?.code ?? '')
}

export type SessionUser = { id: string; email: string }

/**
 * ログイン中のユーザー。layout と page の両方から呼ばれるので cache() で1回にまとめる。
 *
 * getUser() は毎回 Auth サーバーへ問い合わせる（実測 平均276ms）。
 * このプロジェクトの JWT は ES256 署名なので getClaims() ならローカル検証で済み、
 * JWKS を取得済みのインスタンスではネットワーク往復が発生しない。
 * ここで必要なのは id と email だけで、いずれも JWT のクレームに含まれる。
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
  }
})

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  return await read<Profile>('profiles', () =>
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  )
}

export async function getSavingRules(userId: string): Promise<SavingRules> {
  const supabase = await createClient()
  const data = await read<SavingRules>('saving_rules', () =>
    supabase.from('saving_rules').select('*').eq('user_id', userId).maybeSingle()
  )

  // 行が無いのは正常（まだルール未設定）。取得失敗とは区別する
  if (!data) return { ...DEFAULT_SAVING_RULES, user_id: userId }

  // numeric 型は文字列で返るため数値に正規化する
  return {
    ...data,
    multiplier_regular: Number(data.multiplier_regular),
    multiplier_interleague: Number(data.multiplier_interleague),
    multiplier_cs: Number(data.multiplier_cs),
    multiplier_nippon_series: Number(data.multiplier_nippon_series),
  }
}

export async function getSavingEntries(userId: string): Promise<SavingEntryRow[]> {
  const supabase = await createClient()
  const data = await read<SavingEntryRow[]>('saving_entries', () =>
    supabase
      .from('saving_entries')
      .select('*, game:games(*)')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
  )

  // kind='custom' は game が null。試合貯金なのに game が取れない行だけを除外する
  return (data ?? []).filter((entry) => entry.kind === 'custom' || Boolean(entry.game))
}

export async function getMonthlySavings(userId: string): Promise<MonthlySaving[]> {
  const supabase = await createClient()
  const data = await read<MonthlySaving[]>('monthly_savings', () =>
    supabase
      .from('monthly_savings')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
  )
  return data ?? []
}

export async function getSplitRecords(userId: string): Promise<SplitRecord[]> {
  const supabase = await createClient()
  const data = await read<SplitRecord[]>('records', () =>
    supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return data ?? []
}

export async function getSplitMembers(userId: string): Promise<SplitMember[]> {
  const supabase = await createClient()
  const data = await read<SplitMember[]>('split_members', () =>
    supabase
      .from('split_members')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  )
  return data ?? []
}

/** 直近の共通試合データ（貯金未登録の試合を拾うために使う） */
export async function getRecentGames(limit = 60): Promise<Game[]> {
  const supabase = await createClient()
  const data = await read<Game[]>('games', () =>
    supabase.from('games').select('*').order('game_date', { ascending: false }).limit(limit)
  )
  return data ?? []
}
