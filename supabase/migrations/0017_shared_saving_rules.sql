-- ============================================================================
-- Marine Wallet / 0017_shared_saving_rules
-- ----------------------------------------------------------------------------
-- 貯金ルールを全アカウント共通にする。
--
-- これまでは saving_rules がユーザーごとの行だった（仕様書15章の「貯金ルールは個人」）。
-- 運用では「同じルールでみんなが貯める」ため、ルールは1つだけ持つ。
-- 共有設定の「貯金ルール」も意味が変わる。
--
--   変更前: 自分のルールを相手に見せるか（見せるだけ。画面では使っていなかった）
--   変更後: 相手に共通ルールの変更を許可するか
--
-- 実体は1行だけのテーブルにする。マスターの行を正とする案もあるが、
-- マスターが複数になった途端どれが正か決まらなくなるので、行そのものを1つに固定する。
-- 初期値は現在のマスターの行から引き継ぐ（無ければ既定値）。
--
-- 読み取りはログイン中の全員。変更できるのはマスターと、
-- マスターが接続の共有設定で「貯金ルール」をONにした相手だけ。
-- ============================================================================

create table if not exists public.saving_rule_settings (
  -- 1行しか作れないようにする
  id boolean primary key default true check (id),

  win_amount int not null default 500,
  draw_amount int not null default 200,
  lose_amount int not null default 0,
  sayonara_bonus int not null default 500,
  home_run_amount int not null default 200,
  grand_slam_amount int not null default 500,
  multi_hit_amount int not null default 100,
  rbi_amount int not null default 100,
  perfect_game_amount int not null default 5000,
  no_hitter_amount int not null default 3000,
  shutout_amount int not null default 500,
  complete_game_amount int not null default 100,
  quality_start_amount int not null default 200,
  winning_pitcher_amount int not null default 200,
  save_amount int not null default 100,
  multiplier_regular numeric(4, 2) not null default 1.0,
  multiplier_interleague numeric(4, 2) not null default 1.0,
  multiplier_cs numeric(4, 2) not null default 1.2,
  multiplier_nippon_series numeric(4, 2) not null default 1.5,
  annual_goal_amount int not null default 0,

  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saving_rule_settings_amounts_check check (
    win_amount >= 0 and draw_amount >= 0 and lose_amount >= 0 and sayonara_bonus >= 0
    and home_run_amount >= 0 and grand_slam_amount >= 0 and multi_hit_amount >= 0
    and rbi_amount >= 0 and perfect_game_amount >= 0 and no_hitter_amount >= 0
    and shutout_amount >= 0 and complete_game_amount >= 0 and quality_start_amount >= 0
    and winning_pitcher_amount >= 0 and save_amount >= 0 and annual_goal_amount >= 0
  )
);

-- 現在のマスターの設定を引き継ぐ。マスターが未設定なら既定値のまま
insert into public.saving_rule_settings (
  id, win_amount, draw_amount, lose_amount, sayonara_bonus, home_run_amount,
  grand_slam_amount, multi_hit_amount, rbi_amount, perfect_game_amount, no_hitter_amount,
  shutout_amount, complete_game_amount, quality_start_amount, winning_pitcher_amount,
  save_amount, multiplier_regular, multiplier_interleague, multiplier_cs,
  multiplier_nippon_series, annual_goal_amount, updated_by
)
select
  true, r.win_amount, r.draw_amount, r.lose_amount, r.sayonara_bonus, r.home_run_amount,
  r.grand_slam_amount, r.multi_hit_amount, r.rbi_amount, r.perfect_game_amount, r.no_hitter_amount,
  r.shutout_amount, r.complete_game_amount, r.quality_start_amount, r.winning_pitcher_amount,
  r.save_amount, r.multiplier_regular, r.multiplier_interleague, r.multiplier_cs,
  r.multiplier_nippon_series, r.annual_goal_amount, r.user_id
from public.saving_rules r
join public.profiles p on p.id = r.user_id and p.is_master
limit 1
on conflict (id) do nothing;

-- マスターの行が無くても、必ず1行は存在させる
insert into public.saving_rule_settings (id) values (true) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 変更できる人
-- ----------------------------------------------------------------------------
-- マスター本人か、マスターとの接続で「貯金ルール」をONにされた相手。
-- link_permissions.owner_id は「共有する側」なので、
-- マスターがONにした行（owner=マスター）を許可の根拠にする。
create or replace function public.can_edit_saving_rules()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select p.is_master from public.profiles p where p.id = (select auth.uid())), false)
    or exists (
      select 1
      from public.marine_links l
      join public.profiles m
        on m.id = case when l.user_a = (select auth.uid()) then l.user_b else l.user_a end
      join public.link_permissions lp
        on lp.marine_link_id = l.id and lp.owner_id = m.id
      where l.status = 'accepted'
        and (select auth.uid()) in (l.user_a, l.user_b)
        and m.is_master
        and lp.resource_type = 'saving_rules'
        and lp.permission
    );
$$;

revoke all on function public.can_edit_saving_rules() from public, anon;
grant execute on function public.can_edit_saving_rules() to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.saving_rule_settings enable row level security;

-- 共通ルールなので読み取りは全員。積立額の計算に必要
drop policy if exists "saving_rule_settings_select_all" on public.saving_rule_settings;
create policy "saving_rule_settings_select_all" on public.saving_rule_settings
  for select to authenticated using (true);

drop policy if exists "saving_rule_settings_update_allowed" on public.saving_rule_settings;
create policy "saving_rule_settings_update_allowed" on public.saving_rule_settings
  for update to authenticated
  using (public.can_edit_saving_rules())
  with check (public.can_edit_saving_rules());

-- 行は1つだけ。増やさせない（insert / delete は誰にも開けない）

drop trigger if exists saving_rule_settings_touch_updated_at on public.saving_rule_settings;
create trigger saving_rule_settings_touch_updated_at
  before update on public.saving_rule_settings
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 個人のルールは廃止する
-- ----------------------------------------------------------------------------
-- 残しておくと「どちらが本当のルールか」が画面ごとにぶれる。
-- マスター以外は行を持っていないため、失われるデータは無い。
drop table if exists public.saving_rules;
