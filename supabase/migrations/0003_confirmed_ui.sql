-- ============================================================================
-- Marine Wallet / 0003_confirmed_ui
-- ----------------------------------------------------------------------------
-- 確定UIに合わせたスキーマ拡張。
--
--   1. 打撃・投手ボーナスの項目追加（マルチ安打 / 打点 / 勝利投手）
--      旧アプリ由来の満塁HR・完投・ノーヒットノーラン・完全試合はそのまま残す
--   2. カスタム貯金（試合に紐づかない任意金額の積立）
--   3. 月間の目標金額
--   4. 割り勘メンバーを人数無制限へ（split_members / member_count の上限撤廃）
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

-- ============================================================================
-- 1. games: 打撃・投手の追加項目
-- ============================================================================
alter table public.games
  add column if not exists multi_hits int not null default 0,
  add column if not exists rbi int not null default 0,
  add column if not exists is_winning_pitcher boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_multi_hits_check') then
    alter table public.games add constraint games_multi_hits_check check (multi_hits >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_rbi_check') then
    alter table public.games add constraint games_rbi_check check (rbi >= 0);
  end if;
end
$$;

-- ============================================================================
-- 2. saving_rules: 追加ボーナスと月間目標
-- ============================================================================
alter table public.saving_rules
  add column if not exists multi_hit_amount int not null default 100,
  add column if not exists rbi_amount int not null default 100,
  add column if not exists winning_pitcher_amount int not null default 200,
  add column if not exists monthly_goal_amount int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saving_rules_extra_amounts_check') then
    alter table public.saving_rules add constraint saving_rules_extra_amounts_check check (
      multi_hit_amount >= 0 and rbi_amount >= 0
      and winning_pitcher_amount >= 0 and monthly_goal_amount >= 0
    );
  end if;
end
$$;

-- ============================================================================
-- 3. saving_entries: カスタム貯金
--    kind = 'game'   … 共通 games に紐づく積立（game_id 必須）
--    kind = 'custom' … 試合に紐づかない任意積立（game_id は null、title に内容）
-- ============================================================================
alter table public.saving_entries alter column game_id drop not null;

alter table public.saving_entries
  add column if not exists kind text not null default 'game',
  add column if not exists title text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saving_entries_kind_check') then
    alter table public.saving_entries add constraint saving_entries_kind_check
      check (kind in ('game', 'custom'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saving_entries_kind_game_id_check') then
    alter table public.saving_entries add constraint saving_entries_kind_game_id_check
      check (
        (kind = 'game' and game_id is not null)
        or (kind = 'custom' and game_id is null)
      );
  end if;
end
$$;

-- unique (user_id, game_id) は game_id が null の行を重複扱いしないため、
-- カスタム貯金は同一ユーザーで何件でも登録できる。

-- ============================================================================
-- 4. 割り勘メンバーを人数無制限へ
-- ============================================================================
create table if not exists public.split_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_self boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_members_name_not_blank check (length(btrim(name)) > 0),
  constraint split_members_unique_name unique (user_id, name)
);

create index if not exists split_members_user_order_idx
  on public.split_members (user_id, sort_order, created_at);

alter table public.split_members enable row level security;

drop policy if exists "split_members_select_own" on public.split_members;
create policy "split_members_select_own" on public.split_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "split_members_insert_own" on public.split_members;
create policy "split_members_insert_own" on public.split_members
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "split_members_update_own" on public.split_members;
create policy "split_members_update_own" on public.split_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "split_members_delete_own" on public.split_members;
create policy "split_members_delete_own" on public.split_members
  for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists split_members_touch_updated_at on public.split_members;
create trigger split_members_touch_updated_at
  before update on public.split_members
  for each row execute function public.touch_updated_at();

-- records.member_count の 2|3 上限を撤廃する
alter table public.records drop constraint if exists records_member_count_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'records_member_count_min_check') then
    alter table public.records add constraint records_member_count_min_check
      check (member_count >= 2);
  end if;
end
$$;

-- ============================================================================
-- 5. 既存データから split_members を初期化
--    settings（メンバーA/B/C）と、既存 records の決済者・負担者名の両方から拾う。
-- ============================================================================
insert into public.split_members (user_id, name, sort_order)
select s.user_id, m.name, m.sort_order
from public.settings s
cross join lateral (values (s.member_a, 0), (s.member_b, 1), (s.member_c, 2)) as m(name, sort_order)
where s.user_id is not null and m.name is not null and length(btrim(m.name)) > 0
on conflict (user_id, name) do nothing;

insert into public.split_members (user_id, name, sort_order)
select distinct r.user_id, btrim(r.payer), 10
from public.records r
where r.payer is not null and length(btrim(r.payer)) > 0
on conflict (user_id, name) do nothing;

insert into public.split_members (user_id, name, sort_order)
select distinct r.user_id, btrim(sh.value ->> 'member'), 20
from public.records r
cross join lateral jsonb_array_elements(coalesce(r.shares, '[]'::jsonb)) as sh(value)
where sh.value ->> 'member' is not null and length(btrim(sh.value ->> 'member')) > 0
on conflict (user_id, name) do nothing;
