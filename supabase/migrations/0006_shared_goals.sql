-- ============================================================================
-- Marine Wallet / 0006_shared_goals   （仕様書 17章・31章 / Phase 4 の残り）
-- ----------------------------------------------------------------------------
-- 共同貯金。独立サービスではなく「ロッテ貯金内の機能」として扱う（仕様書 17章）。
--
--   2027 OPENING GAME TRIP
--   目標 ¥100,000
--   Account A ¥28,500 / Account B ¥31,200
--   TOTAL ¥59,700 (59.7%)
--
-- 集計ルール:
--   各アカウントの積立額は「月末に確定した月次金額」の合算とする。
--   monthly_savings.confirmed_amount（status が ready / deposit_pending / deposited）
--   を積み上げる。まだ確定していない月は合算に入れず、見込みとして別に返す。
--   確定した金額だけを共同の残高として扱うことで、
--   月内に増減する暫定値で目標の達成率が揺れないようにする。
--
-- 参照範囲:
--   共同目標のメンバーは、相手の monthly_savings の行そのものは読めない。
--   進捗は shared_goal_progress() が合計だけを返す。
--   共同目標に参加することが、必要最小限（合計額）の開示への同意になる。
--   link_permissions の 'monthly' を ON にする必要はない（あちらは明細の共有）。
--
-- 人数:
--   shared_goal_members を別テーブルにしてあるので3人以上へ拡張できる（仕様書 33章）。
--   作成の入口は今のところ1対1の Marine Link。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

-- ============================================================================
-- 1. テーブル
-- ============================================================================
create table if not exists public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  marine_link_id uuid not null references public.marine_links (id) on delete cascade,
  title text not null default '',
  target_amount int not null check (target_amount > 0),
  -- 集計対象の期間。null は「制限なし」
  start_month text check (start_month is null or start_month ~ '^[0-9]{4}-[0-9]{2}$'),
  end_month text check (end_month is null or end_month ~ '^[0-9]{4}-[0-9]{2}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shared_goals_month_order
    check (start_month is null or end_month is null or start_month <= end_month)
);

create index if not exists shared_goals_link_idx on public.shared_goals (marine_link_id);

alter table public.shared_goals enable row level security;

create table if not exists public.shared_goal_members (
  id uuid primary key default gen_random_uuid(),
  shared_goal_id uuid not null references public.shared_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint shared_goal_members_uniq unique (shared_goal_id, user_id)
);

create index if not exists shared_goal_members_user_idx
  on public.shared_goal_members (user_id);

alter table public.shared_goal_members enable row level security;

