-- ============================================================================
-- Marine Wallet / 0007_split_member_marine_id
-- ----------------------------------------------------------------------------
-- 割り勘メンバーに Marine ID を持たせ、登録があるメンバーが参加している割り勘だけを
-- そのアカウントへ共有する。
--
-- これまでの割り勘の共有は接続単位（link_permissions の 'split'）で、ONにすると
-- 自分の割り勘が全部見えていた。実際に見せたいのは「その人が参加している割り勘」
-- だけなので、メンバーの Marine ID を突き合わせて行単位まで絞る。
--
-- 共有される条件（3つすべてを満たすときだけ）:
--   1. 相手と Marine Link が accepted になっている
--   2. 自分の link_permissions の 'split' が ON（接続ごとの大元のスイッチ。既定ON）
--   3. その割り勘の参加者に、marine_id が相手と一致する split_members がいる
--
-- 1と2は「この相手に割り勘を見せてよいか」、3は「どの割り勘を見せるか」。
-- 接続していない相手の Marine ID を登録しても何も起きない（勝手に送りつけられない）。
--
-- shares が null の古い行は参加者を特定できないため共有対象にならない。
-- 共有は SELECT のみで、相手が書き換える経路は作らない。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

alter table public.split_members
  add column if not exists marine_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'split_members_marine_id_format') then
    alter table public.split_members
      add constraint split_members_marine_id_format
      check (marine_id is null or marine_id ~ '^MW-[0-9A-Z]{6}$');
  end if;
end $$;

comment on column public.split_members.marine_id is
  'このメンバーの Marine ID。登録すると、そのアカウントと接続済みの場合に、
   このメンバーが参加している割り勘が相手から閲覧できるようになる。';

create index if not exists split_members_marine_id_idx
  on public.split_members (marine_id) where marine_id is not null;

-- ============================================================================
-- 判定関数
-- ----------------------------------------------------------------------------
-- 呼び出し元（閲覧者）の marine_id と、所有者の split_members を突き合わせる。
-- 閲覧者は他人の split_members を読めないので security definer にする。
-- 返すのは真偽値だけで、メンバーの一覧は外に出さない。
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
        and sm.marine_id is not null
        and upper(btrim(sm.marine_id)) = upper(btrim(me.marine_id))
        and exists (
          select 1
          from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) s
          where s->>'member' = sm.name
        )
    );
$$;

revoke all on function public.split_record_shared_with_me(uuid, jsonb) from public, anon;
grant execute on function public.split_record_shared_with_me(uuid, jsonb) to authenticated;

-- ============================================================================
-- 割り勘の共有ポリシーを差し替える
-- ----------------------------------------------------------------------------
-- 0005 の records_select_linked は「接続 + 権限ON」で全件を見せていた。
-- メンバー単位の突き合わせを足した新しいポリシーへ置き換える。
-- ============================================================================
drop policy if exists "records_select_linked" on public.records;

drop policy if exists "records_select_shared_member" on public.records;
create policy "records_select_shared_member" on public.records
  for select to authenticated
  using (
    user_id <> (select auth.uid())
    and public.split_record_shared_with_me(user_id, shares)
  );
