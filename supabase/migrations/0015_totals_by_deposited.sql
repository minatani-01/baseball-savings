-- ============================================================================
-- Marine Wallet / 0015_totals_by_deposited
-- ----------------------------------------------------------------------------
-- 累計貯金額の基準を「月末に確定した月」から「ワンバンクへ入金した月」に変える。
--
-- 確定は金額を締めただけで、手元からはまだ動いていない。実際に貯まった額は
-- 入金した分だけなので、累計は deposited を数える。
-- アプリ側は lib/insights.ts の depositedTotal に定義を集約しており、
-- 相手ぶんを合算する2つの関数もここで揃える（画面ごとに基準がずれないように）。
--
-- 未入金は「確定済み（ready）の確定額 ＋ 未確定の月の積立予定額」。
-- 確定した月を積立予定額で数え直すと、月末に金額を締めた意味が無くなるため。
-- ============================================================================
-- ----------------------------------------------------------------------------
-- 集計の定義をDB側でも1か所にまとめる（lib/insights.ts と同じ規則）
-- ----------------------------------------------------------------------------
-- security invoker のまま。呼び出し元（definer の集計関数）の権限で動く。
create or replace function public.deposited_total_for(p_user uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(ms.confirmed_amount), 0)::bigint
  from public.monthly_savings ms
  where ms.user_id = p_user
    and ms.confirmed_amount is not null
    and ms.status = 'deposited';
$$;

create or replace function public.not_deposited_total_for(p_user uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((
      select sum(ms.confirmed_amount)
      from public.monthly_savings ms
      where ms.user_id = p_user
        and ms.confirmed_amount is not null
        and ms.status = 'ready'
    ), 0)::bigint
    + coalesce((
      select sum(se.amount)
      from public.saving_entries se
      where se.user_id = p_user
        and not exists (
          select 1 from public.monthly_savings ms2
          where ms2.user_id = p_user
            and ms2.month = se.month
            and ms2.confirmed_amount is not null
            and ms2.status in ('ready', 'deposited')
        )
    ), 0)::bigint;
$$;

revoke all on function public.deposited_total_for(uuid) from public, anon;
revoke all on function public.not_deposited_total_for(uuid) from public, anon;
grant execute on function public.deposited_total_for(uuid) to authenticated;
grant execute on function public.not_deposited_total_for(uuid) to authenticated;

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
        and ms.status = 'deposited'
        and (goal.start_month is null or ms.month >= goal.start_month)
        and (goal.end_month is null or ms.month <= goal.end_month)
    ), 0) as confirmed,
    (
      coalesce((
        select sum(ms.confirmed_amount)::bigint
        from public.monthly_savings ms
        where ms.user_id = m.user_id
          and ms.confirmed_amount is not null
          and ms.status = 'ready'
          and (goal.start_month is null or ms.month >= goal.start_month)
          and (goal.end_month is null or ms.month <= goal.end_month)
      ), 0)
      + coalesce((
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
              and ms2.status in ('ready', 'deposited')
          )
      ), 0)
    ) as pending
  from public.shared_goal_members m
  left join public.profiles p on p.id = m.user_id
  where m.shared_goal_id = p_goal_id
  order by m.created_at;
end;
$$;

create or replace function public.saving_circle_totals()
returns table (
  member_name text,
  marine_id text,
  is_self boolean,
  is_visible boolean,
  confirmed bigint,
  pending bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;

  return query
  select
    coalesce((select p.display_name from public.profiles p where p.id = me), '')::text,
    coalesce((select p.marine_id from public.profiles p where p.id = me), '')::text,
    true,
    true,
    public.deposited_total_for(me),
    public.not_deposited_total_for(me);

  return query
  select
    sm.name::text,
    sm.marine_id::text,
    false,
    public.marine_link_allows(p.id, 'saving'),
    case when public.marine_link_allows(p.id, 'saving')
      then public.deposited_total_for(p.id) else 0::bigint end,
    case when public.marine_link_allows(p.id, 'saving')
      then public.not_deposited_total_for(p.id) else 0::bigint end
  from public.split_members sm
  join public.profiles p
    on upper(btrim(p.marine_id)) = upper(btrim(sm.marine_id))
  where sm.user_id = me
    and sm.join_saving
    and sm.marine_id is not null
    and p.id <> me
    and exists (
      select 1 from public.marine_links l
      where l.status = 'accepted'
        and ((l.user_a = me and l.user_b = p.id) or (l.user_b = me and l.user_a = p.id))
    )
  order by sm.sort_order, sm.created_at;
end;
$$;