-- ============================================================================
-- 2. 判定関数
-- ----------------------------------------------------------------------------
-- shared_goal_members の RLS から自分自身を参照すると再帰するため、
-- ここだけ security definer にして「呼び出し元がそのゴールのメンバーか」だけを返す。
-- ============================================================================
create or replace function public.is_shared_goal_member(p_goal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_goal_members m
    where m.shared_goal_id = p_goal_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_shared_goal_member(uuid) from public, anon;
grant execute on function public.is_shared_goal_member(uuid) to authenticated;

-- ============================================================================
-- 3. RLS
-- ----------------------------------------------------------------------------
-- 参照はメンバーのみ。作成は RPC 経由（両者をメンバーに入れる必要があるため）。
-- 金額や期間の変更はメンバーなら可、削除は作成者のみ。
-- ============================================================================
drop policy if exists "shared_goals_select_member" on public.shared_goals;
create policy "shared_goals_select_member" on public.shared_goals
  for select to authenticated
  using (public.is_shared_goal_member(id));

drop policy if exists "shared_goals_update_member" on public.shared_goals;
create policy "shared_goals_update_member" on public.shared_goals
  for update to authenticated
  using (public.is_shared_goal_member(id))
  with check (public.is_shared_goal_member(id));

drop policy if exists "shared_goals_delete_creator" on public.shared_goals;
create policy "shared_goals_delete_creator" on public.shared_goals
  for delete to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "shared_goal_members_select_member" on public.shared_goal_members;
create policy "shared_goal_members_select_member" on public.shared_goal_members
  for select to authenticated
  using (public.is_shared_goal_member(shared_goal_id));

-- 自分の参加を取り消す（抜ける）ことだけは直接できる
drop policy if exists "shared_goal_members_delete_self" on public.shared_goal_members;
create policy "shared_goal_members_delete_self" on public.shared_goal_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists shared_goals_touch_updated_at on public.shared_goals;
create trigger shared_goals_touch_updated_at
  before update on public.shared_goals
  for each row execute function public.touch_updated_at();

-- 作成者と接続は後から書き換えさせない
create or replace function public.guard_shared_goal_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.marine_link_id := old.marine_link_id;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists shared_goals_guard_update on public.shared_goals;
create trigger shared_goals_guard_update
  before update on public.shared_goals
  for each row execute function public.guard_shared_goal_update();

-- ============================================================================
-- 4. 作成 RPC
-- ----------------------------------------------------------------------------
-- 接続の両者をメンバーに入れる必要があり、相手ぶんの shared_goal_members は
-- 自分では insert できない。security definer でまとめて作る。
-- ============================================================================
create or replace function public.create_shared_goal(
  p_link_id uuid,
  p_title text,
  p_target_amount int,
  p_start_month text default null,
  p_end_month text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  link public.marine_links;
  new_id uuid;
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception '目標の名前を入力してください';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception '目標金額は1円以上で入力してください';
  end if;

  select * into link from public.marine_links l where l.id = p_link_id;

  if not found then
    raise exception '接続が見つかりません';
  end if;

  if link.status <> 'accepted' then
    raise exception '接続が完了していません';
  end if;

  if me <> link.user_a and me <> link.user_b then
    raise exception 'この接続の当事者ではありません';
  end if;

  insert into public.shared_goals
    (marine_link_id, title, target_amount, start_month, end_month, created_by)
  values
    (p_link_id, trim(p_title), p_target_amount,
     nullif(trim(coalesce(p_start_month, '')), ''),
     nullif(trim(coalesce(p_end_month, '')), ''),
     me)
  returning id into new_id;

  insert into public.shared_goal_members (shared_goal_id, user_id)
  values (new_id, link.user_a), (new_id, link.user_b)
  on conflict (shared_goal_id, user_id) do nothing;

  return new_id;
end;
$$;

revoke all on function public.create_shared_goal(uuid, text, int, text, text) from public, anon;
grant execute on function public.create_shared_goal(uuid, text, int, text, text) to authenticated;

-- ============================================================================
-- 5. 進捗 RPC
-- ----------------------------------------------------------------------------
-- メンバーごとの「確定済み合計」と「未確定の見込み」を返す。行の明細は返さない。
--
--   confirmed  月末に確定した monthly_savings.confirmed_amount の合計
--   pending    まだ確定していない月の saving_entries の合計（見込み）
--
-- 期間が指定されていればその範囲だけを対象にする（'YYYY-MM' の辞書順で比較できる）。
-- ============================================================================
create or replace function public.shared_goal_progress(p_goal_id uuid)
returns table (
  user_id uuid,
  display_name text,
  marine_id text,
  confirmed bigint,
  pending bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal public.shared_goals;
begin
  if not public.is_shared_goal_member(p_goal_id) then
    raise exception 'この共同目標のメンバーではありません';
  end if;

  select * into goal from public.shared_goals g where g.id = p_goal_id;

  return query
  select
    m.user_id,
    coalesce(p.display_name, '') as display_name,
    coalesce(p.marine_id, '') as marine_id,
    coalesce((
      select sum(ms.confirmed_amount)::bigint
      from public.monthly_savings ms
      where ms.user_id = m.user_id
        and ms.confirmed_amount is not null
        and ms.status in ('ready', 'deposit_pending', 'deposited')
        and (goal.start_month is null or ms.month >= goal.start_month)
        and (goal.end_month is null or ms.month <= goal.end_month)
    ), 0) as confirmed,
    coalesce((
      select sum(se.amount)::bigint
      from public.saving_entries se
      where se.user_id = m.user_id
        and (goal.start_month is null or se.month >= goal.start_month)
        and (goal.end_month is null or se.month <= goal.end_month)
        and not exists (
          select 1 from public.monthly_savings ms2
          where ms2.user_id = m.user_id
            and ms2.month = se.month
            and ms2.confirmed_amount is not null
            and ms2.status in ('ready', 'deposit_pending', 'deposited')
        )
    ), 0) as pending
  from public.shared_goal_members m
  left join public.profiles p on p.id = m.user_id
  where m.shared_goal_id = p_goal_id
  order by m.created_at;
end;
$$;

revoke all on function public.shared_goal_progress(uuid) from public, anon;
grant execute on function public.shared_goal_progress(uuid) to authenticated;
