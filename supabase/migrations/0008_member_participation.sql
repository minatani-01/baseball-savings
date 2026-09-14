-- ============================================================================
-- Marine Wallet / 0008_member_participation
-- ----------------------------------------------------------------------------
-- メンバーを「割り勘だけの登場人物」から、アプリ共通の登場人物へ広げる。
-- メンバー画面だけで、Marine ID と、割り勘・貯金それぞれへの参加可否を決められるようにする。
--
--   Marine ID   入力（MW-XXXXXX）。接続済みのアカウントと突き合わせる鍵
--   割り勘       参加する / しない
--   貯金         参加する / しない（総累計貯金額の集計対象になる）
--
-- 既存データの扱い:
--   これまでのメンバーはすべて割り勘の参加者なので join_split は既定 true。
--   貯金は明示的に選ぶものなので join_saving は既定 false。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

alter table public.split_members
  add column if not exists join_split boolean not null default true,
  add column if not exists join_saving boolean not null default false;

comment on column public.split_members.join_split is
  '割り勘に参加するか。false のメンバーは割り勘の分担先の候補に出ない。';
comment on column public.split_members.join_saving is
  '貯金に参加するか。true かつ Marine ID が接続済みなら、総累計貯金額の集計に入る。';

-- ============================================================================
-- 割り勘の共有条件に「割り勘に参加している」を足す
-- ----------------------------------------------------------------------------
-- 0007 の条件に join_split を加える。割り勘から外したメンバーの Marine ID が
-- 残っていても、そのアカウントには何も見せない。
-- ============================================================================
create or replace function public.split_record_shared_with_me(p_owner uuid, p_shares jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_owner <> (select auth.uid())
    and public.marine_link_allows(p_owner, 'split')
    and exists (
      select 1
      from public.split_members sm
      join public.profiles me on me.id = (select auth.uid())
      where sm.user_id = p_owner
        and sm.join_split
        and sm.marine_id is not null
        and upper(btrim(sm.marine_id)) = upper(btrim(me.marine_id))
        and exists (
          select 1
          from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) s
          where s->>'member' = sm.name
        )
    );
$$;

-- ============================================================================
-- 貯金の参加者ごとの累計
-- ----------------------------------------------------------------------------
-- 「累計貯金額」は月末に確定した月次金額の合計とする（今月など未確定の月は含めない）。
-- 自分の分と、貯金に参加していて Marine ID が接続済みのメンバーの分を返す。
--
--   confirmed  月末に確定した monthly_savings.confirmed_amount の合計
--   pending    まだ確定していない月の saving_entries の合計（見込み。累計には入れない）
--
-- 相手の明細は返さず合計だけを返す。相手が貯金を共有していない場合は
-- is_visible=false で返し、0円と区別できるようにする。
-- ============================================================================
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

  -- 自分
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
        and ms.status in ('ready', 'deposit_pending', 'deposited')
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
            and ms2.status in ('ready', 'deposit_pending', 'deposited')
        )
    ), 0);

  -- 貯金に参加していて、Marine ID が接続済みのアカウントに解決できるメンバー
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
        and ms.status in ('ready', 'deposit_pending', 'deposited')
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
            and ms2.status in ('ready', 'deposit_pending', 'deposited')
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

revoke all on function public.saving_circle_totals() from public, anon;
grant execute on function public.saving_circle_totals() to authenticated;
