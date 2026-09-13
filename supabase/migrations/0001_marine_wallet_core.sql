-- ============================================================================
-- Marine Wallet / 0001_marine_wallet_core
-- ----------------------------------------------------------------------------
-- 適用先: Marine Wallet の共通 Supabase プロジェクト
--         （既存の「割り勘メモ」プロジェクト = ref: xliszlnpypvqghrwplxa を流用する想定）
--
-- 方針:
--   - 既存の records / settings はテーブル名も含めてそのまま活かし、列を追加するだけにする。
--   - ロッテ貯金は「共通 games（試合データは全ユーザー共有）」＋「saving_entries（貯金額は個人）」
--     の2層構造に分離する。仕様書 15章「試合結果は共有、貯金ルールは個人」に対応。
--   - すべてのユーザーデータテーブルで RLS を有効化する。
--
-- 冪等性: 何度実行しても安全（create if not exists / drop policy if exists）。
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- search_path を固定して関数の乗っ取りを防ぐ（Supabase security linter 0011 対応）
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 共通: Marine ID 採番（MW-XXXXXX / 紛らわしい 0O1I を除いた32文字）
-- ----------------------------------------------------------------------------
create or replace function public.generate_marine_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := 'MW-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.marine_id = candidate);
  end loop;
  return candidate;
end;
$$;

-- ============================================================================
-- 1. profiles
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  marine_id text not null unique default public.generate_marine_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. saving_rules  （貯金ルールは個人ごと）
-- ============================================================================
create table if not exists public.saving_rules (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- 試合結果
  win_amount int not null default 500,
  draw_amount int not null default 200,
  lose_amount int not null default 0,
  sayonara_bonus int not null default 500,

  -- 打撃（home_run_amount は満塁HRを含まない本数に適用する）
  home_run_amount int not null default 200,
  grand_slam_amount int not null default 500,

  -- 投手（先発ハイライトは最上位のみ、セーブのみ独立して加算）
  perfect_game_amount int not null default 5000,
  no_hitter_amount int not null default 3000,
  shutout_amount int not null default 500,
  complete_game_amount int not null default 100,
  quality_start_amount int not null default 200,
  save_amount int not null default 100,

  -- フェーズ倍率
  multiplier_regular numeric(4, 2) not null default 1.0,
  multiplier_interleague numeric(4, 2) not null default 1.0,
  multiplier_cs numeric(4, 2) not null default 1.2,
  multiplier_nippon_series numeric(4, 2) not null default 1.5,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saving_rules_amounts_non_negative check (
    win_amount >= 0 and draw_amount >= 0 and lose_amount >= 0 and sayonara_bonus >= 0
    and home_run_amount >= 0 and grand_slam_amount >= 0
    and perfect_game_amount >= 0 and no_hitter_amount >= 0 and shutout_amount >= 0
    and complete_game_amount >= 0 and quality_start_amount >= 0 and save_amount >= 0
  ),
  constraint saving_rules_multipliers_range check (
    multiplier_regular between 0 and 10
    and multiplier_interleague between 0 and 10
    and multiplier_cs between 0 and 10
    and multiplier_nippon_series between 0 and 10
  )
);

alter table public.saving_rules enable row level security;

drop policy if exists "saving_rules_select_own" on public.saving_rules;
create policy "saving_rules_select_own" on public.saving_rules
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "saving_rules_insert_own" on public.saving_rules;
create policy "saving_rules_insert_own" on public.saving_rules
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "saving_rules_update_own" on public.saving_rules;
create policy "saving_rules_update_own" on public.saving_rules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop trigger if exists saving_rules_touch_updated_at on public.saving_rules;
create trigger saving_rules_touch_updated_at
  before update on public.saving_rules
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. games  （試合データは全ユーザー共有 / Phase2 で NPB 取得に置き換える）
-- ============================================================================
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  game_date date not null,
  opponent text not null,
  phase text not null default 'regular'
    check (phase in ('regular', 'interleague', 'cs', 'nippon_series')),
  home_away text not null default 'home' check (home_away in ('home', 'away')),
  stadium text not null default '',
  result text not null check (result in ('win', 'lose', 'draw')),
  is_sayonara boolean not null default false,
  marines_score int check (marines_score is null or marines_score >= 0),
  opponent_score int check (opponent_score is null or opponent_score >= 0),

  -- home_runs は満塁HRを含まない本数（既存 baseball-savings アプリの数え方を踏襲）
  home_runs int not null default 0 check (home_runs >= 0),
  grand_slams int not null default 0 check (grand_slams >= 0),

  pitching_highlight text not null default 'none'
    check (pitching_highlight in ('none', 'quality_start', 'complete_game', 'shutout', 'no_hitter', 'perfect_game')),
  has_save boolean not null default false,

  source text not null default 'manual' check (source in ('manual', 'npb')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint games_sayonara_requires_win check (not is_sayonara or result = 'win'),
  constraint games_unique_per_date_opponent unique (game_date, opponent)
);

