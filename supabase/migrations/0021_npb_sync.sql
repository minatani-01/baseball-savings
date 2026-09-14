-- ============================================================================
-- Marine Wallet / 0021_npb_sync
-- ----------------------------------------------------------------------------
-- npb.jp から取得した試合データと個人成績を貯めるテーブルを作る。
--
-- 方針:
--   取得結果を既存の games へ直接書き込まない。まず npb_games に貯めて、
--   内容を目で確認してから games へ取り込む二段構えにする。
--   自動取得が誤った値を入れたときに、貯金額まで一緒に壊れるのを避けるため。
--
--   個人成績は npb.jp が1試合ごとの打撃成績を公開していないため、
--   チーム別のシーズン累計を毎日スナップショットし、その差分を
--   その日の成績として扱う（docs/npb-data-sources.md 4章）。
--
-- 書き込みは Vercel の Cron から service role で行う。
-- そのため insert / update / delete のポリシーを作らない。
-- service role は RLS を迂回するので書けるが、ログイン中のユーザーは
-- select しかできない。誤操作でも手で書き換えられないようにしておく。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. npb_games  （日程・結果ページとボックススコアから取れた試合）
-- ----------------------------------------------------------------------------
create table if not exists public.npb_games (
  id uuid primary key default gen_random_uuid(),

  game_date date not null,

  -- npb.jp の表記をそのまま入れる（ロッテ / 西武 / ソフトバンク ...）。
  -- アプリ内の opponent コードへの変換はアプリ側で行う。
  -- NPB の日程表では team1 がホームなので、その並びを保つ。
  home_team text not null,
  away_team text not null,

  home_score int check (home_score is null or home_score >= 0),
  away_score int check (away_score is null or away_score >= 0),

  place text not null default '',
  start_time text not null default '',

  phase text not null default 'regular'
    check (phase in ('regular', 'interleague', 'cs', 'nippon_series')),

  -- scheduled: まだ結果が出ていない / finished: 試合終了 / cancelled: 中止
  status text not null default 'scheduled'
    check (status in ('scheduled', 'finished', 'cancelled')),

  win_pitcher text not null default '',
  lose_pitcher text not null default '',
  save_pitcher text not null default '',

  -- 例: /scores/2026/0901/m-l-20/ 。未実施の試合では空になる
  box_score_path text not null default '',

  -- 備考欄と天候欄（中止の理由などが入る）
  note text not null default '',

  -- パース結果そのもの。後から取りこぼしを見直せるように残す
  raw jsonb not null default '{}'::jsonb,

  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同じ日の同じカードは1行にまとめる（ダブルヘッダーは box_score_path で区別が
  -- 必要になるが、マリーンズの日程では発生しないため今は考慮しない）
  constraint npb_games_unique_per_card unique (game_date, home_team, away_team)
);

create index if not exists npb_games_game_date_idx
  on public.npb_games (game_date desc);

alter table public.npb_games enable row level security;

drop policy if exists "npb_games_select_authenticated" on public.npb_games;
create policy "npb_games_select_authenticated" on public.npb_games
  for select to authenticated using (true);

drop trigger if exists npb_games_touch_updated_at on public.npb_games;
create trigger npb_games_touch_updated_at
  before update on public.npb_games
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. npb_player_stat_snapshots  （チーム別 個人成績のシーズン累計スナップショット）
-- ----------------------------------------------------------------------------
create table if not exists public.npb_player_stat_snapshots (
  id uuid primary key default gen_random_uuid(),

  -- ページに書かれている「YYYY年M月D日 現在」。取得した日ではない。
  -- 取得を1日飛ばしたことを検出するために、この日付を正とする。
  as_of date not null,

  kind text not null check (kind in ('batting', 'pitching')),

  -- npb.jp の表記（姓と名の間は全角スペース）
  player_name text not null,

  -- 左打ち / 左投げ（名前の先頭に * が付く）
  is_left boolean not null default false,

  -- 列名 -> 数値。列は年によって変わりうるので、固定列にせず jsonb で持つ。
  -- 投球回は 15回1/3 を 46（アウト数）に直して innings_outs に入れる。
  stats jsonb not null,

  fetched_at timestamptz not null default now(),

  constraint npb_player_stat_snapshots_unique
    unique (as_of, kind, player_name)
);

create index if not exists npb_player_stat_snapshots_as_of_idx
  on public.npb_player_stat_snapshots (as_of desc, kind);

alter table public.npb_player_stat_snapshots enable row level security;

drop policy if exists "npb_player_stat_snapshots_select_authenticated"
  on public.npb_player_stat_snapshots;
create policy "npb_player_stat_snapshots_select_authenticated"
  on public.npb_player_stat_snapshots
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- 3. npb_sync_runs  （取得の実行ログ）
-- ----------------------------------------------------------------------------
-- 取得が失敗した日や、スナップショットが飛んだ区間を後から追えるようにする。
create table if not exists public.npb_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  -- 取得したページ数、保存した試合数、スナップショットの基準日など
  summary jsonb not null default '{}'::jsonb,
  error text not null default ''
);

create index if not exists npb_sync_runs_started_at_idx
  on public.npb_sync_runs (started_at desc);

alter table public.npb_sync_runs enable row level security;

drop policy if exists "npb_sync_runs_select_authenticated" on public.npb_sync_runs;
create policy "npb_sync_runs_select_authenticated" on public.npb_sync_runs
  for select to authenticated using (true);
