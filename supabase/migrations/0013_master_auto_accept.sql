-- ============================================================================
-- Marine Wallet / 0013_master_auto_accept
-- ----------------------------------------------------------------------------
-- マスターに指定したアカウントからの接続リクエストは、相手の承認を待たずに
-- 接続済みにする。
--
-- 影響: request_marine_link() は接続を作るときに双方の共有権限も作り、
-- 貯金と割り勘は既定でONになる（0005の設計で、承認＝共有の同意だった）。
-- そのため強制承認にすると、相手が操作しなくても相手の貯金と割り勘が
-- マスターから見える状態で接続が始まる。これは承知のうえの仕様変更。
-- 相手は接続後に共有を個別にOFFにでき、接続の解除も従来どおりどちらからでもできる。
--
-- マスターは1アカウントとは限らないので、フラグはプロフィールに持たせる。
-- ただしアプリから自分で立てられては意味がないので、
-- authenticated / anon からの書き換えはトリガーで無視する（SQL からのみ変更可）。
-- ============================================================================

alter table public.profiles
  add column if not exists is_master boolean not null default false;

comment on column public.profiles.is_master is
  'マスター権限。true のアカウントからの接続リクエストは承認なしで接続される。アプリからは変更できない';

-- ----------------------------------------------------------------------------
-- 自分でマスターになれないようにする
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_is_master()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- PostgREST 経由のリクエストは authenticated / anon ロールで届く。
  -- SQL エディタなど（postgres / service_role）からの変更だけを通す。
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_master := false;
    else
      new.is_master := coalesce(old.is_master, false);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_master on public.profiles;
create trigger profiles_guard_is_master
  before insert or update on public.profiles
  for each row execute function public.guard_profile_is_master();

-- ----------------------------------------------------------------------------
-- リクエストを即接続にする
-- ----------------------------------------------------------------------------
-- 0005 の request_marine_link() に、マスターのときだけ status を accepted で
-- 作る分岐を足したもの。それ以外の流れ（重複チェック・既定の共有権限）は同じ。
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
  master boolean;
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;

  select coalesce(p.is_master, false) into master
  from public.profiles p where p.id = me;

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

  insert into public.marine_links (user_a, user_b, status, requested_by, responded_at)
  values (
    me, target,
    case when coalesce(master, false) then 'accepted' else 'pending' end,
    me,
    case when coalesce(master, false) then now() else null end
  )
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

-- ----------------------------------------------------------------------------
-- マスターの指定
-- ----------------------------------------------------------------------------
update public.profiles set is_master = true where marine_id = 'MW-BAXF4K';
