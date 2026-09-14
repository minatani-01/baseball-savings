-- ============================================================================
-- Marine Wallet / 0018_auto_saving_entries
-- ----------------------------------------------------------------------------
-- マスター以外のアカウントでも、つみたてを強制にする。
--
-- 試合が登録されたら、マスターと接続しているアカウント全員ぶんの積立を作る。
-- 金額は共通の貯金ルール（0017 の saving_rule_settings）で計算するので、
-- 誰の分も同じ額になる。これまでは自分で「積み立てる」を押さないと立たなかった。
--
-- 作るのは新規のときだけ（on conflict do nothing）。
-- 「過去の金額は再計算しない」という原則があり、手で直した額を
-- あとから黙って書き換えないため。試合の内容が直された場合も同じ理由で触らない。
--
-- 入金済みは各自のまま。実際にワンバンクへ送金したかどうかは本人しか知らない。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 共通ルールでの積立額の計算（lib/savings.ts の calcSaving と同じ規則）
-- ----------------------------------------------------------------------------
-- 内訳のラベルもアプリ側と揃える。画面はこの breakdown をそのまま出すため。
create or replace function public.calc_saving_for_game(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.games;
  r public.saving_rule_settings;
  lines jsonb := '[]'::jsonb;
  subtotal int := 0;
  multiplier numeric;
  highlight_key text;
  highlight_label text;
  highlight_amount int;
begin
  select * into g from public.games where id = p_game_id;
  if not found then
    return jsonb_build_object('amount', 0, 'breakdown', '[]'::jsonb);
  end if;
  select * into r from public.saving_rule_settings where id;
  if not found then
    return jsonb_build_object('amount', 0, 'breakdown', '[]'::jsonb);
  end if;

  if g.result = 'win' then
    lines := lines || jsonb_build_object('key', 'win', 'label', '勝利', 'amount', r.win_amount);
    if g.is_sayonara and r.sayonara_bonus > 0 then
      lines := lines || jsonb_build_object(
        'key', 'sayonara', 'label', 'サヨナラ勝利', 'amount', r.sayonara_bonus);
    end if;
  elsif g.result = 'draw' then
    lines := lines || jsonb_build_object('key', 'draw', 'label', '引き分け', 'amount', r.draw_amount);
  elsif r.lose_amount > 0 then
    lines := lines || jsonb_build_object('key', 'lose', 'label', '敗北', 'amount', r.lose_amount);
  end if;

  if g.home_runs > 0 and r.home_run_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', 'home_run',
      'label', format('ホームラン %s本', g.home_runs),
      'amount', g.home_runs * r.home_run_amount);
  end if;
  if g.grand_slams > 0 and r.grand_slam_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', 'grand_slam',
      'label', format('満塁ホームラン %s本', g.grand_slams),
      'amount', g.grand_slams * r.grand_slam_amount);
  end if;
  if g.multi_hits > 0 and r.multi_hit_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', 'multi_hit',
      'label', format('マルチ安打 %s人', g.multi_hits),
      'amount', g.multi_hits * r.multi_hit_amount);
  end if;
  if g.rbi > 0 and r.rbi_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', 'rbi',
      'label', format('打点 %s', g.rbi),
      'amount', g.rbi * r.rbi_amount);
  end if;

  -- 先発ハイライトは最上位のみ（アプリ側と同じく1つだけ足す）
  highlight_key := null;
  if g.pitching_highlight = 'perfect_game' then
    highlight_key := 'perfect_game'; highlight_label := '完全試合'; highlight_amount := r.perfect_game_amount;
  elsif g.pitching_highlight = 'no_hitter' then
    highlight_key := 'no_hitter'; highlight_label := 'ノーヒットノーラン'; highlight_amount := r.no_hitter_amount;
  elsif g.pitching_highlight = 'shutout' then
    highlight_key := 'shutout'; highlight_label := '完封'; highlight_amount := r.shutout_amount;
  elsif g.pitching_highlight = 'complete_game' then
    highlight_key := 'complete_game'; highlight_label := '完投'; highlight_amount := r.complete_game_amount;
  elsif g.pitching_highlight = 'quality_start' then
    highlight_key := 'quality_start'; highlight_label := 'QS'; highlight_amount := r.quality_start_amount;
  end if;
  if highlight_key is not null and highlight_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', highlight_key, 'label', highlight_label, 'amount', highlight_amount);
  end if;

  if g.is_winning_pitcher and r.winning_pitcher_amount > 0 then
    lines := lines || jsonb_build_object(
      'key', 'winning_pitcher', 'label', '勝利投手', 'amount', r.winning_pitcher_amount);
  end if;
  if g.has_save and r.save_amount > 0 then
    lines := lines || jsonb_build_object('key', 'save', 'label', 'セーブ', 'amount', r.save_amount);
  end if;

  select coalesce(sum((line->>'amount')::int), 0) into subtotal
  from jsonb_array_elements(lines) line;

  multiplier := case g.phase
    when 'interleague' then r.multiplier_interleague
    when 'cs' then r.multiplier_cs
    when 'nippon_series' then r.multiplier_nippon_series
    else r.multiplier_regular
  end;

  return jsonb_build_object('amount', round(subtotal * multiplier)::int, 'breakdown', lines);
end;
$$;

revoke all on function public.calc_saving_for_game(uuid) from public, anon;
grant execute on function public.calc_saving_for_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- つみたての対象者
-- ----------------------------------------------------------------------------
-- マスター本人と、マスターと接続（accepted）しているアカウント。
-- 接続していない他人のアカウントには作らない。
create or replace function public.saving_target_users()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.is_master
  union
  select case when l.user_a = m.id then l.user_b else l.user_a end
  from public.marine_links l
  join public.profiles m on m.is_master and m.id in (l.user_a, l.user_b)
  where l.status = 'accepted';
