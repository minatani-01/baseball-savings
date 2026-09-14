-- ============================================================================
-- Marine Wallet / 0005_marine_link   （仕様書 13章・14章・33章 / Phase 4）
-- ----------------------------------------------------------------------------
-- Marine ID でアカウント同士を接続し、リソース単位の権限に従ってデータを共有する。
--
--   Marine ID入力 -> 共有リクエスト -> 相手が承認 -> CONNECTED   （仕様書 13.2）
--
-- 仕様書 33章からの設計上の追加:
--   仕様書の link_permissions は (marine_link_id, resource_type, permission) だが、
--   共有は本質的に「方向」を持つ。A が B に見せるものと B が A に見せるものは別なので、
--   owner_id（共有する側）を加えて 1接続 × 2方向 × リソース種別 で権限を持つ。
--   これがないと「AはBに貯金を見せるが、BはAに見せない」を表現できない。
--
-- 権限対象は現時点で実装済みのリソースのみ:
--   saving       ロッテ貯金（積立の明細と合計）
--   saving_rules 貯金ルール
--   monthly      月末入金状況
--   split        割り勘
--   観戦情報 / Marine Day / Beer Log / 共同目標 は Phase 5 以降で追加する。
--
-- 試合データ（games）は仕様書 15章のとおり全ユーザー共通なので権限対象にしない。
-- 「試合結果は共有、貯金ルールは個人」の原則は Phase 4 でも変えない。
--
-- 冪等性: 何度実行しても安全。
-- ============================================================================

-- ============================================================================
-- 1. marine_links   （接続そのもの）
-- ============================================================================
create table if not exists public.marine_links (
  id uuid primary key default gen_random_uuid(),
  -- user_a = リクエストを送った側、user_b = 受け取った側
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marine_links_not_self check (user_a <> user_b)
);

-- 同じ2人の組み合わせは向きに関係なく1本だけ
create unique index if not exists marine_links_pair_uniq
  on public.marine_links (least(user_a, user_b), greatest(user_a, user_b));

create index if not exists marine_links_user_a_idx on public.marine_links (user_a);
create index if not exists marine_links_user_b_idx on public.marine_links (user_b);

alter table public.marine_links enable row level security;

-- ============================================================================
-- 2. link_permissions   （どちらが何を見せるか）
-- ============================================================================
create table if not exists public.link_permissions (
  id uuid primary key default gen_random_uuid(),
  marine_link_id uuid not null references public.marine_links (id) on delete cascade,
  -- owner_id = 共有する側。相手はこの行が true のリソースだけを見られる
  owner_id uuid not null references auth.users (id) on delete cascade,
  resource_type text not null
    check (resource_type in ('saving', 'saving_rules', 'monthly', 'split')),
  permission boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint link_permissions_uniq unique (marine_link_id, owner_id, resource_type)
);

create index if not exists link_permissions_owner_idx
  on public.link_permissions (owner_id, resource_type) where permission;

alter table public.link_permissions enable row level security;

-- ============================================================================
-- 3. 判定関数
-- ----------------------------------------------------------------------------
-- どちらも security invoker のままでよい。marine_links / link_permissions の
-- *_select_party ポリシーが「呼び出し元が当事者である行」だけを見せるので、
-- 呼び出し元の権限で評価しても判定結果は変わらない。
-- 相互再帰も起きない（marine_links のポリシーは他テーブルを参照しない）。
-- ============================================================================

-- 呼び出し元と other_id の間に接続が存在するか（pending も含む）。
-- pending を含めるのは、承認前でも「誰から来たリクエストか」を表示する必要があるため。
create or replace function public.marine_link_exists(other_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.marine_links l
    where l.status in ('pending', 'accepted')
      and (
        (l.user_a = (select auth.uid()) and l.user_b = other_id) or
        (l.user_b = (select auth.uid()) and l.user_a = other_id)
      )
  );
$$;

