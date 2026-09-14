-- ============================================================================
-- Marine Wallet / 0014_confirm_month_for_circle
-- ----------------------------------------------------------------------------
-- 月末の「確定」を共有先にも反映する。「入金済み」は各自のまま。
--
--   確定   … その月の積立額を締める記帳。一緒に貯めている人の分もまとめて締める。
--   入金済 … ワンバンクへ実際に送金したかどうか。財布は各自なので各自で立てる。
--
-- 反映する相手は「貯金に参加している接続済みメンバー」。
-- split_members で貯金に参加(join_saving)していて、Marine ID が一致する
-- アカウントがあり、その相手と Marine Link が accepted になっている人。
-- 総累計貯金額（saving_circle_totals）が数えている範囲と同じにしてある。
--
-- 押せるのはマスターだけ。マスター以外が押したときは自分の月だけを確定する
-- （他人の記録に書き込む操作なので、既定では広げない）。
--
-- 相手の確定額は相手自身の saving_entries の合計。こちらの金額は入れない。
-- すでに確定済み・入金済みの相手は触らない（上書きで金額を変えない）。
-- ============================================================================

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
  member record;
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '月の指定が正しくありません';
  end if;

  select coalesce(p.is_master, false) into master from public.profiles p where p.id = me;

  -- 自分の分
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

  -- 貯金に参加している接続済みメンバー
  for member in
    select p.id as user_id
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
  loop
    if p_confirm then
      -- 未確定の月だけを締める。確定済み・入金済みは金額を動かさない
      insert into public.monthly_savings (user_id, month, status, confirmed_amount, confirmed_at)
      values (
        member.user_id, p_month, 'ready',
        coalesce((select sum(se.amount) from public.saving_entries se
                  where se.user_id = member.user_id and se.month = p_month), 0),
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
      where user_id = member.user_id and month = p_month and status = 'ready';
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
