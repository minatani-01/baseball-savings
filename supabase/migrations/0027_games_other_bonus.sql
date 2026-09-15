-- ============================================================================
-- Marine Wallet / 0027_games_other_bonus
-- ----------------------------------------------------------------------------
-- 「その他ボーナス」を試合そのものに持たせる。
--
-- これまで other_amount / other_note は saving_entries（人ごとの積立）にしか
-- 無かった。試合は games に共通で入るのに、その他ボーナスだけは登録した本人の
-- 行にしか付かないため、同じ試合なのに人によって金額が変わっていた。
--   例: 2026-06-12 マスター 1,500円 / 相手 1,400円（その他 100円の差）
--
-- 勝利やホームランの単価は人それぞれで良い（貯金ルールが人ごとにあるため）。
-- だが「その夜に何があったか」は試合の事実なので、全員で同じでなければならない。
-- そこで games 側へ移す。saving_entries の other_amount / other_note は、
-- 表示と履歴のためにそのまま持つが、値は試合から写したものになる。
--
-- 移行:
--   1. games に列を足す
--   2. マスターの積立にあるその他ボーナスを games へ写す（マスターを正とする）
--   3. 全員の試合の積立を games の値に合わせ直す（金額・内訳・メモ）
--   4. 確定済みの月次金額を、その月の明細の合計に合わせ直す
--      （累計は確定時に記録した金額を積むので、明細だけ直しても反映されない）
--
-- 冪等性: 何度実行しても安全。2回目以降は差が無いので0行更新になる。
-- ============================================================================

alter table public.games
  add column if not exists other_amount integer not null default 0;

alter table public.games
  add column if not exists other_note text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.games'::regclass and conname = 'games_other_amount_non_negative'
  ) then
    alter table public.games
      add constraint games_other_amount_non_negative check (other_amount >= 0);
  end if;
end $$;

comment on column public.games.other_amount is
  'その他ボーナス。試合の事実なので全員で同じ値を使う（単価は貯金ルール側）';
comment on column public.games.other_note is
  'その他ボーナスの理由。通知やロック画面には出さない';

-- 2. マスターの積立を正として games へ写す
update public.games g
set other_amount = src.other_amount,
    other_note = src.other_note
from (
  select se.game_id, se.other_amount, se.other_note
  from public.saving_entries se
  join public.profiles p on p.id = se.user_id and p.is_master
  where se.game_id is not null and se.other_amount > 0
) src
where g.id = src.game_id
  and (g.other_amount, g.other_note) is distinct from (src.other_amount, src.other_note);

-- 3. 全員の試合の積立を games に合わせる。
--    内訳からは古い other 行を落としてから、必要なら入れ直す
update public.saving_entries se
set other_amount = g.other_amount,
    other_note = g.other_note,
    amount = se.amount - se.other_amount + g.other_amount,
    breakdown = (
      select coalesce(jsonb_agg(line), '[]'::jsonb)
      from jsonb_array_elements(se.breakdown) as line
      where line->>'key' is distinct from 'other'
    ) || case when g.other_amount > 0 then jsonb_build_array(
        jsonb_build_object('key', 'other', 'label', 'その他ボーナス', 'amount', g.other_amount)
      ) else '[]'::jsonb end
from public.games g
where se.game_id = g.id
  and (se.other_amount, se.other_note) is distinct from (g.other_amount, g.other_note);

-- 4. 確定済みの月次金額を明細の合計に合わせ直す
update public.monthly_savings ms
set confirmed_amount = s.total
from (
  select user_id, month, sum(amount) as total
  from public.saving_entries
  group by user_id, month
) s
where ms.user_id = s.user_id
  and ms.month = s.month
  and ms.status in ('ready', 'deposited')
  and ms.confirmed_amount is distinct from s.total;