-- p_owner が呼び出し元に p_resource を共有しているか。
-- 接続が accepted で、かつ owner 側の権限が true のときだけ true。
-- 引数名を p_ 始まりにしているのは、列名 owner_id と衝突させないため。
create or replace function public.marine_link_allows(p_owner uuid, p_resource text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.marine_links l
    join public.link_permissions p
      on p.marine_link_id = l.id
     and p.owner_id = p_owner
     and p.resource_type = p_resource
     and p.permission
    where l.status = 'accepted'
      and (
        (l.user_a = p_owner and l.user_b = (select auth.uid())) or
        (l.user_b = p_owner and l.user_a = (select auth.uid()))
      )
  );
$$;

-- 未ログイン（anon）から呼べる必要はない。RLS の評価は authenticated で走る。
revoke all on function public.marine_link_exists(uuid) from public, anon;
revoke all on function public.marine_link_allows(uuid, text) from public, anon;
grant execute on function public.marine_link_exists(uuid) to authenticated;
grant execute on function public.marine_link_allows(uuid, text) to authenticated;

-- ============================================================================
-- 4. marine_links の RLS
-- ============================================================================
drop policy if exists "marine_links_select_party" on public.marine_links;
create policy "marine_links_select_party" on public.marine_links
  for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- 挿入は request_marine_link() 経由が前提だが、直接insertも自分発のものだけは許す
drop policy if exists "marine_links_insert_self" on public.marine_links;
create policy "marine_links_insert_self" on public.marine_links
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and user_a = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists "marine_links_update_party" on public.marine_links;
create policy "marine_links_update_party" on public.marine_links
  for update to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()))
  with check (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- 解除・キャンセルはどちらからでも
drop policy if exists "marine_links_delete_party" on public.marine_links;
create policy "marine_links_delete_party" on public.marine_links
  for delete to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- 承認できるのはリクエストを受け取った側だけ。
-- RLS だけでは「自分で送って自分で承認」を防げないのでトリガーで止める。
create or replace function public.guard_marine_link_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception '応答済みの接続リクエストは変更できません';
    end if;
    if new.status in ('accepted', 'rejected')
       and (select auth.uid()) = old.requested_by then
      raise exception '自分が送った接続リクエストは自分では承認できません';
    end if;
    new.responded_at := now();
  end if;

  -- 当事者と申請者は後から書き換えさせない
  new.user_a := old.user_a;
  new.user_b := old.user_b;
  new.requested_by := old.requested_by;

  return new;
end;
$$;

drop trigger if exists marine_links_guard_transition on public.marine_links;
create trigger marine_links_guard_transition
  before update on public.marine_links
  for each row execute function public.guard_marine_link_transition();

drop trigger if exists marine_links_touch_updated_at on public.marine_links;
create trigger marine_links_touch_updated_at
  before update on public.marine_links
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 5. link_permissions の RLS
-- ----------------------------------------------------------------------------
-- 読み取りは当事者の双方（相手が自分に何を見せているか分かるようにする）。
-- 書き換えは owner 本人だけ。
-- ============================================================================
drop policy if exists "link_permissions_select_party" on public.link_permissions;
create policy "link_permissions_select_party" on public.link_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.marine_links l
      where l.id = link_permissions.marine_link_id
        and (l.user_a = (select auth.uid()) or l.user_b = (select auth.uid()))
    )
  );

drop policy if exists "link_permissions_insert_owner" on public.link_permissions;
create policy "link_permissions_insert_owner" on public.link_permissions
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.marine_links l
      where l.id = link_permissions.marine_link_id
        and (l.user_a = (select auth.uid()) or l.user_b = (select auth.uid()))
    )
  );

