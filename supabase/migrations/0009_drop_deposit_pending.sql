-- ============================================================================
-- Marine Wallet / 0009_drop_deposit_pending
-- ----------------------------------------------------------------------------
-- 月末フローから「入金手続き中（deposit_pending）」を外す。
--
--   変更前: calculating -> ready -> deposit_pending -> deposited
--   変更後: calculating -> ready -> deposited
--
-- 実際の入金はワンバンク側で一度に終わるため、間に「手続き中」を挟んでも
-- 押す手間が増えるだけで、状態として意味を持たなかった。
--
-- 既存データ: 適用時点で deposit_pending の行は0件だが、
-- 冪等性のため deposited へ寄せてから CHECK を張り替える。
-- 手続き中まで進んでいた月は「入金した」と見なすのが実態に近い。
-- ============================================================================

update public.monthly_savings
set status = 'deposited',
    deposited_at = coalesce(deposited_at, now())
where status = 'deposit_pending';

alter table public.monthly_savings
  drop constraint if exists monthly_savings_status_check;

alter table public.monthly_savings
  add constraint monthly_savings_status_check
  check (status in ('calculating', 'ready', 'deposited'));

-- ============================================================================
-- 確定判定から deposit_pending を外す
-- ----------------------------------------------------------------------------
-- 累計貯金額と共同貯金の集計は「月末に確定した月」を数える。
-- 状態が減ったので、参照している2つの関数も合わせて張り替える。
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
        and ms.status in ('ready', 'deposited')
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
            and ms2.status in ('ready', 'deposited')
        )
    ), 0) as pending
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
    coalesce((
      select sum(ms.confirmed_amount)::bigint
      from public.monthly_savings ms
      where ms.user_id = me
        and ms.confirmed_amount is not null
        and ms.status in ('ready', 'deposited')
    ), 0),
    coalesce((
      select sum(se.amount)::bigint
      from public.saving_entries se
      where se.user_id = me
        and not exists (
          select 1 from public.monthly_savings ms2
          where ms2.user_id = me
            and ms2.month = se.month
            and ms2.confirmed_amount is not null
            and ms2.status in ('ready', 'deposited')
        )
    ), 0);

  return query
  select
    sm.name::text,
    sm.marine_id::text,
    false,
    public.marine_link_allows(p.id, 'saving'),
    case when public.marine_link_allows(p.id, 'saving') then coalesce((
      select sum(ms.confirmed_amount)::bigint
      from public.monthly_savings ms
      where ms.user_id = p.id
        and ms.confirmed_amount is not null
        and ms.status in ('ready', 'deposited')
    ), 0) else 0::bigint end,
    case when public.marine_link_allows(p.id, 'saving') then coalesce((
      select sum(se.amount)::bigint
      from public.saving_entries se
      where se.user_id = p.id
        and not exists (
          select 1 from public.monthly_savings ms2
          where ms2.user_id = p.id
            and ms2.month = se.month
            and ms2.confirmed_amount is not null
            and ms2.status in ('ready', 'deposited')
        )
    ), 0) else 0::bigint end
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
