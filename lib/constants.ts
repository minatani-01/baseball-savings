import type {
  ExpenseCategory,
  GameResult,
  HomeAway,
  MonthlyStatus,
  Phase,
  PitchingHighlight,
} from '@/types'

export const APP_NAME = 'Marine Wallet'
export const TEAM_NAME = 'CHIBA LOTTE MARINES'

/** 対戦相手（id は旧 baseball-savings アプリと互換） */
export const OPPONENTS: { id: string; label: string; short: string }[] = [
  { id: 'fighters', label: '日本ハム', short: 'FIGHTERS' },
  { id: 'eagles', label: '楽天', short: 'EAGLES' },
  { id: 'lions', label: '西武', short: 'LIONS' },
  { id: 'hawks', label: 'ソフトバンク', short: 'HAWKS' },
  { id: 'buffaloes', label: 'オリックス', short: 'BUFFALOES' },
  { id: 'giants', label: '巨人', short: 'GIANTS' },
  { id: 'tigers', label: '阪神', short: 'TIGERS' },
  { id: 'dragons', label: '中日', short: 'DRAGONS' },
  { id: 'baystars', label: 'DeNA', short: 'BAYSTARS' },
  { id: 'carp', label: '広島', short: 'CARP' },
  { id: 'swallows', label: 'ヤクルト', short: 'SWALLOWS' },
]

export function opponentLabel(id: string): string {
  return OPPONENTS.find((o) => o.id === id)?.label ?? id
}

export const PHASES: { id: Phase; label: string; ruleKey: keyof PhaseMultiplierMap }[] = [
  { id: 'regular', label: 'レギュラー', ruleKey: 'multiplier_regular' },
  { id: 'interleague', label: '交流戦', ruleKey: 'multiplier_interleague' },
  { id: 'cs', label: 'CS', ruleKey: 'multiplier_cs' },
  { id: 'nippon_series', label: '日本シリーズ', ruleKey: 'multiplier_nippon_series' },
]

export type PhaseMultiplierMap = {
  multiplier_regular: number
  multiplier_interleague: number
  multiplier_cs: number
  multiplier_nippon_series: number
}

export function phaseLabel(id: Phase): string {
  return PHASES.find((p) => p.id === id)?.label ?? id
}

export const RESULTS: { id: GameResult; label: string }[] = [
  { id: 'win', label: '勝利' },
  { id: 'draw', label: '引き分け' },
  { id: 'lose', label: '敗北' },
]

export function resultLabel(id: GameResult, isSayonara = false): string {
  if (id === 'win' && isSayonara) return 'サヨナラ勝利'
  return RESULTS.find((r) => r.id === id)?.label ?? id
}

export const HOME_AWAY: { id: HomeAway; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'away', label: 'ビジター' },
]

/** 先発ハイライトは最上位のみ加算する（セーブのみ独立） */
export const PITCHING_HIGHLIGHTS: { id: PitchingHighlight; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'quality_start', label: 'QS' },
  { id: 'complete_game', label: '完投' },
  { id: 'shutout', label: '完封' },
  { id: 'no_hitter', label: 'ノーヒットノーラン' },
  { id: 'perfect_game', label: '完全試合' },
]

export function pitchingHighlightLabel(id: PitchingHighlight): string {
  return PITCHING_HIGHLIGHTS.find((p) => p.id === id)?.label ?? id
}

export const MONTHLY_STATUS_LABEL: Record<MonthlyStatus, string> = {
  calculating: '月内集計中',
  ready: '月末金額確定',
  deposit_pending: 'ワンバンク入金待ち',
  deposited: '入金済み',
}

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'ticket', label: 'チケット' },
  { id: 'food', label: '飲食' },
  { id: 'beer', label: 'ビール' },
  { id: 'goods', label: 'グッズ' },
  { id: 'transport', label: '交通' },
  { id: 'other', label: 'その他' },
]

export function categoryLabel(id: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'その他'
}

/**
 * 外部金融アプリの起動先。
 * Marine Wallet 自身は資金を移動せず、金額をコピーして各アプリへ誘導するだけ（仕様書 11章・38章）。
 *
 * 起動URL（カスタムURLスキーム等）は端末とアプリのバージョンで変わるため、
 * ハードコードせずマイページから利用者が設定する。未設定なら起動ボタンは出さず、
 * 金額コピーのみを提供する。
 */
export type ExternalAppKey = 'onebank' | 'paypay'

export const EXTERNAL_APPS: Record<ExternalAppKey, { label: string; hint: string }> = {
  onebank: {
    label: 'ワンバンク',
    hint: '月末の貯金入金に使うアプリの起動URL',
  },
  paypay: {
    label: 'PayPay',
    hint: '割り勘の精算に使うアプリの起動URL',
  },
}

export const APP_LINK_STORAGE_KEY = 'marine_wallet_app_links_v1'