drop policy if exists "link_permissions_update_owner" on public.link_permissions;
create policy "link_permissions_update_owner" on public.link_permissions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop trigger if exists link_permissions_touch_updated_at on public.link_permissions;
create trigger link_permissions_touch_updated_at
  before update on public.link_permissions
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 6. 接続リクエスト送信 RPC
-- ----------------------------------------------------------------------------
-- profiles を Marine ID で引くには他人の行を読む必要があるが、profiles を全体公開に
-- するとIDの総当たりで表示名が引けてしまう。解決のため、解決とinsertをまとめた
-- security definer 関数だけを公開し、profiles の RLS は閉じたままにする。
-- ============================================================================
create or replace function public.request_marine_link(target_marine_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing public.marine_links;
  new_id uuid;
  resource text;
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;

  select p.id into target
  from public.profiles p
  where upper(trim(p.marine_id)) = upper(trim(target_marine_id));

  if target is null then
    raise exception 'その Marine ID のアカウントは見つかりませんでした';
  end if;

  if target = me then
    raise exception '自分自身とは接続できません';
  end if;

  select * into existing
  from public.marine_links l
  where least(l.user_a, l.user_b) = least(me, target)
    and greatest(l.user_a, l.user_b) = greatest(me, target);

  if found then
    if existing.status = 'accepted' then
      raise exception 'すでに接続済みです';
    elsif existing.status = 'pending' then
      raise exception 'すでに接続リクエストが進行中です';
    else
      -- 一度断られた組み合わせは、行ごと作り直して再送する。
      -- guard_marine_link_transition が当事者と status の書き換えを止めるので、
      -- update で pending に戻すことはできない（意図した制約なので迂回しない）。
      delete from public.marine_links where id = existing.id;
    end if;
  end if;

  insert into public.marine_links (user_a, user_b, status, requested_by)
  values (me, target, 'pending', me)
  returning id into new_id;

  -- 双方に既定の権限行を作る（仕様書 14.1 の例に合わせ、貯金と割り勘は既定ON、
  -- 貯金ルールと月末入金状況は既定OFF）
  foreach resource in array array['saving', 'saving_rules', 'monthly', 'split'] loop
    insert into public.link_permissions (marine_link_id, owner_id, resource_type, permission)
    values
      (new_id, me, resource, resource in ('saving', 'split')),
      (new_id, target, resource, resource in ('saving', 'split'))
    on conflict (marine_link_id, owner_id, resource_type) do nothing;
  end loop;

  return new_id;
end;
$$;

revoke all on function public.request_marine_link(text) from public, anon;
grant execute on function public.request_marine_link(text) to authenticated;

-- ============================================================================
-- 7. 接続相手のプロフィールを読めるようにする
-- ----------------------------------------------------------------------------
-- 表示名と Marine ID だけを、接続（pending含む）がある相手に限って開く。
-- ============================================================================
drop policy if exists "profiles_select_linked" on public.profiles;
create policy "profiles_select_linked" on public.profiles
  for select to authenticated
  using (public.marine_link_exists(id));

-- ============================================================================
-- 8. 共有データの参照ポリシー
-- ----------------------------------------------------------------------------
-- 既存の *_select_own はそのまま残し、共有用のポリシーを追加する（permissive なので OR）。
-- 追加するのは SELECT だけ。共有相手が書き換えられる経路は作らない。
-- ============================================================================
-- user_id <> auth.uid() を先に置いて、自分の行では判定関数を呼ばせない
-- （自分の行は既存の *_select_own が通すので、ここで評価する必要がない）。
drop policy if exists "saving_entries_select_linked" on public.saving_entries;
create policy "saving_entries_select_linked" on public.saving_entries
  for select to authenticated
  using (user_id <> (select auth.uid()) and public.marine_link_allows(user_id, 'saving'));

drop policy if exists "saving_rules_select_linked" on public.saving_rules;
create policy "saving_rules_select_linked" on public.saving_rules
  for select to authenticated
  using (user_id <> (select auth.uid()) and public.marine_link_allows(user_id, 'saving_rules'));

drop policy if exists "monthly_savings_select_linked" on public.monthly_savings;
create policy "monthly_savings_select_linked" on public.monthly_savings
  for select to authenticated
  using (user_id <> (select auth.uid()) and public.marine_link_allows(user_id, 'monthly'));

drop policy if exists "records_select_linked" on public.records;
create policy "records_select_linked" on public.records
  for select to authenticated
  using (user_id <> (select auth.uid()) and public.marine_link_allows(user_id, 'split'));

-- ============================================================================
-- 9. 旧アプリから引き継いだトリガー関数の search_path 固定
-- ----------------------------------------------------------------------------
-- 旧「割り勘メモ」由来の update_updated_at に security linter 0011
-- （function_search_path_mutable）の警告が残っていたので固定する。本体は変更しない。
-- ============================================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
