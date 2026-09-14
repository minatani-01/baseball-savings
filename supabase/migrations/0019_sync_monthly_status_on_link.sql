-- ============================================================================
-- Marine Wallet / 0019_sync_monthly_status_on_link
-- ----------------------------------------------------------------------------
-- マスターが確定済みの月を、接続しているアカウントにも反映する。
--
-- 確定の連動（0014 / 0018）は「マスターが確定を押した時点」でしか動かない。
-- そのため、マスターが先に確定してからあとで接続した人には月の行が作られず、
-- 画面には「この月の金額を確定する」が出たままになる。
-- 本人にとっては確定済みのはずの月なので、「入金済みにする」が出るのが正しい。
--
-- 作るのは ready まで。入金済みは実際に送金した本人しか分からないので触らない。
-- 金額は相手自身の積立額で、マスターの額は入れない。
-- すでに確定・入金まで進んでいる月は上書きしない。
-- ============================================================================
create or replace function public.sync_monthly_status_for_user(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  made int;
begin
  insert into public.monthly_savings (user_id, month, status, confirmed_amount, confirmed_at)
  select
    p_user,
    m.month,
    'ready',
    coalesce((select sum(se.amount) from public.saving_entries se
              where se.user_id = p_user and se.month = m.month), 0),
    now()
  from (
    select distinct ms.month
    from public.monthly_savings ms
    join public.profiles p on p.id = ms.user_id and p.is_master
    where ms.confirmed_amount is not null
      and ms.status in ('ready', 'deposited')
  ) m
  on conflict (user_id, month) do update
  set status = 'ready',
      confirmed_amount = excluded.confirmed_amount,
      confirmed_at = now()
  where public.monthly_savings.status = 'calculating';

  get diagnostics made = row_count;
  return made;
end;
$$;

revoke all on function public.sync_monthly_status_for_user(uuid) from public, anon;
grant execute on function public.sync_monthly_status_for_user(uuid) to authenticated;

-- 接続が成立したときに、積立と一緒に月の状態も追いつかせる
create or replace function public.marine_links_after_accept_sync_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  partner uuid;
begin
  if new.status <> 'accepted' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' then
    return null;
  end if;

  if exists (select 1 from public.profiles p where p.id = new.user_a and p.is_master) then
    partner := new.user_b;
  elsif exists (select 1 from public.profiles p where p.id = new.user_b and p.is_master) then
    partner := new.user_a;
  else
    return null;
  end if;

  perform public.sync_saving_entries_for_user(partner);
  perform public.sync_monthly_status_for_user(partner);
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 既に接続しているアカウントを追いつかせる
-- ----------------------------------------------------------------------------
do $$
declare
  u uuid;
begin
  for u in select public.saving_target_users() loop
    perform public.sync_monthly_status_for_user(u);
  end loop;
end $$;