$$;

revoke all on function public.saving_target_users() from public, anon;
grant execute on function public.saving_target_users() to authenticated;

-- ----------------------------------------------------------------------------
-- 試合ができたら、対象者ぶんの積立を作る
-- ----------------------------------------------------------------------------
create or replace function public.sync_saving_entries_for_game(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  calc jsonb;
  made int;
begin
  select * into g from public.games where id = p_game_id;
  if not found then
    return 0;
  end if;

  calc := public.calc_saving_for_game(p_game_id);

  insert into public.saving_entries (
    user_id, game_id, kind, title, entry_date, amount, breakdown, other_amount, other_note
  )
  select u, g.id, 'game', '', g.game_date,
         (calc->>'amount')::int, calc->'breakdown', 0, ''
  from public.saving_target_users() u
  -- 既にある分は触らない。手で直した額を黙って書き換えないため
  on conflict (user_id, game_id) do nothing;

  get diagnostics made = row_count;
  return made;
end;
$$;

revoke all on function public.sync_saving_entries_for_game(uuid) from public, anon;
grant execute on function public.sync_saving_entries_for_game(uuid) to authenticated;

create or replace function public.games_after_insert_sync_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_saving_entries_for_game(new.id);
  return null;
end;
$$;

drop trigger if exists games_sync_saving_entries on public.games;
create trigger games_sync_saving_entries
  after insert on public.games
  for each row execute function public.games_after_insert_sync_entries();

-- ----------------------------------------------------------------------------
-- あとから接続した人にも、過去の試合ぶんを埋める
-- ----------------------------------------------------------------------------
-- 試合側のトリガーは「試合ができたとき」しか動かない。接続はあとから増えるので、
-- 接続が accepted になった時点でその人の分をまとめて作る。
create or replace function public.sync_saving_entries_for_user(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  made int;
begin
  insert into public.saving_entries (
    user_id, game_id, kind, title, entry_date, amount, breakdown, other_amount, other_note
  )
  select p_user, g.id, 'game', '', g.game_date,
         (public.calc_saving_for_game(g.id)->>'amount')::int,
         public.calc_saving_for_game(g.id)->'breakdown',
         0, ''
  from public.games g
  on conflict (user_id, game_id) do nothing;

  get diagnostics made = row_count;
  return made;
end;
$$;

revoke all on function public.sync_saving_entries_for_user(uuid) from public, anon;
grant execute on function public.sync_saving_entries_for_user(uuid) to authenticated;

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
  return null;
end;
$$;

drop trigger if exists marine_links_sync_saving_entries on public.marine_links;
create trigger marine_links_sync_saving_entries
  after insert or update of status on public.marine_links
  for each row execute function public.marine_links_after_accept_sync_entries();

-- ----------------------------------------------------------------------------
-- 既存の試合ぶんを埋める
-- ----------------------------------------------------------------------------
do $$
declare
  gid uuid;
begin
  for gid in select id from public.games order by game_date loop
    perform public.sync_saving_entries_for_game(gid);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 確定の対象も「マスターと接続しているアカウント」に揃える
-- ----------------------------------------------------------------------------
-- 0014 は split_members（メンバー登録）を辿っていた。つみたての対象と
-- 確定の対象がずれると、積み立てられたのに締められない人が出る。
create or replace function public.confirm_month_for_circle(
  p_month text,
  p_confirm boolean default true
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  master boolean;
  affected int := 0;
  target uuid;
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '月の指定が正しくありません';
  end if;

  select coalesce(p.is_master, false) into master from public.profiles p where p.id = me;

  if p_confirm then
    insert into public.monthly_savings (user_id, month, status, confirmed_amount, confirmed_at)
    values (
      me, p_month, 'ready',
      coalesce((select sum(se.amount) from public.saving_entries se
                where se.user_id = me and se.month = p_month), 0),
      now()
    )
    on conflict (user_id, month) do update
    set status = 'ready',
        confirmed_amount = excluded.confirmed_amount,
        confirmed_at = now()
    where public.monthly_savings.status = 'calculating';
  else
    update public.monthly_savings
    set status = 'calculating', confirmed_amount = null, confirmed_at = null
    where user_id = me and month = p_month and status = 'ready';
  end if;

  if not coalesce(master, false) then
    return 0;
  end if;

  for target in select u from public.saving_target_users() u where u <> me loop
    if p_confirm then
      insert into public.monthly_savings (user_id, month, status, confirmed_amount, confirmed_at)
      values (
        target, p_month, 'ready',
        coalesce((select sum(se.amount) from public.saving_entries se
                  where se.user_id = target and se.month = p_month), 0),
        now()
      )
      on conflict (user_id, month) do update
      set status = 'ready',
          confirmed_amount = excluded.confirmed_amount,
          confirmed_at = now()
      where public.monthly_savings.status = 'calculating';
    else
      -- 取り消しも同じ範囲に効かせる。入金済みまで進んだ人は戻さない
      update public.monthly_savings
      set status = 'calculating', confirmed_amount = null, confirmed_at = null
      where user_id = target and month = p_month and status = 'ready';
    end if;

    if found then
      affected := affected + 1;
    end if;
  end loop;

  return affected;
end;
$$;

revoke all on function public.confirm_month_for_circle(text, boolean) from public, anon;
grant execute on function public.confirm_month_for_circle(text, boolean) to authenticated;
