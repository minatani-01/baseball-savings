// ============================================================================
// Marine Wallet 共通型定義
// ============================================================================

// ---------------------------------------------------------------- 共通 ----
export type Profile = {
  id: string
  display_name: string
  marine_id: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------- 貯金 ----
export type Phase = 'regular' | 'interleague' | 'cs' | 'nippon_series'
export type GameResult = 'win' | 'lose' | 'draw'
export type HomeAway = 'home' | 'away'
export type PitchingHighlight =
  | 'none'
  | 'quality_start'
  | 'complete_game'
  | 'shutout'
  | 'no_hitter'
  | 'perfect_game'

export type Game = {
  id: string
  game_date: string
  opponent: string
  phase: Phase
  /** 旧アプリから移行した試合は不明（null） */
  home_away: HomeAway | null
  stadium: string
  result: GameResult
  is_sayonara: boolean
  marines_score: number | null
  opponent_score: number | null
  /** 満塁HRを含まない本塁打数 */
  home_runs: number
  grand_slams: number
  /** マルチ安打を記録した選手数 */
  multi_hits: number
  rbi: number
  pitching_highlight: PitchingHighlight
  is_winning_pitcher: boolean
  has_save: boolean
  source: 'manual' | 'npb'
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BreakdownLine = {
  key: string
  label: string
  amount: number
}

export type SavingKind = 'game' | 'custom'

export type SavingEntry = {
  id: string
  user_id: string
  /** kind='custom' のときは null */
  game_id: string | null
  kind: SavingKind
  /** カスタム貯金の内容。試合貯金では空文字 */
  title: string
  entry_date: string
  /** 'YYYY-MM'（DB側の生成列） */
  month: string
  amount: number
  breakdown: BreakdownLine[]
  other_amount: number
  other_note: string
  created_at: string
  updated_at: string
}

/** 試合を結合した積立。カスタム貯金では game が null になる */
export type SavingEntryRow = SavingEntry & { game: Game | null }

export type SavingRules = {
  user_id?: string
  win_amount: number
  draw_amount: number
  lose_amount: number
  sayonara_bonus: number
  home_run_amount: number
  grand_slam_amount: number
  multi_hit_amount: number
  rbi_amount: number
  perfect_game_amount: number
  no_hitter_amount: number
  shutout_amount: number
  complete_game_amount: number
  quality_start_amount: number
  winning_pitcher_amount: number
  save_amount: number
  multiplier_regular: number
  multiplier_interleague: number
  multiplier_cs: number
  multiplier_nippon_series: number
  /** 月間の目標貯金額。0 は未設定 */
  monthly_goal_amount: number
}

export type MonthlyStatus = 'calculating' | 'ready' | 'deposit_pending' | 'deposited'

export type MonthlySaving = {
  id: string
  user_id: string
  month: string
  status: MonthlyStatus
  confirmed_amount: number | null
  confirmed_at: string | null
  deposited_at: string | null
  note: string
  created_at: string
  updated_at: string
}

// -------------------------------------------------------------- 割り勘 ----
export type SplitStatus = 'unpaid' | 'paid'
export type SplitFilter = 'unpaid' | 'all' | 'paid'
export type SortOrder = 'desc' | 'asc'
export type SplitType = 'equal' | 'ratio' | 'amount'
export type ExpenseCategory = 'ticket' | 'food' | 'beer' | 'goods' | 'transport' | 'other'

export type SplitMember = {
  id: string
  user_id: string
  name: string
  is_self: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type Share = {
  member: string
  /** 比率指定時の比率、金額指定時の入力金額。均等割の場合は null */
  value: number | null
  /** このメンバーの最終的な負担額（円）。合計は amount と必ず一致する */
  burden: number
}

export type SplitRecord = {
  id: string
  user_id: string
  date: string
  content: string
  amount: number
  payer: string
  status: SplitStatus
  split_type: SplitType
  /** 参加人数。shares.length と一致する（2以上） */
  member_count: number
  shares: Share[]
  category: ExpenseCategory
  game_id: string | null
  created_at: string
  updated_at: string
}