create index if not exists games_game_date_idx on public.games (game_date desc);

alter table public.games enable row level security;

-- 試合データは共有。ログイン済みユーザーは全件参照でき、追加・修正もできる。
-- （完全個人利用・少人数前提。削除だけは登録者に限定して事故を防ぐ）
drop policy if exists "games_select_authenticated" on public.games;
create policy "games_select_authenticated" on public.games
  for select to authenticated using (true);

drop policy if exists "games_insert_authenticated" on public.games;
create policy "games_insert_authenticated" on public.games
  for insert to authenticated with check (created_by = (select auth.uid()));

drop policy if exists "games_update_authenticated" on public.games;
create policy "games_update_authenticated" on public.games
  for update to authenticated using (true) with check (true);

drop policy if exists "games_delete_own" on public.games;
create policy "games_delete_own" on public.games
  for delete to authenticated using (created_by = (select auth.uid()));

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 4. saving_entries  （共通 games にユーザー個別ルールを適用した積立予定額）
-- ============================================================================
create table if not exists public.saving_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  entry_date date not null,
  -- to_char は immutable ではないため生成列に使えない。extract 系で 'YYYY-MM' を組み立てる
  month text generated always as (
    extract(year from entry_date)::text || '-' || lpad(extract(month from entry_date)::text, 2, '0')
  ) stored,
  amount int not null check (amount >= 0),
  -- 内訳: [{ "key": "win", "label": "勝利", "amount": 500 }, ...]
  breakdown jsonb not null default '[]'::jsonb,
  other_amount int not null default 0 check (other_amount >= 0),
  other_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saving_entries_unique_per_game unique (user_id, game_id)
);

create index if not exists saving_entries_user_date_idx
  on public.saving_entries (user_id, entry_date desc);
create index if not exists saving_entries_user_month_idx
  on public.saving_entries (user_id, month);

alter table public.saving_entries enable row level security;

drop policy if exists "saving_entries_select_own" on public.saving_entries;
create policy "saving_entries_select_own" on public.saving_entries
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "saving_entries_insert_own" on public.saving_entries;
create policy "saving_entries_insert_own" on public.saving_entries
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "saving_entries_update_own" on public.saving_entries;
create policy "saving_entries_update_own" on public.saving_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "saving_entries_delete_own" on public.saving_entries;
create policy "saving_entries_delete_own" on public.saving_entries
  for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists saving_entries_touch_updated_at on public.saving_entries;
create trigger saving_entries_touch_updated_at
  before update on public.saving_entries
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 5. monthly_savings  （月末ワンバンク入金の状態管理 / 仕様書 9章）
-- ============================================================================
create table if not exists public.monthly_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'calculating'
    check (status in ('calculating', 'ready', 'deposit_pending', 'deposited')),
  confirmed_amount int check (confirmed_amount is null or confirmed_amount >= 0),
  confirmed_at timestamptz,
  deposited_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_savings_unique_per_month unique (user_id, month)
);

alter table public.monthly_savings enable row level security;

drop policy if exists "monthly_savings_select_own" on public.monthly_savings;
create policy "monthly_savings_select_own" on public.monthly_savings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "monthly_savings_insert_own" on public.monthly_savings;
create policy "monthly_savings_insert_own" on public.monthly_savings
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "monthly_savings_update_own" on public.monthly_savings;
create policy "monthly_savings_update_own" on public.monthly_savings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "monthly_savings_delete_own" on public.monthly_savings;
create policy "monthly_savings_delete_own" on public.monthly_savings
  for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists monthly_savings_touch_updated_at on public.monthly_savings;
create trigger monthly_savings_touch_updated_at
  before update on public.monthly_savings
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 6. 既存テーブル（割り勘）の拡張
--    観戦支出との紐付けに備えてカテゴリと試合IDを追加する。
-- ============================================================================
alter table public.records
  add column if not exists category text not null default 'other',
  add column if not exists game_id uuid references public.games (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'records_category_check'
  ) then
    alter table public.records
      add constraint records_category_check
      check (category in ('ticket', 'food', 'beer', 'goods', 'transport', 'other'));
  end if;
end
$$;

create index if not exists records_user_date_idx on public.records (user_id, date desc);

-- 割り勘メンバー設定（settings）は既存構造のまま利用する。
