-- ============================================================================
-- Marine Wallet / 0016_circle_by_link
-- ----------------------------------------------------------------------------
-- 総累計貯金額に、接続済みの相手が出てこない問題を直す。
--
-- これまでの saving_circle_totals() は「見る人自身の split_members」を辿っていた。
-- そのため、Marine Link で接続していても、見る側が相手をメンバーとして登録し
-- Marine ID を入れていなければ合算されなかった。接続は双方向なのに、
-- 見え方が片側の登録作業に依存していて、「接続したのに共有されない」ことになる。
--
-- 仕様（Phase 4）では「貯金は共同、割り勘は別」としているので、
-- 貯金は接続そのものを根拠にする。
--   ・接続済み（accepted）の相手は、メンバー登録が無くても合算の対象にする
--   ・名前は、メンバー表に Marine ID が一致する行があればその名前を使い、
--     無ければ相手の表示名（無ければ Marine ID）を出す
--   ・メンバー表にあって「貯金」のチェックを外している相手だけは除外する
--     （既定で入るが、明示的に外したなら従う）
--
-- 割り勘は従来どおりメンバー単位のまま（0007）。ここでは触らない。
--
-- 相手が貯金を共有していない場合も行自体は出し、is_visible=false・金額0 で返す。
-- 行ごと消すと「接続できていないのか、共有されていないのか」が画面から分からない。
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
    coalesce(nullif(btrim(sm.name), ''), nullif(btrim(p.display_name), ''), p.marine_id)::text,
    p.marine_id::text,
    false,
    public.marine_link_allows(p.id, 'saving'),
    case when public.marine_link_allows(p.id, 'saving')
      then public.deposited_total_for(p.id) else 0::bigint end,
    case when public.marine_link_allows(p.id, 'saving')
      then public.not_deposited_total_for(p.id) else 0::bigint end
  from public.marine_links l
  join public.profiles p
    on p.id = case when l.user_a = me then l.user_b else l.user_a end
  left join public.split_members sm
    on sm.user_id = me
   and sm.marine_id is not null
   and upper(btrim(sm.marine_id)) = upper(btrim(p.marine_id))
  where l.status = 'accepted'
    and (l.user_a = me or l.user_b = me)
    and coalesce(sm.join_saving, true)
  order by coalesce(sm.sort_order, 2147483647), p.marine_id;
end;
$$;
