import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SAVING_RULES } from '@/lib/savings'
import type {
  Game,
  MemberSettings,
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
 */

export async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return (data as Profile | null) ?? null
}

export async function getSavingRules(userId: string): Promise<SavingRules> {
  const supabase = await createClient()
  const { data } = await supabase.from('saving_rules').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return { ...DEFAULT_SAVING_RULES, user_id: userId }
  const rules = data as SavingRules
  // numeric 型は文字列で返るため数値に正規化する
  return {
    ...rules,
    multiplier_regular: Number(rules.multiplier_regular),
    multiplier_interleague: Number(rules.multiplier_interleague),
    multiplier_cs: Number(rules.multiplier_cs),
    multiplier_nippon_series: Number(rules.multiplier_nippon_series),
  }
}

export async function getSavingEntries(userId: string): Promise<SavingEntryRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('saving_entries')
    .select('*, game:games(*)')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })

  // kind='custom' は game が null。試合貯金なのに game が取れない行だけを除外する
  return ((data ?? []) as SavingEntryRow[]).filter(
    (entry) => entry.kind === 'custom' || Boolean(entry.game)
  )
}

export async function getMonthlySavings(userId: string): Promise<MonthlySaving[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('monthly_savings')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
  return (data ?? []) as MonthlySaving[]
}

export async function getSplitRecords(userId: string): Promise<SplitRecord[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as SplitRecord[]
}

export async function getMemberSettings(userId: string): Promise<MemberSettings> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle()
  return (
    (data as MemberSettings | null) ?? {
      user_id: userId,
      member_a: 'Aさん',
      member_b: 'Bさん',
      member_c: null,
    }
  )
}

export async function getSplitMembers(userId: string): Promise<SplitMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('split_members')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []) as SplitMember[]
}

/** 直近の共通試合データ（貯金未登録の試合を拾うために使う） */
export async function getRecentGames(limit = 60): Promise<Game[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('*')
    .order('game_date', { ascending: false })
    .limit(limit)
  return (data ?? []) as Game[]
}
