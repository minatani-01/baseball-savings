import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SAVING_RULES } from '@/lib/savings'
import type {
  Game,
  LinkMonthlyCompare,
  LinkPermissionRow,
  LinkResource,
  LinkResourceFlags,
  MarineLinkRow,
  MarineLinkView,
  MonthlySaving,
  Profile,
  SavingEntryRow,
  SavingRules,
  SplitMember,
  SplitRecord,
} from '@/types'

export const LINK_RESOURCES: LinkResource[] = ['saving', 'saving_rules', 'monthly', 'split']

function emptyFlags(): LinkResourceFlags {
  return { saving: false, saving_rules: false, monthly: false, split: false }
}

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

// ------------------------------------------------ Marine Link (Phase 4) ----

/**
 * 自分が当事者の接続を、画面が扱いやすい形にして返す。
 *
 * RLS 側でも当事者以外は弾かれるが、意図を明示するためクエリでも絞る。
 * 相手のプロフィールは profiles_select_linked で読めるが、相手がまだ
 * プロフィール行を作っていないこともあるので name/marine_id は空を許容する。
 */
export async function getMarineLinks(userId: string): Promise<MarineLinkView[]> {
  const supabase = await createClient()

  const links = await read<MarineLinkRow[]>('marine_links', () =>
    supabase
      .from('marine_links')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false })
  )
  if (!links || links.length === 0) return []

  const linkIds = links.map((l) => l.id)
  const partnerIds = links.map((l) => (l.user_a === userId ? l.user_b : l.user_a))

  const [permissions, profiles] = await Promise.all([
    read<LinkPermissionRow[]>('link_permissions', () =>
      supabase.from('link_permissions').select('*').in('marine_link_id', linkIds)
    ),
    read<Profile[]>('profiles', () =>
      supabase.from('profiles').select('*').in('id', partnerIds)
    ),
  ])

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  return links.map((link) => {
    const partnerId = link.user_a === userId ? link.user_b : link.user_a
    const partner = profileById.get(partnerId)
    const shared = emptyFlags()
    const received = emptyFlags()

    for (const row of permissions ?? []) {
      if (row.marine_link_id !== link.id) continue
      if (row.owner_id === userId) shared[row.resource_type] = row.permission
      else if (row.owner_id === partnerId) received[row.resource_type] = row.permission
    }

    return {
      id: link.id,
      status: link.status,
      partner_id: partnerId,
      partner_name: partner?.display_name ?? '',
      partner_marine_id: partner?.marine_id ?? '',
      outgoing: link.requested_by === userId,
      shared,
      received,
      created_at: link.created_at,
    }
  })
}

/**
 * 仕様書 16章の月間比較。接続済みの相手について、当月の積立額を返す。
 *
 * 相手が貯金を共有していない場合、RLS で行が返らない。その状態を 0 円と
 * 区別できないと「相手は貯金していない」と誤読させるので、権限が無いことを
 * null で表す。
 */
export async function getLinkMonthlyCompare(
  links: MarineLinkView[],
  month: string
): Promise<LinkMonthlyCompare[]> {
  const connected = links.filter((l) => l.status === 'accepted')
  if (connected.length === 0) return []

  const visible = connected.filter((l) => l.received.saving)
  const amountByUser = new Map<string, number>()

  if (visible.length > 0) {
    const supabase = await createClient()
    const rows = await read<{ user_id: string; amount: number }[]>('saving_entries', () =>
      supabase
        .from('saving_entries')
        .select('user_id, amount')
        .in(
          'user_id',
          visible.map((l) => l.partner_id)
        )
        .eq('month', month)
    )
    for (const row of rows ?? []) {
      amountByUser.set(row.user_id, (amountByUser.get(row.user_id) ?? 0) + row.amount)
    }
  }

  return connected.map((link) => ({
    partner_id: link.partner_id,
    partner_name: link.partner_name,
    partner_amount: link.received.saving ? (amountByUser.get(link.partner_id) ?? 0) : null,
  }))
}
